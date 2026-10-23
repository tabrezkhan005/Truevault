import io

import pytest
from django.conf import settings
from rest_framework.test import APIClient

from apps.documents.models import Document, DocumentContent, Grant
from tests.factories import AdminFactory, OwnerFactory, ViewerFactory


def _default_db_is_postgresql() -> bool:
    engine = settings.DATABASES["default"]["ENGINE"]
    return "postgresql" in engine


def pytest_configure(config):
    config.addinivalue_line(
        "markers",
        "postgres: requires PostgreSQL (skipped when DATABASES default is not postgres)",
    )


def pytest_runtest_setup(item):
    if "postgres" in item.keywords and not _default_db_is_postgresql():
        pytest.skip(
            "requires PostgreSQL: set DATABASE_URL to a postgres URL "
            "(default DATABASES engine is not postgresql)"
        )

# Minimal 1x1 PNG
PNG_BYTES = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489"
    "0000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082"
)

TXT_BYTES = b"hello trustvault\n"


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def users(db):
    admin = AdminFactory(email="admin@example.com", password="password123!")
    owner_a = OwnerFactory(email="owner_a@example.com", password="password123!")
    owner_b = OwnerFactory(email="owner_b@example.com", password="password123!")
    viewer_none = ViewerFactory(email="viewer_none@example.com", password="password123!")
    viewer_read = ViewerFactory(email="viewer_read@example.com", password="password123!")
    viewer_edit = ViewerFactory(email="viewer_edit@example.com", password="password123!")
    inactive = ViewerFactory(
        email="inactive@example.com",
        password="password123!",
        is_active=False,
    )
    return {
        "admin": admin,
        "owner_a": owner_a,
        "owner_b": owner_b,
        "viewer_none": viewer_none,
        "viewer_read": viewer_read,
        "viewer_edit": viewer_edit,
        "inactive": inactive,
    }


@pytest.fixture
def owned_document(db, users):
    doc = Document.objects.create(
        owner=users["owner_a"],
        name="a.txt",
        category="general",
        content_type_detected="text/plain",
        size_bytes=len(TXT_BYTES),
        sha256="a" * 64,
    )
    DocumentContent.objects.create(document=doc, data=TXT_BYTES)
    Grant.objects.create(
        document=doc,
        user=users["viewer_read"],
        level=Grant.Level.READ,
        granted_by=users["owner_a"],
    )
    Grant.objects.create(
        document=doc,
        user=users["viewer_edit"],
        level=Grant.Level.EDIT,
        granted_by=users["owner_a"],
    )
    return doc


def login_client(client, user, password="password123!"):
    client.force_authenticate(user=user)
    return client


def multipart_file(name: str, data: bytes, content_type: str = "application/octet-stream"):
    buf = io.BytesIO(data)
    buf.name = name
    return buf
