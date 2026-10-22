import pytest
from rest_framework import status

from apps.audit.models import AuditEvent


@pytest.mark.django_db
def test_csrf_ok(api_client):
    response = api_client.get("/api/auth/csrf")
    assert response.status_code == status.HTTP_200_OK
    assert response.json() == {"ok": True}


@pytest.mark.django_db
def test_login_success(api_client, users):
    response = api_client.post(
        "/api/auth/login",
        {"email": "owner_a@example.com", "password": "password123!"},
        format="json",
    )
    assert response.status_code == status.HTTP_200_OK
    body = response.json()
    assert body["email"] == "owner_a@example.com"
    assert body["role"] == "owner"
    assert "password" not in body
    assert AuditEvent.objects.filter(
        action=AuditEvent.Action.LOGIN, outcome=AuditEvent.Outcome.ALLOWED
    ).exists()


@pytest.mark.django_db
def test_login_wrong_password_and_unknown_email_same_response(api_client, users):
    bad_pw = api_client.post(
        "/api/auth/login",
        {"email": "owner_a@example.com", "password": "wrong"},
        format="json",
    )
    unknown = api_client.post(
        "/api/auth/login",
        {"email": "nosuch@example.com", "password": "password123!"},
        format="json",
    )
    assert bad_pw.status_code == unknown.status_code == status.HTTP_400_BAD_REQUEST
    assert bad_pw.json() == unknown.json() == {"detail": "Invalid credentials"}
    assert (
        AuditEvent.objects.filter(action=AuditEvent.Action.LOGIN_FAILED).count() >= 2
    )


@pytest.mark.django_db
def test_login_inactive_same_message(api_client, users):
    response = api_client.post(
        "/api/auth/login",
        {"email": "inactive@example.com", "password": "password123!"},
        format="json",
    )
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.json() == {"detail": "Invalid credentials"}


@pytest.mark.django_db
def test_me_and_logout(api_client, users):
    api_client.force_authenticate(user=users["owner_a"])
    me = api_client.get("/api/auth/me")
    assert me.status_code == status.HTTP_200_OK
    assert set(me.json().keys()) == {"id", "email", "role"}

    out = api_client.post("/api/auth/logout")
    assert out.status_code == status.HTTP_200_OK
    assert AuditEvent.objects.filter(action=AuditEvent.Action.LOGOUT).exists()


@pytest.mark.django_db
def test_me_role_not_writable(api_client, users):
    api_client.force_authenticate(user=users["viewer_none"])
    # GET-only endpoint; role must remain read-only on serializer.
    from apps.accounts.serializers import MeSerializer

    ser = MeSerializer(
        users["viewer_none"],
        data={"email": "viewer_none@example.com", "role": "admin"},
        partial=True,
    )
    assert ser.is_valid(), ser.errors
    # role in validated_data would mean it was accepted as writable input
    assert "role" not in ser.validated_data
