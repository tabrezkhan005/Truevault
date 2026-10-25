import pytest
from django.contrib.sessions.backends.db import SessionStore
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APIClient

from apps.audit.models import AuditEvent
from apps.documents.models import Grant


@pytest.mark.django_db
def test_health_allow_any_no_audit(api_client):
    before = AuditEvent.objects.count()
    response = api_client.get("/api/health/")
    assert response.status_code == status.HTTP_200_OK
    assert response.json() == {"ok": True}
    assert AuditEvent.objects.count() == before


@pytest.mark.django_db
def test_grants_owner_upsert_and_revoke(api_client, users, owned_document):
    api_client.force_authenticate(user=users["owner_a"])
    target = users["viewer_none"]

    created = api_client.post(
        f"/api/documents/{owned_document.id}/grants/",
        {"user_id": str(target.id), "level": "read"},
        format="json",
    )
    assert created.status_code == status.HTTP_200_OK
    assert AuditEvent.objects.filter(action=AuditEvent.Action.GRANT_ADD).exists()

    changed = api_client.post(
        f"/api/documents/{owned_document.id}/grants/",
        {"user_id": str(target.id), "level": "edit"},
        format="json",
    )
    assert changed.status_code == status.HTTP_200_OK
    assert Grant.objects.get(document=owned_document, user=target).level == "edit"
    assert AuditEvent.objects.filter(action=AuditEvent.Action.GRANT_CHANGE).exists()

    # Revoked user refused on the very next request.
    revoked_client = APIClient()
    revoked_client.force_authenticate(user=target)
    assert (
        revoked_client.get(f"/api/documents/{owned_document.id}/").status_code
        == status.HTTP_200_OK
    )

    revoke = api_client.delete(
        f"/api/documents/{owned_document.id}/grants/{target.id}/"
    )
    assert revoke.status_code == status.HTTP_204_NO_CONTENT
    assert AuditEvent.objects.filter(action=AuditEvent.Action.GRANT_REVOKE).exists()

    assert (
        revoked_client.get(f"/api/documents/{owned_document.id}/").status_code
        == status.HTTP_404_NOT_FOUND
    )


@pytest.mark.django_db
def test_cannot_grant_to_owner_or_inactive(api_client, users, owned_document):
    api_client.force_authenticate(user=users["owner_a"])
    to_owner = api_client.post(
        f"/api/documents/{owned_document.id}/grants/",
        {"user_id": str(users["owner_a"].id), "level": "read"},
        format="json",
    )
    assert to_owner.status_code == status.HTTP_400_BAD_REQUEST

    to_inactive = api_client.post(
        f"/api/documents/{owned_document.id}/grants/",
        {"user_id": str(users["inactive"].id), "level": "read"},
        format="json",
    )
    assert to_inactive.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
@pytest.mark.parametrize(
    "actor,list_status,post_status,delete_status",
    [
        ("anonymous", 403, 403, 403),
        ("viewer_none", 404, 404, 404),
        ("viewer_read", 404, 404, 404),
        ("viewer_edit", 404, 404, 404),
        ("admin", 404, 404, 404),
        ("owner_b", 404, 404, 404),
        ("owner_a", 200, 200, 204),
    ],
)
def test_grants_matrix(
    api_client,
    users,
    owned_document,
    actor,
    list_status,
    post_status,
    delete_status,
):
    if actor == "anonymous":
        api_client.force_authenticate(user=None)
    else:
        api_client.force_authenticate(user=users[actor])

    listed = api_client.get(f"/api/documents/{owned_document.id}/grants/")
    assert listed.status_code == list_status

    target = users["viewer_none"]
    posted = api_client.post(
        f"/api/documents/{owned_document.id}/grants/",
        {"user_id": str(target.id), "level": "read"},
        format="json",
    )
    assert posted.status_code == post_status

    # Ensure a grant exists for delete when owner; otherwise delete a known grantee.
    grant_user = users["viewer_read"]
    deleted = api_client.delete(
        f"/api/documents/{owned_document.id}/grants/{grant_user.id}/"
    )
    assert deleted.status_code == delete_status


@pytest.mark.django_db
def test_edit_grantee_cannot_manage_grants_read_cannot_edit(
    api_client, users, owned_document
):
    api_client.force_authenticate(user=users["viewer_edit"])
    assert (
        api_client.get(f"/api/documents/{owned_document.id}/grants/").status_code
        == status.HTTP_404_NOT_FOUND
    )

    api_client.force_authenticate(user=users["viewer_read"])
    patch = api_client.patch(
        f"/api/documents/{owned_document.id}/",
        {"name": "hacked.txt"},
        format="json",
    )
    assert patch.status_code == status.HTTP_404_NOT_FOUND

    api_client.force_authenticate(user=users["viewer_edit"])
    ok = api_client.patch(
        f"/api/documents/{owned_document.id}/",
        {"name": "renamed.txt", "category": "updated"},
        format="json",
    )
    assert ok.status_code == status.HTTP_200_OK
    assert ok.json()["name"] == "renamed.txt"
    assert AuditEvent.objects.filter(
        action=AuditEvent.Action.EDIT, outcome=AuditEvent.Outcome.ALLOWED
    ).exists()


@pytest.mark.django_db
def test_put_content_edit_grantee(api_client, users, owned_document):
    api_client.force_authenticate(user=users["viewer_edit"])
    upload = SimpleUploadedFile("new.txt", b"replaced content\n", content_type="text/plain")
    response = api_client.put(
        f"/api/documents/{owned_document.id}/",
        {"file": upload},
        format="multipart",
    )
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["size_bytes"] == len(b"replaced content\n")


