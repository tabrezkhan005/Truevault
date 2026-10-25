"""Hardening pass tests — each pairs with a mutation that must fail the suite."""

from __future__ import annotations

import io
import zipfile

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import IntegrityError
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.email_norm import normalise_email
from apps.accounts.safe_redirect import safe_redirect_path
from apps.audit.models import AuditEvent
from apps.documents.models import DocumentContent, Grant
from apps.documents.validators import UploadValidationError, validate_upload
from tests.conftest import TXT_BYTES
from tests.factories import OwnerFactory


@pytest.mark.django_db(transaction=True)
def test_email_case_collision_and_lookup(api_client, users):
    """Owner@x and owner@x must be one identity (unique after normalisation)."""
    assert normalise_email("Owner@Demo.test") == "owner@demo.test"
    # users fixture already created owner_a@example.com
    with pytest.raises(IntegrityError):
        OwnerFactory(email="OWNER_A@EXAMPLE.COM", password="password123!")

    api_client.force_authenticate(user=users["owner_a"])
    upper = api_client.get(
        "/api/users/lookup/", {"email": "VIEWER_READ@EXAMPLE.COM"}
    )
    assert upper.status_code == status.HTTP_200_OK
    assert upper.json()["email"] == "viewer_read@example.com"


@pytest.mark.django_db
def test_api_security_headers_on_authenticated(api_client, users):
    api_client.force_authenticate(user=users["owner_a"])
    response = api_client.get("/api/documents/")
    assert response.status_code == 200
    assert response["X-Content-Type-Options"] == "nosniff"
    assert "default-src 'none'" in response["Content-Security-Policy"]
    assert response["Cache-Control"] == "no-store"


@pytest.mark.django_db
def test_download_integrity_failure_refuses_and_audits(
    api_client, users, owned_document
):
    content = DocumentContent.objects.get(document=owned_document)
    content.data = b"tampered-bytes-not-matching-hash"
    content.save(update_fields=["data"])

    api_client.force_authenticate(user=users["owner_a"])
    response = api_client.get(f"/api/documents/{owned_document.id}/download/")
    assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
    assert response.json()["detail"] == "Download unavailable"
    assert b"tampered" not in response.content
    assert AuditEvent.objects.filter(
        action=AuditEvent.Action.INTEGRITY_FAILURE,
        outcome=AuditEvent.Outcome.DENIED,
        document_id=owned_document.id,
    ).exists()


@pytest.mark.django_db
def test_filter_rejects_order_by_and_injection(api_client, users):
    api_client.force_authenticate(user=users["owner_a"])
    for params in (
        {"order_by": "name"},
        {"ordering": "-sha256"},
        {"sort": "id"},
        {"owner": "owner__password"},
        {"q": "x" * 200},
        {"owner": "../etc"},
        {"q": "a\x00b"},
    ):
        response = api_client.get("/api/documents/", params)
        assert response.status_code == status.HTTP_400_BAD_REQUEST, params


@pytest.mark.django_db
def test_upload_rejects_nul_filename_and_macros():
    # Multipart clients often strip NUL from filenames; enforce in validate_upload.
    with pytest.raises(UploadValidationError, match="NUL"):
        validate_upload(
            SimpleUploadedFile("ev\x00il.txt", TXT_BYTES, content_type="text/plain")
        )

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("word/document.xml", "<w:document/>")
        zf.writestr("word/vbaProject.bin", b"MACRO")
    buf.seek(0)
    with pytest.raises(UploadValidationError):
        validate_upload(
            SimpleUploadedFile("macro.docx", buf.read(), content_type="application/zip")
        )


@pytest.mark.django_db
def test_upload_rejects_zip_path_traversal_member():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("../evil.txt", b"x")
        zf.writestr("word/document.xml", b"<w/>")
    buf.seek(0)
    with pytest.raises(UploadValidationError):
        validate_upload(
            SimpleUploadedFile("trav.docx", buf.read(), content_type="application/zip")
        )


def test_safe_redirect_path_allowlist():
    assert safe_redirect_path("/owner") == "/owner"
    assert safe_redirect_path("//evil.com") == "/"
    assert safe_redirect_path("https://evil.com") == "/"
    assert safe_redirect_path("/\\evil") == "/"
    assert safe_redirect_path("owner") == "/"


@pytest.mark.django_db
def test_verify_returns_chain_head(api_client, users):
    api_client.force_authenticate(user=users["admin"])
    response = api_client.get("/api/admin/audit/verify/")
    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    assert "head_seq" in body
    assert "head_hash" in body


@pytest.mark.django_db
def test_session_cycles_on_login(api_client, users):
    client = APIClient()
    client.get("/api/auth/csrf")
    before = client.cookies.get("sessionid")
    login = client.post(
        "/api/auth/login",
        {"email": "owner_a@example.com", "password": "password123!"},
        format="json",
    )
    assert login.status_code == 200
    after = client.cookies.get("sessionid")
    assert after is not None
    if before is not None:
        assert before.value != after.value


@pytest.mark.django_db(transaction=True)
def test_concurrent_grant_upserts_no_duplicate(api_client, users, owned_document):
    """Two upserts for the same user must leave a single grant row."""
    target = users["viewer_none"]
    api_client.force_authenticate(user=users["owner_a"])
    url = f"/api/documents/{owned_document.id}/grants/"
    r1 = api_client.post(url, {"user_id": str(target.id), "level": "read"}, format="json")
    r2 = api_client.post(url, {"user_id": str(target.id), "level": "edit"}, format="json")
    assert r1.status_code == 200
    assert r2.status_code == 200
    assert Grant.objects.filter(document=owned_document, user=target).count() == 1
    assert Grant.objects.get(document=owned_document, user=target).level == "edit"


@pytest.mark.django_db
def test_login_case_insensitive_email(api_client, users):
    response = api_client.post(
        "/api/auth/login",
        {"email": "Owner_A@Example.COM", "password": "password123!"},
        format="json",
    )
    assert response.status_code == 200
    assert response.json()["email"] == "owner_a@example.com"
