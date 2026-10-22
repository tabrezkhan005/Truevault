from apps.audit.hashing import GENESIS_PREV_HASH, compute_event_hash, event_fields_for_hash
from apps.audit.models import AuditEvent


def verify_audit_chain() -> tuple[bool, int | None]:
    """
    Recompute every hash in seq order.

    Returns (True, None) if the chain is intact, or (False, first_broken_seq).
    """
    expected_prev = GENESIS_PREV_HASH
    for event in AuditEvent.objects.order_by("seq").iterator():
        fields = event_fields_for_hash(event)
        if event.prev_hash != expected_prev:
            return False, event.seq
        recomputed = compute_event_hash(event.prev_hash, fields)
        if recomputed != event.hash:
            return False, event.seq
        expected_prev = event.hash
    return True, None
