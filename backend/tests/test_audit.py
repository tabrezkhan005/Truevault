import pytest
from django.db import connection
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


@pytest.mark.django_db
@pytest.mark.skipif(
    connection.vendor != "postgresql",
    reason="immutability trigger is PostgreSQL-only",
)
def test_postgres_trigger_rejects_update_and_delete():
    event = record(
        None,
        action=AuditEvent.Action.LIST,
        outcome=AuditEvent.Outcome.ALLOWED,
    )
    table = AuditEvent._meta.db_table
    with connection.cursor() as cursor:
        with pytest.raises(Exception):
            cursor.execute(
                f"UPDATE {table} SET reason = 'nope' WHERE id = %s",
                [str(event.id)],
            )
        with pytest.raises(Exception):
            cursor.execute(
                f"DELETE FROM {table} WHERE id = %s",
                [str(event.id)],
            )


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
