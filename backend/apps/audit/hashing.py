import hashlib
import json


GENESIS_PREV_HASH = "0" * 64


def canonical_json(payload: dict) -> str:
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)


def compute_event_hash(prev_hash: str, fields: dict) -> str:
    """hash = sha256(prev_hash + canonical_json(all fields except hash))."""
    body = {k: v for k, v in fields.items() if k != "hash"}
    material = prev_hash + canonical_json(body)
    return hashlib.sha256(material.encode("utf-8")).hexdigest()


def event_fields_for_hash(event) -> dict:
    return {
        "id": str(event.id),
        "seq": event.seq,
        "ts": event.ts.isoformat() if event.ts else None,
        "actor_id": str(event.actor_id) if event.actor_id else None,
        "actor_email": event.actor_email,
        "actor_role": event.actor_role,
        "action": event.action,
        "outcome": event.outcome,
        "reason": event.reason,
        "document_id": str(event.document_id) if event.document_id else None,
        "target_user_id": str(event.target_user_id) if event.target_user_id else None,
        "remote_addr": event.remote_addr,
        "forwarded_for": event.forwarded_for,
        "user_agent": event.user_agent,
        "detail": event.detail,
        "prev_hash": event.prev_hash,
    }
