import pytest
from rest_framework import status

from apps.audit.models import AuditEvent


def _actor_client(api_client, users, key):
    if key == "anonymous":
        api_client.force_authenticate(user=None)
        return api_client
    api_client.force_authenticate(user=users[key])
    return api_client


@pytest.mark.django_db
@pytest.mark.parametrize(
    "actor,list_status,detail_status,download_status,delete_status",
    [
        ("anonymous", 403, 403, 403, 403),
        ("viewer_none", 200, 404, 404, 404),
        ("admin", 200, 404, 404, 404),
        ("owner_b", 200, 404, 404, 404),
        ("viewer_read", 200, 200, 200, 404),
        ("viewer_edit", 200, 200, 200, 404),
        ("owner_a", 200, 200, 200, 204),
        ("inactive", 200, 404, 404, 404),
    ],
)
def test_document_access_matrix(
    api_client,
    users,
    owned_document,
    actor,
    list_status,
    detail_status,
    download_status,
    delete_status,
):
    """
    Expected statuses for owner_a's document.

    Strangers and admin-without-grant get 404 on detail/download/delete.
    Soft side effects: delete case uses a fresh clone of expectations per actor;
    for owner_a we delete last so other checks still see the live doc.
    """
    client = _actor_client(api_client, users, actor)
    doc_id = owned_document.id

    listed = client.get("/api/documents/")
    assert listed.status_code == list_status
    if list_status == 200:
        assert AuditEvent.objects.filter(
            action=AuditEvent.Action.LIST,
            outcome=AuditEvent.Outcome.ALLOWED,
        ).exists()

    # For owner_a delete we need the doc still present for detail/download first.
    detail = client.get(f"/api/documents/{doc_id}/")
    assert detail.status_code == detail_status
    if actor != "anonymous":
        if detail_status == 200:
            assert detail.json()["effective_level"] in {"owner", "read", "edit"}
            assert AuditEvent.objects.filter(
                document_id=doc_id,
                outcome=AuditEvent.Outcome.ALLOWED,
                action=AuditEvent.Action.VIEW,
            ).exists()
        elif detail_status == 404:
            assert AuditEvent.objects.filter(
                action=AuditEvent.Action.VIEW,
                outcome=AuditEvent.Outcome.DENIED,
            ).exists()

    download = client.get(f"/api/documents/{doc_id}/download/")
    assert download.status_code == download_status
    if actor != "anonymous":
        if download_status == 200:
            assert AuditEvent.objects.filter(
                document_id=doc_id,
                action=AuditEvent.Action.DOWNLOAD,
                outcome=AuditEvent.Outcome.ALLOWED,
            ).exists()
        elif download_status == 404:
            assert AuditEvent.objects.filter(
                action=AuditEvent.Action.DOWNLOAD,
                outcome=AuditEvent.Outcome.DENIED,
            ).exists()

    if actor == "owner_a":
        deleted = client.delete(f"/api/documents/{doc_id}/")
        assert deleted.status_code == delete_status
        assert AuditEvent.objects.filter(
            document_id=doc_id,
            action=AuditEvent.Action.DELETE,
            outcome=AuditEvent.Outcome.ALLOWED,
        ).exists()
    else:
        deleted = client.delete(f"/api/documents/{doc_id}/")
        assert deleted.status_code == delete_status
        if delete_status == 404 and actor != "anonymous":
            assert AuditEvent.objects.filter(
                action=AuditEvent.Action.DELETE,
                outcome=AuditEvent.Outcome.DENIED,
            ).exists()
