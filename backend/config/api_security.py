"""
Security headers and error handlers for /api/*.

WHY: browser clients should never treat API JSON as navigable HTML, and
authenticated responses must not be cached by shared caches.
"""

from __future__ import annotations

import logging

from django.http import JsonResponse

logger = logging.getLogger("apps.security")

API_CSP = "default-src 'none'; frame-ancestors 'none'"
DOWNLOAD_CSP = "sandbox"


class ApiSecurityHeadersMiddleware:
    """Attach restrictive headers to every /api/ response."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        path = request.path or ""
        if not path.startswith("/api/"):
            return response

        response.setdefault("X-Content-Type-Options", "nosniff")
        response.setdefault("Content-Security-Policy", API_CSP)
        response.setdefault("X-Frame-Options", "DENY")
        response.setdefault("Referrer-Policy", "same-origin")

        # Never let caches store API responses (views may set a stricter value).
        response.setdefault("Cache-Control", "no-store")

        return response


def _safe_log_request(request, status_code: int) -> None:
    """Log method/path/status only — never bodies, cookies, or Authorization."""
    logger.warning(
        "api_error status=%s method=%s path=%s",
        status_code,
        getattr(request, "method", "?"),
        getattr(request, "path", "?")[:200],
    )


def json_404(request, exception=None):
    _safe_log_request(request, 404)
    return JsonResponse({"detail": "Not found"}, status=404)


def json_500(request):
    _safe_log_request(request, 500)
    return JsonResponse({"detail": "Server error"}, status=500)