@pytest.mark.django_db
def test_search_never_returns_inaccessible(api_client, users, owned_document):
    api_client.force_authenticate(user=users["owner_b"])
    response = api_client.get("/api/documents/", {"q": "a.txt"})
    assert response.status_code == status.HTTP_200_OK
    ids = [row["id"] for row in response.json()["results"]]
    assert str(owned_document.id) not in ids
    assert AuditEvent.objects.filter(action=AuditEvent.Action.SEARCH).exists()

    api_client.force_authenticate(user=users["owner_a"])
    found = api_client.get(
        "/api/documents/",
        {"q": "a.txt", "category": "general"},
    )
    assert found.status_code == status.HTTP_200_OK
    ids = [row["id"] for row in found.json()["results"]]
    assert str(owned_document.id) in ids


@pytest.mark.django_db
def test_users_lookup_exact_only(api_client, users):
    api_client.force_authenticate(user=users["owner_a"])
    ok = api_client.get("/api/users/lookup/", {"email": "viewer_read@example.com"})
    assert ok.status_code == status.HTTP_200_OK
    assert set(ok.json().keys()) == {"id", "email"}

    partial = api_client.get("/api/users/lookup/", {"email": "viewer_read@"})
    assert partial.status_code == status.HTTP_404_NOT_FOUND

    api_client.force_authenticate(user=users["viewer_none"])
    denied = api_client.get("/api/users/lookup/", {"email": "owner_a@example.com"})
    assert denied.status_code in (403, 404)


@pytest.mark.django_db
def test_admin_audit_and_users(api_client, users, owned_document):
    api_client.force_authenticate(user=users["admin"])
    audit = api_client.get("/api/admin/audit/")
    assert audit.status_code == status.HTTP_200_OK
    assert "results" in audit.json()

    verify = api_client.get("/api/admin/audit/verify/")
    assert verify.status_code == status.HTTP_200_OK
    assert verify.json()["ok"] is True

    users_list = api_client.get("/api/admin/users/")
    assert users_list.status_code == status.HTTP_200_OK

    # Admin cannot demote/deactivate self.
    self_role = api_client.patch(
        f"/api/admin/users/{users['admin'].id}/",
        {"role": "viewer"},
        format="json",
    )
    assert self_role.status_code == status.HTTP_400_BAD_REQUEST

    self_deact = api_client.patch(
        f"/api/admin/users/{users['admin'].id}/",
        {"is_active": False},
        format="json",
    )
    assert self_deact.status_code == status.HTTP_400_BAD_REQUEST

    # Non-admin blocked.
    api_client.force_authenticate(user=users["owner_a"])
    assert api_client.get("/api/admin/audit/").status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_deactivate_flushes_session(api_client, users):
    victim = users["viewer_none"]
    store = SessionStore()
    store["_auth_user_id"] = str(victim.id)
    store["_auth_user_backend"] = "django.contrib.auth.backends.ModelBackend"
    store.create()
    session_key = store.session_key

    api_client.force_authenticate(user=users["admin"])
    response = api_client.patch(
        f"/api/admin/users/{victim.id}/",
        {"is_active": False},
        format="json",
    )
    assert response.status_code == status.HTTP_200_OK
    victim.refresh_from_db()
    assert victim.is_active is False
    assert AuditEvent.objects.filter(action=AuditEvent.Action.USER_DEACTIVATE).exists()

    # Session row must be deleted (not merely inactive-user denial).
    from django.contrib.sessions.models import Session

    assert not Session.objects.filter(session_key=session_key).exists()

    # Session gone — a client using that session is anonymous.
    session_client = APIClient()
    session_client.cookies["sessionid"] = session_key
    me = session_client.get("/api/auth/me")
    assert me.status_code in (401, 403)


@pytest.mark.django_db
def test_detail_audits_view_not_list(api_client, users, owned_document):
    api_client.force_authenticate(user=users["owner_a"])
    api_client.get(f"/api/documents/{owned_document.id}/")
    assert AuditEvent.objects.filter(
        action=AuditEvent.Action.VIEW,
        outcome=AuditEvent.Outcome.ALLOWED,
        document_id=owned_document.id,
    ).exists()


@pytest.mark.django_db
def test_non_owner_cannot_upload(api_client, users):
    """WHY: upload is role=owner only — viewers/admins must not create documents."""
    upload = SimpleUploadedFile("note.txt", b"hello\n", content_type="text/plain")
    for key in ("viewer_none", "viewer_read", "admin"):
        api_client.force_authenticate(user=users[key])
        response = api_client.post(
            "/api/documents/",
            {"file": upload, "category": "t"},
            format="multipart",
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN, key


@pytest.mark.django_db
def test_admin_can_change_other_user_role(api_client, users):
    """Admin may change another user's role; event is audited."""
    target = users["viewer_none"]
    api_client.force_authenticate(user=users["admin"])
    response = api_client.patch(
        f"/api/admin/users/{target.id}/",
        {"role": "owner"},
        format="json",
    )
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["role"] == "owner"
    target.refresh_from_db()
    assert target.role == "owner"
    assert AuditEvent.objects.filter(
        action=AuditEvent.Action.ROLE_CHANGE,
        outcome=AuditEvent.Outcome.ALLOWED,
        target_user_id=target.id,
    ).exists()


@pytest.mark.django_db
def test_grant_unknown_user_id_refused(api_client, users, owned_document):
    """Missing user_id must not create a grant (same path as inactive)."""
    import uuid

    api_client.force_authenticate(user=users["owner_a"])
    response = api_client.post(
        f"/api/documents/{owned_document.id}/grants/",
        {"user_id": str(uuid.uuid4()), "level": "read"},
        format="json",
    )
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert AuditEvent.objects.filter(
        action=AuditEvent.Action.GRANT_ADD,
        outcome=AuditEvent.Outcome.DENIED,
        reason="validation_failed",
    ).exists()
