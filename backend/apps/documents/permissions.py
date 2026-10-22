from django.http import Http404
from rest_framework.permissions import BasePermission

from apps.audit.models import AuditEvent
from apps.audit.service import record_denied
from apps.documents.models import Document, Grant


def authorize(user, document, action: str) -> bool:
    """
    Single chokepoint for document actions.

    WHY user.role is not consulted: an admin manages users/audit metadata, but
    must not read or alter file contents without a normal grant. Putting role
    checks here would quietly give admins document power and break that rule.
    """
    if user is None or not getattr(user, "is_authenticated", False):
        return False
    if not getattr(user, "is_active", False):
        return False
    if document.deleted_at is not None:
        return False

    # Owner may do everything on their own document.
    if document.owner_id == user.id:
        return True

    grant = (
        Grant.objects.filter(document_id=document.id, user_id=user.id)
        .only("level")
        .first()
    )
    if grant is None:
        return False

    if action in ("read", "download"):
        # Any grant level may read metadata and download bytes.
        return True
    if action == "edit":
        return grant.level == Grant.Level.EDIT
    if action in ("manage_grants", "delete"):
        # Only the owner — grantees never inherit admin-style control.
        return False
    return False


def effective_level(user, document) -> str:
    if document.owner_id == user.id:
        return "owner"
    grant = (
        Grant.objects.filter(document_id=document.id, user_id=user.id)
        .only("level")
        .first()
    )
    if grant is None:
        return "read"
    return grant.level


# Map authorize() actions onto AuditEvent.action choices (no separate "read").
_AUDIT_ACTION = {
    "read": AuditEvent.Action.LIST,
    "download": AuditEvent.Action.DOWNLOAD,
    "edit": AuditEvent.Action.EDIT,
    "delete": AuditEvent.Action.DELETE,
    "manage_grants": AuditEvent.Action.GRANT_CHANGE,
}


def get_document_or_404(request, pk, action: str) -> Document:
    """
    Fetch a document only through visible_to(), then authorize().

    WHY identical 404: returning 403 for "exists but forbidden" would let an
    attacker enumerate document IDs. Denial is still written to the audit log.
    """
    audit_action = _AUDIT_ACTION.get(action, AuditEvent.Action.LIST)
    qs = Document.objects.visible_to(request.user)
    document = qs.filter(pk=pk).first()

    if document is None:
        # WHY commit-then-raise: see record_denied() — evidence must survive.
        record_denied(
            request,
            action=audit_action,
            reason="not_found_or_no_grant",
            document_id=pk,
            detail={"view_action": action},
        )
        raise Http404

    if not authorize(request.user, document, action):
        record_denied(
            request,
            action=audit_action,
            reason="insufficient_level",
            document=document,
            detail={"view_action": action},
        )
        raise Http404

    return document


class IsOwnerRole(BasePermission):
    """Who may call: authenticated active users with role=owner."""

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and user.is_active
            and getattr(user, "role", None) == "owner"
        )


class IsAdminRole(BasePermission):
    """Who may call: authenticated active users with role=admin."""

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and user.is_active
            and getattr(user, "role", None) == "admin"
        )
