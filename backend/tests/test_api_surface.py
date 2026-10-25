import pytest
from django.urls import URLPattern, URLResolver, get_resolver
from rest_framework.permissions import AllowAny
from rest_framework.test import APIClient
from rest_framework.views import APIView


def _walk(patterns, prefix=""):
    for pattern in patterns:
        if isinstance(pattern, URLResolver):
            yield from _walk(pattern.url_patterns, prefix + str(pattern.pattern))
        elif isinstance(pattern, URLPattern):
            yield prefix + str(pattern.pattern), pattern


def _api_view_classes():
    resolver = get_resolver()
    found = []
    for path, pattern in _walk(resolver.url_patterns):
        if not path.startswith("api/"):
            continue
        callback = pattern.callback
        view_cls = getattr(callback, "cls", None)
        if view_cls is None:
            view_cls = getattr(callback, "view_class", None)
        if view_cls is not None and issubclass(view_cls, APIView):
            found.append((path, view_cls))
    return found


@pytest.mark.django_db
def test_all_api_views_declare_permission_classes():
    missing = []
    for path, view_cls in _api_view_classes():
        has_attr = hasattr(view_cls, "permission_classes")
        has_method = view_cls.get_permissions is not APIView.get_permissions
        if not has_attr and not has_method:
            missing.append(path)
        elif has_attr and view_cls.permission_classes is None:
            missing.append(path)
    assert missing == [], f"Views missing explicit permissions: {missing}"


@pytest.mark.django_db
def test_anonymous_blocked_except_public_routes():
    client = APIClient()
    allowed_anonymous = {
        ("/api/auth/csrf", "get"),
        ("/api/auth/login", "post"),
        ("/api/auth/register", "post"),
        ("/api/health/", "get"),
    }

    probes = [
        ("/api/auth/csrf", "get"),
        ("/api/auth/login", "post"),
        ("/api/auth/register", "post"),
        ("/api/health/", "get"),
        ("/api/auth/logout", "post"),
        ("/api/auth/me", "get"),
        ("/api/documents/", "get"),
        ("/api/documents/", "post"),
        ("/api/users/lookup/", "get"),
        ("/api/admin/audit/", "get"),
        ("/api/admin/users/", "get"),
    ]

    for url, method in probes:
        response = getattr(client, method)(url, format="json")
        if (url, method) in allowed_anonymous:
            assert response.status_code not in (401, 403), (
                f"{method.upper()} {url} unexpectedly blocked: {response.status_code}"
            )
        else:
            assert response.status_code in (401, 403), (
                f"{method.upper()} {url} allowed anonymous with {response.status_code}"
            )


@pytest.mark.django_db
def test_public_routes_use_allow_any():
    for path, view_cls in _api_view_classes():
        if (
            path.startswith("api/auth/csrf")
            or path.startswith("api/auth/login")
            or path.startswith("api/auth/register")
            or path.startswith("api/health")
        ):
            perms = view_cls.permission_classes
            assert AllowAny in perms or any(
                getattr(p, "__name__", "") == "AllowAny" for p in perms
            )


@pytest.mark.django_db
def test_django_admin_route_not_mounted(api_client):
    """Django's /admin/ UI is not exposed; staff ops use /api/admin/."""
    response = api_client.get("/admin/")
    assert response.status_code == 404

