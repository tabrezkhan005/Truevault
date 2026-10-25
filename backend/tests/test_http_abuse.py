"""HTTP method / path abuse probes for /api/ routes (local only)."""

from __future__ import annotations

import pytest


@pytest.mark.django_db
def test_disallowed_methods_not_500(api_client, users, owned_document):
    api_client.force_authenticate(user=users["owner_a"])
    probes = [
        ("/api/health/", "post"),
        ("/api/auth/me", "post"),
        ("/api/auth/csrf", "post"),
        (f"/api/documents/{owned_document.id}/download/", "post"),
        ("/api/admin/audit/verify/", "post"),
    ]
    for url, method in probes:
        response = getattr(api_client, method)(url, format="json")
        assert response.status_code in (405, 401, 403, 404), (
            f"{method.upper()} {url} -> {response.status_code}"
        )
        assert response.status_code != 500


@pytest.mark.django_db
def test_method_override_header_ignored(api_client, users, owned_document):
    """X-HTTP-Method-Override must not turn GET into DELETE."""
    api_client.force_authenticate(user=users["owner_a"])
    response = api_client.get(
        f"/api/documents/{owned_document.id}/",
        HTTP_X_HTTP_METHOD_OVERRIDE="DELETE",
    )
    assert response.status_code == 200
    owned_document.refresh_from_db()
    assert owned_document.deleted_at is None


@pytest.mark.django_db
def test_percent_encoded_dotdot_does_not_bypass_authz(api_client, users, owned_document):
    api_client.force_authenticate(user=users["owner_b"])
    # Encoded traversal-ish paths should 404, never return owner_a content.
    weird = [
        f"/api/documents/%2e%2e/{owned_document.id}/",
        f"/api/documents//{owned_document.id}/",
    ]
    for url in weird:
        response = api_client.get(url)
        assert response.status_code in (404, 301, 302), url
        if response.status_code == 200:
            raise AssertionError(f"leaked document via {url}")


@pytest.mark.django_db
def test_uppercase_uuid_still_authorized(api_client, users, owned_document):
    api_client.force_authenticate(user=users["owner_a"])
    upper = str(owned_document.id).upper()
    response = api_client.get(f"/api/documents/{upper}/")
    # Django UUID converter accepts canonical form; uppercase may 404 — either
    # way must not 500 or skip authorize for a stranger.
    assert response.status_code in (200, 404)


@pytest.mark.django_db
def test_json_content_type_cannot_fake_multipart_upload(api_client, users):
    api_client.force_authenticate(user=users["owner_a"])
    response = api_client.post(
        "/api/documents/",
        {"file": "not-a-file", "name": "x.txt"},
        format="json",
    )
    assert response.status_code in (400, 415)
