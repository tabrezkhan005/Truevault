import pytest
from rest_framework import status

from apps.audit.models import AuditEvent
from apps.accounts.models import User


@pytest.mark.django_db
def test_register_creates_session_and_role(api_client):
    response = api_client.post(
        "/api/auth/register",
        {
            "email": "Judge.Owner@Example.com",
            "password": "JudgePass1234!",
            "role": "owner",
        },
        format="json",
    )
    assert response.status_code == status.HTTP_201_CREATED
    body = response.json()
    assert body["email"] == "judge.owner@example.com"
    assert body["role"] == "owner"
    assert "password" not in body

    user = User.objects.get(email="judge.owner@example.com")
    assert user.role == "owner"
    assert user.check_password("JudgePass1234!")

    me = api_client.get("/api/auth/me")
    assert me.status_code == status.HTTP_200_OK
    assert me.json()["role"] == "owner"

    assert AuditEvent.objects.filter(
        action=AuditEvent.Action.REGISTER,
        outcome=AuditEvent.Outcome.ALLOWED,
    ).exists()


@pytest.mark.django_db
@pytest.mark.parametrize("role", ["viewer", "owner", "admin"])
def test_register_each_role(api_client, role):
    response = api_client.post(
        "/api/auth/register",
        {
            "email": f"{role}.judge@example.com",
            "password": "JudgePass1234!",
            "role": role,
        },
        format="json",
    )
    assert response.status_code == status.HTTP_201_CREATED
    assert response.json()["role"] == role


@pytest.mark.django_db
def test_register_rejects_weak_password_and_duplicate(api_client, users):
    weak = api_client.post(
        "/api/auth/register",
        {
            "email": "weak@example.com",
            "password": "short",
            "role": "viewer",
        },
        format="json",
    )
    assert weak.status_code == status.HTTP_400_BAD_REQUEST

    dup = api_client.post(
        "/api/auth/register",
        {
            "email": "OWNER_A@EXAMPLE.COM",
            "password": "JudgePass1234!",
            "role": "viewer",
        },
        format="json",
    )
    assert dup.status_code == status.HTTP_400_BAD_REQUEST
