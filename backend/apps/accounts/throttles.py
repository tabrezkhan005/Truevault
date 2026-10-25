"""Login throttles: per IP and per normalised email (hashed in the cache key)."""

from __future__ import annotations

import hashlib

from rest_framework.throttling import SimpleRateThrottle

from apps.accounts.email_norm import normalise_email


class LoginRateThrottle(SimpleRateThrottle):
    """10/min per IP — slows password spraying."""

    scope = "login"

    def get_cache_key(self, request, view):
        return self.cache_format % {
            "scope": self.scope,
            "ident": self.get_ident(request),
        }


class LoginEmailRateThrottle(SimpleRateThrottle):
    """
    10/min per normalised email.

    WHY hash the email in the key: cache backends and logs must not store
    raw addresses as throttle identifiers.
    """

    scope = "login_email"

    def get_cache_key(self, request, view):
        raw = ""
        if hasattr(request, "data"):
            raw = request.data.get("email") or ""
        email = normalise_email(str(raw))
        if not email:
            return None
        digest = hashlib.sha256(email.encode("utf-8")).hexdigest()[:32]
        return self.cache_format % {
            "scope": self.scope,
            "ident": digest,
        }
