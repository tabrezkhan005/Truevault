"""
Same-origin relative redirect allowlist.

WHY: an open redirect after login would turn a phishing link into a
credential-harvesting bounce off a trusted host.
"""


def safe_redirect_path(candidate: str | None, fallback: str = "/") -> str:
    if not candidate:
        return fallback
    value = str(candidate).strip()
    if not value.startswith("/"):
        return fallback
    # Reject protocol-relative and scheme-smuggling forms.
    if value.startswith("//") or "://" in value or "\\" in value:
        return fallback
    if "\x00" in value or "\r" in value or "\n" in value:
        return fallback
    return value
