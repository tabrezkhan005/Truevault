from __future__ import annotations

import uuid
from datetime import datetime, time

from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime
from rest_framework.exceptions import ValidationError


def _parse_boundary(value: str, *, end_of_day: bool):
    if not value:
        return None
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
    affect counts, titles, or snippets.
    """
    q = (params.get("q") or "").strip()
    category = (params.get("category") or "").strip()
    owner = (params.get("owner") or "").strip()
    created_after = (params.get("created_after") or "").strip()
    created_before = (params.get("created_before") or "").strip()

    used_filters = bool(q or category or owner or created_after or created_before)

    if q:
        if len(q) > 120:
            raise ValidationError({"detail": "q is too long"})
        qs = qs.filter(name__icontains=q)
    if category:
        if len(category) > 64:
            raise ValidationError({"detail": "category is too long"})
        qs = qs.filter(category=category)
    if owner:
        try:
            owner_uuid = uuid.UUID(owner)
            qs = qs.filter(owner_id=owner_uuid)
        except ValueError:
            qs = qs.filter(owner__email__iexact=owner)
    if created_after:
        qs = qs.filter(created_at__gte=_parse_boundary(created_after, end_of_day=False))
    if created_before:
        qs = qs.filter(created_at__lte=_parse_boundary(created_before, end_of_day=True))

    return qs, used_filters
