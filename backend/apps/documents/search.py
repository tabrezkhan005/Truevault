from __future__ import annotations

import uuid
from datetime import datetime, time

from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime
from rest_framework.exceptions import ValidationError

from apps.accounts.email_norm import normalise_email

# Pagination keys are allowed; anything else (esp. order_by) is rejected.
ALLOWED_QUERY_KEYS = frozenset(
    {
        "q",
        "category",
        "owner",
        "created_after",
        "created_before",
        "page",
        "page_size",
        "format",  # DRF may append in browsable DEBUG mode
    }
)
FORBIDDEN_ORDER_KEYS = frozenset({"ordering", "order_by", "sort", "sort_by"})


def _reject_unsafe_string(value: str, *, label: str, max_len: int) -> str:
    if "\x00" in value:
        raise ValidationError({"detail": f"{label} contains invalid characters"})
    if len(value) > max_len:
        raise ValidationError({"detail": f"{label} is too long"})
    return value


def _parse_boundary(value: str, *, end_of_day: bool):
    if not value:
        return None
    _reject_unsafe_string(value, label="date", max_len=64)
    dt = parse_datetime(value)
    if dt is not None:
        if timezone.is_naive(dt):
            dt = timezone.make_aware(dt, timezone.utc)
        return dt
    d = parse_date(value)
    if d is None:
        raise ValidationError({"detail": f"Invalid date: {value}"})
    if end_of_day:
        dt = datetime.combine(d, time.max)
    else:
        dt = datetime.combine(d, time.min)
    return timezone.make_aware(dt, timezone.utc)


def apply_document_filters(qs, params):
    """
    Filter a queryset that already came from visible_to().

    WHY: never search the global Document table — inaccessible rows must not
    affect counts, titles, or snippets. Never pass user input to order_by().
    """
    keys = set(params.keys())
    if keys & FORBIDDEN_ORDER_KEYS:
        raise ValidationError({"detail": "Ordering parameters are not allowed"})
    unknown = keys - ALLOWED_QUERY_KEYS
    if unknown:
        raise ValidationError({"detail": f"Unknown query parameter: {sorted(unknown)[0]}"})

    q = _reject_unsafe_string((params.get("q") or "").strip(), label="q", max_len=120)
    category = _reject_unsafe_string(
        (params.get("category") or "").strip(), label="category", max_len=64
    )
    owner = _reject_unsafe_string((params.get("owner") or "").strip(), label="owner", max_len=254)
    created_after = (params.get("created_after") or "").strip()
    created_before = (params.get("created_before") or "").strip()

    used_filters = bool(q or category or owner or created_after or created_before)

    if q:
        qs = qs.filter(name__icontains=q)
    if category:
        qs = qs.filter(category=category)
    if owner:
        # WHY: block ORM lookup injection (owner__password) and path junk.
        if "__" in owner or ".." in owner or "/" in owner or "\\" in owner:
            raise ValidationError({"detail": "Invalid owner filter"})
        try:
            owner_uuid = uuid.UUID(owner)
            qs = qs.filter(owner_id=owner_uuid)
        except ValueError:
            qs = qs.filter(owner__email__iexact=normalise_email(owner))
    if created_after:
        qs = qs.filter(created_at__gte=_parse_boundary(created_after, end_of_day=False))
    if created_before:
        qs = qs.filter(created_at__lte=_parse_boundary(created_before, end_of_day=True))

    return qs, used_filters
