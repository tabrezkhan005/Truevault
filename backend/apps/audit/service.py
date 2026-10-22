from __future__ import annotations

import uuid
from typing import Any

from django.db import connection, transaction
from django.utils import timezone

from apps.audit.hashing import GENESIS_PREV_HASH, compute_event_hash, event_fields_for_hash
from apps.audit.models import AuditEvent

# Arbitrary lock key so concurrent transactions serialize chain appends on Postgres.
_AUDIT_CHAIN_LOCK_KEY = 814_729_301


def _truncate(value: str | None, limit: int = 200) -> str:
    if not value:
        return ""
    return str(value)[:limit]


def _client_meta(request) -> tuple[str, str, str]:
    if request is None:
        return "", "", ""
    remote = _truncate(request.META.get("REMOTE_ADDR"))
    # Unverified: X-Forwarded-For is client-controlled unless a trusted proxy sets it.
    forwarded = _truncate(request.META.get("HTTP_X_FORWARDED_FOR"))
    user_agent = _truncate(request.META.get("HTTP_USER_AGENT"))
    return remote, forwarded, user_agent


def _actor_snapshot(request) -> tuple[uuid.UUID | None, str, str]:
    if request is None:
        return None, "", ""
    user = getattr(request, "user", None)
    if user is None or not getattr(user, "is_authenticated", False):
        return None, "", ""
    return user.id, (user.email or "")[:254], (getattr(user, "role", "") or "")[:10]


def _acquire_chain_lock() -> None:
    if connection.vendor == "postgresql":
        with connection.cursor() as cursor:
            cursor.execute("SELECT pg_advisory_xact_lock(%s)", [_AUDIT_CHAIN_LOCK_KEY])


def _append_event(
    *,
    request,
    action: str,
    outcome: str,
    reason: str = "",
    document=None,
    document_id=None,
    target_user=None,
    detail: dict | None = None,
) -> AuditEvent:
    _acquire_chain_lock()

    last = AuditEvent.objects.order_by("-seq").first()
    prev_hash = last.hash if last else GENESIS_PREV_HASH
    next_seq = (last.seq + 1) if last else 1

    actor_id, actor_email, actor_role = _actor_snapshot(request)
    remote_addr, forwarded_for, user_agent = _client_meta(request)

    doc_uuid = document_id
    if document is not None:
        doc_uuid = document.id
    target_uuid = target_user.id if target_user is not None else None

    event = AuditEvent(
        id=uuid.uuid4(),
        seq=next_seq,
        ts=timezone.now(),
        actor_id=actor_id,
        actor_email=actor_email,
        actor_role=actor_role,
        action=action,
        outcome=outcome,
        reason=reason or "",
        document_id=doc_uuid,
        target_user_id=target_uuid,
        remote_addr=remote_addr,
        forwarded_for=forwarded_for,
        user_agent=user_agent,
        detail=detail or {},
        prev_hash=prev_hash,
        hash="",  # filled below
    )
    event.hash = compute_event_hash(prev_hash, event_fields_for_hash(event))
    event.save()
    return event


def record(
    request_or_none,
    action: str,
    outcome: str,
    reason: str = "",
    document=None,
    target_user=None,
    detail: dict | None = None,
    document_id=None,
) -> AuditEvent:
    """
    Append one audit row under a chain lock.

    Callers that perform an *allowed* action must call this inside the same
    transaction.atomic() as the action so a failed audit aborts the action.

    For *denied* attempts use record_denied() instead (see that helper's WHY).
    """
    with transaction.atomic():
        return _append_event(
            request=request_or_none,
            action=action,
            outcome=outcome,
            reason=reason,
            document=document,
            document_id=document_id,
            target_user=target_user,
            detail=detail,
        )


def record_denied(
    request_or_none,
    action: str,
    reason: str = "",
    document=None,
    target_user=None,
    detail: dict | None = None,
    document_id=None,
) -> AuditEvent:
    """
    Persist a denial and COMMIT it before the caller raises Http404/PermissionDenied.

    WHY: if we wrote the denial inside an outer atomic() that later rolls back
    (or relied on an exception to unwind the request), the evidence of the
    refusal would disappear. We finish this atomic block successfully first,
    then the view raises. (ATOMIC_REQUESTS is intentionally off.)
    """
    return record(
        request_or_none,
        action=action,
        outcome=AuditEvent.Outcome.DENIED,
        reason=reason,
        document=document,
        target_user=target_user,
        detail=detail,
        document_id=document_id,
    )
