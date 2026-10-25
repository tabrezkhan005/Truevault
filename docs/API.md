# TrustVault API

Derived from `backend/config/urls.py` and view docstrings. Default DRF permission: **IsAuthenticated** unless noted. Unauthorised document access → **404** (refusal still audited).

| Method | Path | Who may call | Success | Failure notes |
|--------|------|--------------|---------|---------------|
| GET | `/api/health/` | Anyone (`AllowAny`) | 200 `{ok}` | No DB/audit writes |
| GET | `/api/auth/csrf` | Anyone | 200; sets CSRF cookie | |
| POST | `/api/auth/login` | Anyone (throttled) | 200 user `{id,email,role}` | 400 invalid credentials (same message) |
| POST | `/api/auth/register` | Anyone (throttled) | 201 user + session | Body `email`, `password` (≥12), `role` `viewer`\|`owner`\|`admin`; duplicate email 400. Challenge demo: open signup (anyone can mint admin) |
| POST | `/api/auth/logout` | Authenticated | 200 | |
| GET | `/api/auth/me` | Authenticated | 200 `{id,email,role}` | Role not writable |
| GET | `/api/users/lookup/?email=` | Owner or admin (throttled) | 200 `{id,email}` | Exact match; 404 if missing |
| GET | `/api/documents/` | Authenticated | 200 paginated list | Always `visible_to`; filters `q`, `category`, `owner`, `created_after`, `created_before` only (unknown/`order_by` → 400). List rows include `owner_email` + `effective_level` (UX; `authorize()` still runs on every mutating/download route) |
| POST | `/api/documents/` | **Owner** role | 201 document | Multipart `file` (+ optional name/category); validation 400 |
| GET | `/api/documents/<uuid>/` | Read grant / owner | 200 | 404 + denied audit |
| PATCH | `/api/documents/<uuid>/` | Edit grant / owner | 200 metadata | |
| PUT | `/api/documents/<uuid>/` | Edit grant / owner | 200 content replace | Multipart file |
| DELETE | `/api/documents/<uuid>/` | Owner only | 204 soft-delete | |
| GET | `/api/documents/<uuid>/download/` | Read grant / owner (throttled) | 200 octets | `attachment`, `octet-stream`, `nosniff`, `no-store`, CSP `sandbox`; sha256 mismatch → 500 generic + `integrity_failure` audit (no bytes) |
| GET | `/api/documents/<uuid>/grants/` | Owner (`manage_grants`) | 200 grants | |
| POST | `/api/documents/<uuid>/grants/` | Owner | 200 upsert | Body `user_id`, `level` `read`\|`edit` |
| DELETE | `/api/documents/<uuid>/grants/<user_uuid>/` | Owner | 204 | Revoke immediate |
| GET | `/api/admin/audit/` | Admin | 200 paginated | Filters: actor, action, outcome, document, date |
| GET | `/api/admin/audit/verify/` | Admin | 200 `{ok, head_seq, head_hash}` or 409 broken | Hash chain; record head outside DB |
| GET | `/api/admin/users/` | Admin | 200 paginated | |
| PATCH | `/api/admin/users/<uuid>/` | Admin | 200 | `role`, `is_active`; deactivate flushes sessions |

Django `/admin/` is **not mounted**. Spectacular schema/Swagger URLs are **not mounted** (JSON renderer only when `DEBUG=False`).
