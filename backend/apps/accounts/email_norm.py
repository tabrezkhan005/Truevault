"""Normalise emails to lowercase for unique identity."""


def normalise_email(email: str | None) -> str:
    if not email:
        return ""
    return str(email).strip().lower()
