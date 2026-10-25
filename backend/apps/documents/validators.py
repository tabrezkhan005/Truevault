from __future__ import annotations

import hashlib
import io
import re
import zipfile
from dataclasses import dataclass

import filetype

MAX_UPLOAD_BYTES = 5 * 1024 * 1024
MAX_ZIP_MEMBERS = 200
MAX_ZIP_UNCOMPRESSED = 20 * 1024 * 1024
MAX_ZIP_RATIO = 100  # uncompressed / compressed per member

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
    base = name.replace("\\", "/").split("/")[-1]
    base = re.sub(r"[\x00-\x1f\x7f]", "", base)
    base = base.lstrip(".")
    base = re.sub(r"\s+", " ", base).strip()
    if not base:
        base = "unnamed"
    return base[:120]


def _assert_safe_office_zip(data: bytes) -> None:
    """
    WHY: OOXML is ZIP. Zip bombs, path tricks, and macro streams must not
    reach the detector or the database.
    """
    if not zipfile.is_zipfile(io.BytesIO(data)):
        raise UploadValidationError("File content does not match Office extension")
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as zf:
            infos = zf.infolist()
            if len(infos) > MAX_ZIP_MEMBERS:
                raise UploadValidationError("Office archive has too many members")
            total_uncomp = 0
            for info in infos:
                name = info.filename or ""
                norm = name.replace("\\", "/")
                if "\x00" in name:
                    raise UploadValidationError("Office archive member name is invalid")
                if norm.startswith("/") or norm.startswith("../") or "/../" in f"/{norm}/":
                    raise UploadValidationError("Office archive member path is invalid")
                lower = norm.lower()
                if lower.endswith("vbaproject.bin") or "vbaproject.bin" in lower:
                    raise UploadValidationError("Macro-enabled Office files are not allowed")
                total_uncomp += max(info.file_size, 0)
                if info.compress_size and info.file_size:
                    ratio = info.file_size / max(info.compress_size, 1)
                    if ratio > MAX_ZIP_RATIO and info.file_size > 1024:
                        raise UploadValidationError("Office archive compression ratio too high")
            if total_uncomp > MAX_ZIP_UNCOMPRESSED:
                raise UploadValidationError("Office archive uncompressed size too large")
    except zipfile.BadZipFile as exc:
        raise UploadValidationError("File content does not match Office extension") from exc


def _office_kind(data: bytes) -> str | None:
    _assert_safe_office_zip(data)
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
    if detected_ext == "jpeg":
        detected_ext = "jpg"
    logical = ALLOWED_EXTENSIONS.get(detected_ext)
    if logical is None:
        raise UploadValidationError("File type is not allowed")
    return logical, kind.mime


def validate_upload(uploaded_file, fallback_name: str = "") -> ValidatedUpload:
    if uploaded_file is None:
        raise UploadValidationError("No file provided")

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
    # WHY reject before sanitise: stripping NUL would hide an attack attempt.
    if "\x00" in original_name:
        raise UploadValidationError("Filename must not contain NUL bytes")

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
