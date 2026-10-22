from __future__ import annotations

import hashlib
import io
import re
import zipfile
from dataclasses import dataclass

import filetype

MAX_UPLOAD_BYTES = 5 * 1024 * 1024

# extension -> expected logical type
ALLOWED_EXTENSIONS = {
    "pdf": "pdf",
    "png": "png",
    "jpg": "jpg",
    "jpeg": "jpg",
    "txt": "txt",
    "docx": "docx",
    "xlsx": "xlsx",
}


@dataclass
class ValidatedUpload:
    data: bytes
    sha256: str
    size_bytes: int
    content_type_detected: str
    safe_filename: str
    extension: str


class UploadValidationError(Exception):
    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


def sanitise_filename(name: str) -> str:
    """Basename only; never use the result as a storage key."""
    if not name:
        return "unnamed"
    # Strip any path components (Windows and POSIX).
    base = name.replace("\\", "/").split("/")[-1]
    # Remove control chars and leading dots.
    base = re.sub(r"[\x00-\x1f\x7f]", "", base)
    base = base.lstrip(".")
    base = re.sub(r"\s+", " ", base).strip()
    if not base:
        base = "unnamed"
    return base[:120]


def _office_kind(data: bytes) -> str | None:
    if not zipfile.is_zipfile(io.BytesIO(data)):
        return None
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as zf:
            names = zf.namelist()
    except zipfile.BadZipFile:
        return None
    if any(n.startswith("word/") for n in names):
        return "docx"
    if any(n.startswith("xl/") for n in names):
        return "xlsx"
    return None


def _detect_kind(data: bytes, extension: str) -> tuple[str, str]:
    """Return (logical_kind, content_type_detected)."""
    if extension == "txt":
        if b"\x00" in data:
            raise UploadValidationError("Text files must not contain NUL bytes")
        try:
            data.decode("utf-8")
        except UnicodeDecodeError as exc:
            raise UploadValidationError("Text files must be valid UTF-8") from exc
        return "txt", "text/plain"

    if extension in ("docx", "xlsx"):
        kind = _office_kind(data)
        if kind != extension:
            raise UploadValidationError("File content does not match Office extension")
        ctype = (
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            if kind == "docx"
            else "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        return kind, ctype

    kind = filetype.guess(data)
    if kind is None:
        raise UploadValidationError("Unable to detect file type")
    detected_ext = kind.extension
    # filetype uses "jpg" for JPEG.
    if detected_ext == "jpeg":
        detected_ext = "jpg"
    logical = ALLOWED_EXTENSIONS.get(detected_ext)
    if logical is None:
        raise UploadValidationError("File type is not allowed")
    return logical, kind.mime


def validate_upload(uploaded_file, fallback_name: str = "") -> ValidatedUpload:
    if uploaded_file is None:
        raise UploadValidationError("No file provided")

    # Reject early by declared size when available.
    declared = getattr(uploaded_file, "size", None)
    if declared is not None and declared > MAX_UPLOAD_BYTES:
        raise UploadValidationError("File exceeds 5 MB limit")
    if declared == 0:
        raise UploadValidationError("Empty files are not allowed")

    data = uploaded_file.read()
    if not data:
        raise UploadValidationError("Empty files are not allowed")
    if len(data) > MAX_UPLOAD_BYTES:
        raise UploadValidationError("File exceeds 5 MB limit")

    original_name = getattr(uploaded_file, "name", "") or fallback_name or "unnamed"
    safe_name = sanitise_filename(original_name)
    if "." not in safe_name:
        raise UploadValidationError("File extension is required")
    extension = safe_name.rsplit(".", 1)[-1].lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise UploadValidationError("File extension is not allowed")

    expected_kind = ALLOWED_EXTENSIONS[extension]
    detected_kind, content_type = _detect_kind(data, extension)
    if detected_kind != expected_kind:
        raise UploadValidationError("File extension does not match file content")

    digest = hashlib.sha256(data).hexdigest()
    return ValidatedUpload(
        data=data,
        sha256=digest,
        size_bytes=len(data),
        content_type_detected=content_type,
        safe_filename=safe_name,
        extension=extension,
    )
