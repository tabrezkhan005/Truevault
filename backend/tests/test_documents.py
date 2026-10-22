import uuid

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from rest_framework import status

from apps.audit.models import AuditEvent
from apps.documents.models import Document
from tests.conftest import PNG_BYTES, TXT_BYTES


@pytest.mark.django_db
def test_owner_b_cannot_see_or_download_owner_a_doc(
    api_client, users, owned_document
):
    api_client.force_authenticate(user=users["owner_b"])
    listed = api_client.get("/api/documents/")
    assert listed.status_code == status.HTTP_200_OK
    ids = [row["id"] for row in listed.json()["results"]]
    assert str(owned_document.id) not in ids

    detail = api_client.get(f"/api/documents/{owned_document.id}/")
    assert detail.status_code == status.HTTP_404_NOT_FOUND

    download = api_client.get(f"/api/documents/{owned_document.id}/download/")
    assert download.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
def test_mass_assignment_owner_ignored(api_client, users):
    api_client.force_authenticate(user=users["owner_a"])
    upload = SimpleUploadedFile("note.txt", TXT_BYTES, content_type="text/plain")
    response = api_client.post(
        "/api/documents/",
        {
            "file": upload,
            "name": "mine.txt",
            "category": "general",
            "owner": str(users["owner_b"].id),
            "role": "admin",
        },
        format="multipart",
    )
    assert response.status_code == status.HTTP_201_CREATED
    doc = Document.objects.get(pk=response.json()["id"])
    assert doc.owner_id == users["owner_a"].id
    users["owner_a"].refresh_from_db()
    assert users["owner_a"].role == "owner"


@pytest.mark.django_db
def test_upload_validation_cases(api_client, users):
    api_client.force_authenticate(user=users["owner_a"])

    def post(name, data):
        upload = SimpleUploadedFile(name, data, content_type="application/octet-stream")
        return api_client.post(
            "/api/documents/",
            {"file": upload, "category": "t"},
            format="multipart",
        )

    wrong_ext = post("malware.exe", b"MZ\x00\x00")
    assert wrong_ext.status_code == status.HTTP_400_BAD_REQUEST

    magic_mismatch = post("fake.pdf", PNG_BYTES)
    assert magic_mismatch.status_code == status.HTTP_400_BAD_REQUEST

    oversize = post("big.txt", b"x" * (5 * 1024 * 1024 + 1))
    assert oversize.status_code == status.HTTP_400_BAD_REQUEST

    empty = post("empty.txt", b"")
    assert empty.status_code == status.HTTP_400_BAD_REQUEST

    traversal = post("../secret.txt", TXT_BYTES)
    # Sanitised basename may succeed; must not preserve path segments.
    if traversal.status_code == status.HTTP_201_CREATED:
        assert ".." not in traversal.json()["name"]
        assert "/" not in traversal.json()["name"]
        assert "\\" not in traversal.json()["name"]
    else:
        assert traversal.status_code == status.HTTP_400_BAD_REQUEST

    nul_txt = post("evil.txt", b"hello\x00world")
    assert nul_txt.status_code == status.HTTP_400_BAD_REQUEST

    bad_utf8 = post("bad.txt", b"\xff\xfe\xfd")
    assert bad_utf8.status_code == status.HTTP_400_BAD_REQUEST

    assert AuditEvent.objects.filter(
        action=AuditEvent.Action.UPLOAD,
        outcome=AuditEvent.Outcome.DENIED,
        reason="validation_failed",
    ).exists()


@pytest.mark.django_db
def test_soft_deleted_not_listed_or_downloadable(
    api_client, users, owned_document
):
    owned_document.deleted_at = timezone.now()
    owned_document.save(update_fields=["deleted_at"])

    api_client.force_authenticate(user=users["owner_a"])
    listed = api_client.get("/api/documents/")
    ids = [row["id"] for row in listed.json()["results"]]
    assert str(owned_document.id) not in ids

    detail = api_client.get(f"/api/documents/{owned_document.id}/")
    assert detail.status_code == status.HTTP_404_NOT_FOUND

    download = api_client.get(f"/api/documents/{owned_document.id}/download/")
    assert download.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
def test_owner_delete_soft_deletes(api_client, users, owned_document):
    api_client.force_authenticate(user=users["owner_a"])
    response = api_client.delete(f"/api/documents/{owned_document.id}/")
    assert response.status_code == status.HTTP_204_NO_CONTENT
    owned_document.refresh_from_db()
    assert owned_document.deleted_at is not None
    assert AuditEvent.objects.filter(
        action=AuditEvent.Action.DELETE,
        outcome=AuditEvent.Outcome.ALLOWED,
        document_id=owned_document.id,
    ).exists()


@pytest.mark.django_db
def test_download_headers_and_audit(api_client, users, owned_document):
    api_client.force_authenticate(user=users["viewer_read"])
    response = api_client.get(f"/api/documents/{owned_document.id}/download/")
    assert response.status_code == status.HTTP_200_OK
    assert response["Content-Type"] == "application/octet-stream"
    assert "attachment" in response["Content-Disposition"]
    assert response["X-Content-Type-Options"] == "nosniff"
    assert response["Cache-Control"] == "private, no-store"
    assert response.content == TXT_BYTES
    assert AuditEvent.objects.filter(
        action=AuditEvent.Action.DOWNLOAD,
        outcome=AuditEvent.Outcome.ALLOWED,
        document_id=owned_document.id,
    ).exists()


@pytest.mark.django_db
def test_guessed_uuid_404(api_client, users):
    api_client.force_authenticate(user=users["owner_a"])
    missing = uuid.uuid4()
    assert api_client.get(f"/api/documents/{missing}/").status_code == 404
