"""DRF exception handler — never leak stack traces or SQL to clients."""

from __future__ import annotations

import logging

from rest_framework.views import exception_handler as drf_exception_handler

logger = logging.getLogger("apps.security")


def api_exception_handler(exc, context):
    response = drf_exception_handler(exc, context)
    request = context.get("request")
    path = getattr(request, "path", "?") if request is not None else "?"
    method = getattr(request, "method", "?") if request is not None else "?"
    if response is not None:
        logger.info(
            "api_handled status=%s method=%s path=%s",
            response.status_code,
            method,
            path[:200],
        )
        return response
    # Unhandled → generic 500 body via DRF default conversion; log without body.
    logger.exception("api_unhandled method=%s path=%s", method, path[:200])
    return response
