import threading

import pytest
from django.db import connection, connections
from rest_framework import status

from apps.audit.models import AuditEvent
from apps.audit.service import record
from apps.audit.verify import verify_audit_chain


@pytest.mark.django_db
def test_audit_orm_update_and_delete_raise(api_client, users):
    event = record(
        None,
        action=AuditEvent.Action.LIST,
        outcome=AuditEvent.Outcome.ALLOWED,
    )
    with pytest.raises(ValueError, match="cannot be updated"):
        event.reason = "x"
        event.save()
    with pytest.raises(ValueError, match="cannot be deleted"):
        event.delete()
    with pytest.raises(ValueError, match="cannot be updated"):
        AuditEvent.objects.filter(pk=event.pk).update(reason="y")
    with pytest.raises(ValueError, match="cannot be deleted"):
        AuditEvent.objects.filter(pk=event.pk).delete()


@pytest.mark.django_db
def test_verify_audit_chain_ok_and_fails_after_tamper():
    record(None, action=AuditEvent.Action.LOGIN, outcome=AuditEvent.Outcome.ALLOWED)
    record(None, action=AuditEvent.Action.LOGOUT, outcome=AuditEvent.Outcome.ALLOWED)
    ok, broken = verify_audit_chain()
    assert ok is True
    assert broken is None

    with connection.cursor() as cursor:
        table = AuditEvent._meta.db_table
        if connection.vendor == "postgresql":
            # Trigger blocks UPDATE; insert a forged row that breaks linkage.
            cursor.execute(
                f"""
                INSERT INTO {table}
                (id, seq, ts, actor_id, actor_email, actor_role, action, outcome,
                 reason, document_id, target_user_id, remote_addr, forwarded_for,
                 user_agent, detail, prev_hash, hash)
                VALUES
                ('00000000-0000-0000-0000-000000000099', 999, CURRENT_TIMESTAMP,
                 NULL, '', '', 'list', 'allowed', '', NULL, NULL, '', '', '',
                 '{{}}', 'deadbeef', 'not-a-real-hash')
                """
            )
        else:
            cursor.execute(
                f"UPDATE {table} SET reason = 'tampered' WHERE seq = 1"
            )

    ok, broken = verify_audit_chain()
    assert ok is False
    assert broken is not None


@pytest.mark.postgres
@pytest.mark.django_db(transaction=True)
def test_postgres_trigger_rejects_update_and_delete():
    """Row-level trigger from migration 0002 blocks UPDATE and DELETE."""
    event = record(
        None,
        action=AuditEvent.Action.LIST,
        outcome=AuditEvent.Outcome.ALLOWED,
    )
    table = AuditEvent._meta.db_table
    with connection.cursor() as cursor:
        with pytest.raises(Exception):
            cursor.execute(
                f"UPDATE {table} SET reason = %s WHERE id = %s",
                ["nope", str(event.id)],
            )
        with pytest.raises(Exception):
            cursor.execute(
                f"DELETE FROM {table} WHERE id = %s",
                [str(event.id)],
            )


@pytest.mark.postgres
@pytest.mark.django_db(transaction=True)
def test_postgres_trigger_rejects_truncate():
    """Statement-level BEFORE TRUNCATE trigger from migration 0003."""
    record(None, action=AuditEvent.Action.LIST, outcome=AuditEvent.Outcome.ALLOWED)
    table = AuditEvent._meta.db_table
    with connection.cursor() as cursor:
        with pytest.raises(Exception):
            cursor.execute(f"TRUNCATE TABLE {table}")


@pytest.mark.postgres
@pytest.mark.django_db(transaction=True)
def test_postgres_verify_ok_after_blocked_mutations():
    """Blocked mutations must not leave a broken chain."""
    event = record(
        None,
        action=AuditEvent.Action.LIST,
        outcome=AuditEvent.Outcome.ALLOWED,
    )
    table = AuditEvent._meta.db_table
    with connection.cursor() as cursor:
        try:
            cursor.execute(
                f"UPDATE {table} SET reason = %s WHERE id = %s",
                ["nope", str(event.id)],
            )
        except Exception:
            pass
        try:
            cursor.execute(
                f"DELETE FROM {table} WHERE id = %s",
                [str(event.id)],
            )
        except Exception:
            pass
        try:
            cursor.execute(f"TRUNCATE TABLE {table}")
        except Exception:
            pass

    ok, broken = verify_audit_chain()
    assert ok is True
    assert broken is None
    assert AuditEvent.objects.filter(pk=event.pk).exists()


@pytest.mark.postgres
@pytest.mark.django_db(transaction=True)
def test_postgres_concurrent_appends_valid_chain():
    """
    Advisory lock must serialize concurrent writers so the hash chain stays linear.
    """
    errors: list[BaseException] = []
    barrier = threading.Barrier(4)

    def worker():
        try:
            barrier.wait(timeout=10)
            for _ in range(5):
                record(
                    None,
                    action=AuditEvent.Action.LIST,
                    outcome=AuditEvent.Outcome.ALLOWED,
                )
        except BaseException as exc:  # noqa: BLE001 — collect any thread failure
            errors.append(exc)
        finally:
            connections.close_all()

    threads = [threading.Thread(target=worker) for _ in range(4)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=60)

    assert errors == [], f"worker errors: {errors!r}"
    assert AuditEvent.objects.count() == 20
    ok, broken = verify_audit_chain()
    assert ok is True
    assert broken is None
    seqs = list(AuditEvent.objects.order_by("seq").values_list("seq", flat=True))
    assert seqs == list(range(1, 21))


@pytest.mark.django_db
def test_denied_attempt_persists_after_404(api_client, users, owned_document):
    api_client.force_authenticate(user=users["viewer_none"])
    before = AuditEvent.objects.count()
    response = api_client.get(f"/api/documents/{owned_document.id}/")
    assert response.status_code == status.HTTP_404_NOT_FOUND
    assert AuditEvent.objects.count() == before + 1
    last = AuditEvent.objects.order_by("-seq").first()
    assert last.outcome == AuditEvent.Outcome.DENIED
    assert last.reason == "not_found_or_no_grant"
