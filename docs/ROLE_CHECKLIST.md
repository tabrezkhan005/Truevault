# TrustVault role verification checklist

Derived from code under `frontend/` and `backend/apps/` on 2026-10-25 (~14:30 IST).  
**Implemented?** = found in views/serializers/permissions/UI (not assumed).  
**Automated test** = exact pytest name that exists, or `none`.  
**Manual result** = fill after you run the live/local UI.

Suite after checklist tests: `50 passed, 4 skipped` (`pytest -q`).

---

## All roles

| # | Check | Where (UI / API) | Expected result | Implemented? | Automated test | Manual result |
|---|--------|------------------|-----------------|--------------|----------------|---------------|
| A1 | Login success | UI: landing auth modal → `POST /api/auth/login` (via `/bff`) | 200 `{id,email,role}`; session cookie; redirect to role home | YES — `login-03.tsx` + `LoginView` + `homeForUser` | `test_login_success` | |
| A2 | Wrong password / unknown email | UI error; `POST /api/auth/login` | Same 400 `Invalid credentials` (no enum) | YES — `LoginView` | `test_login_wrong_password_and_unknown_email_same_response` | |
| A3 | Inactive user login | `POST /api/auth/login` | Same 400 message | YES — `LoginView` | `test_login_inactive_same_message` | |
| A4 | Generic unreachable / server error | UI: `login-03.tsx` catch | Message “Could not reach the server…” | YES — UI only | none | |
| A5 | Role routing after login | UI: `home-experience.tsx` → `/viewer` `/owner` `/admin` | Lands on role home | YES — `lib/role-home.ts` | none (frontend) | |
| A6 | Wrong-role page redirect | UI: `RoleGuard` on `/viewer` `/owner` `/admin` | Redirect to own home | YES — cosmetic only; API still decides | none (frontend) | |
| A7 | Unauthenticated app shell | UI: `AppShell` / `RoleGuard` | Redirect `/` | YES | none (frontend) | |
| A8 | Logout ends session | UI menu → `POST /api/auth/logout`; then `/api/auth/me` | 200 logout; next me fails | YES — `auth-provider` + `LogoutView` | `test_me_and_logout` | |
| A9 | CSRF cookie available | `GET /api/auth/csrf` | 200; sets `csrftoken` | YES — `CsrfView` | `test_csrf_ok` | |
| A10 | Signup | Auth modal “signup” tab | Notice only; no account API | YES (closed) — no register endpoint | none | |

---

## Viewer

| # | Check | Where (UI / API) | Expected result | Implemented? | Automated test | Manual result |
|---|--------|------------------|-----------------|--------------|----------------|---------------|
| V1 | Shared-with-me list | UI: `/viewer?view=documents`; `GET /api/documents/` | Only `visible_to` docs (grants) | YES — `viewer/page.tsx` + `visible_to` | `test_document_access_matrix` (viewer_read/edit/none); `test_search_never_returns_inaccessible` | |
| V2 | Search / filters | UI: `DocumentsTable` → `q`, category, owner, dates on `GET /api/documents/` | Filters apply after `visible_to` | YES — `search.py` + table | `test_search_never_returns_inaccessible` | |
| V3 | Read-grant download | UI detail Download; `GET /api/documents/<id>/download/` | 200 octets | YES | `test_document_access_matrix` [viewer_read]; `test_download_headers_and_audit` | |
| V4 | Edit-grant metadata edit | UI detail; `PATCH /api/documents/<id>/` | 200 when edit grant | YES | `test_edit_grantee_cannot_manage_grants_read_cannot_edit` | |
| V5 | Edit-grant content replace | UI replace file; `PUT /api/documents/<id>/` | 200 | YES | `test_put_content_edit_grantee` | |
| V6 | Read-grant cannot edit | `PATCH` as viewer_read | 404 | YES | `test_edit_grantee_cannot_manage_grants_read_cannot_edit` | |
| V7 | No upload UI | `/viewer` | No `FileDropzone` | YES — viewer page has no upload | none (frontend) | |
| V8 | No upload API | `POST /api/documents/` as viewer | 403 | YES — `IsOwnerRole` on POST | `test_non_owner_cannot_upload` | |
| V9 | Revocation next request | After owner `DELETE .../grants/<user>/` | Former grantee detail → 404 | YES — grant row deleted | `test_grants_owner_upsert_and_revoke` | |
| V10 | Stranger / no grant | Detail/download without grant | 404 + denied audit | YES | `test_document_access_matrix` [viewer_none]; `test_denied_attempt_persists_after_404` | |
| V11 | Cannot manage grants | `GET/POST .../grants/` | 404 | YES | `test_grants_matrix` [viewer_*]; `test_edit_grantee_cannot_manage_grants_read_cannot_edit` | |

---

## Owner

| # | Check | Where (UI / API) | Expected result | Implemented? | Automated test | Manual result |
|---|--------|------------------|-----------------|--------------|----------------|---------------|
| O1 | Upload allowed types (pdf/png/jpg/txt/docx/xlsx) | UI: `/owner` dropzone; `POST /api/documents/` | 201 when content matches extension | PARTIAL — validators allow all six; **no pytest that uploads each type successfully** (only txt/png fixtures elsewhere) | none for per-type success | |
| O2 | Reject wrong extension | `POST /api/documents/` | 400 | YES — allowlist | `test_upload_validation_cases` | |
| O3 | Reject magic-byte mismatch | e.g. PNG bytes as `.pdf` | 400 | YES — `_detect_kind` + match | `test_upload_validation_cases` | |
| O4 | Reject empty | empty file | 400 | YES | `test_upload_validation_cases` | |
| O5 | Reject oversize (>5 MB) | large body | 400 | YES | `test_upload_validation_cases` | |
| O6 | Odd / traversal filenames | `../secret.txt` etc. | Sanitised basename; no path segments kept | YES — `sanitise_filename` | `test_upload_validation_cases` | |
| O7 | Reject NUL / bad UTF-8 txt | `.txt` content | 400 | YES | `test_upload_validation_cases` | |
| O8 | Edit metadata / replace / soft-delete | Detail UI; PATCH/PUT/DELETE | Owner succeeds; soft-delete | YES | `test_edit_grantee_*` (edit path); `test_owner_delete_soft_deletes`; `test_soft_deleted_not_listed_or_downloadable` | |
| O9 | Grant add/change by exact email | Detail sharing: lookup → `POST .../grants/` | Upsert read/edit; audits | YES — UI lookup + API | `test_grants_owner_upsert_and_revoke`; `test_users_lookup_exact_only` | |
| O10 | Revoke grant | `DELETE .../grants/<user>/` | 204; next access 404 | YES | `test_grants_owner_upsert_and_revoke` | |
| O11 | Refuse grant to owner (self on own doc) | `POST .../grants/` | 400 | YES | `test_cannot_grant_to_owner_or_inactive` | |
| O12 | Refuse grant to inactive | `POST .../grants/` | 400 | YES | `test_cannot_grant_to_owner_or_inactive` | |
| O13 | Refuse grant to unknown user_id | `POST .../grants/` | 400 + denied audit | YES | `test_grant_unknown_user_id_refused` | |
| O14 | Unknown / partial email lookup | `GET /api/users/lookup/?email=` | 404; exact match only | YES | `test_users_lookup_exact_only` | |
| O15 | Other owners’ documents refused | Owner B vs A’s doc | Not in list; detail/download 404 | YES | `test_owner_b_cannot_see_or_download_owner_a_doc` | |
| O16 | Dashboard scoped to own docs | UI: `/owner` uses `?owner=<own email>` on list | Counts/charts from visible owned filter | YES — API still `visible_to`; UI adds owner filter | none dedicated (relies on search/list scoping) | |

---

## Admin

| # | Check | Where (UI / API) | Expected result | Implemented? | Automated test | Manual result |
|---|--------|------------------|-----------------|--------------|----------------|---------------|
| D1 | No document contents without grant | `authorize` + detail/download | `authorize(admin,…)` False; HTTP 404 | YES — role ignored in `authorize` | `test_authorize_ignores_admin_role`; `test_document_access_matrix` [admin] | |
| D2 | No upload without owner role | `POST /api/documents/` as admin | 403 | YES | `test_non_owner_cannot_upload` | |
| D3 | Audit log list + pagination | UI `/admin?tab=audit`; `GET /api/admin/audit/?page=` | Paginated metadata (no file bytes) | YES — `AdminAuditListView` + UI | `test_admin_audit_and_users` (list shape; **not** multi-page assert) | |
| D4 | Audit filters (actor, action, outcome, document, date) | UI filters → query params | Server filters queryset | YES — `admin_api.py` + UI inputs | none (filter combinations) | |
| D5 | Denied attempts visible | Filter outcome=denied / “denied only” | Denied rows listed | YES — UI + API outcome filter | `test_denied_attempt_persists_after_404` (write); list filter **none** | |
| D6 | Every action type visible | Audit UI | Free-text `action` filter; rows show `row.action` | PARTIAL — no dropdown of all `AuditEvent.Action` values; `ai_suggest`/`ai_decision` exist in model but are **not emitted** by any view | none | |
| D7 | Verify chain | UI button; `GET /api/admin/audit/verify/` | `{ok:true}` or 409 broken | YES | `test_admin_audit_and_users`; `test_verify_audit_chain_ok_and_fails_after_tamper` | |
| D8 | Role change other user | UI users tab; `PATCH /api/admin/users/<id>/` | 200 + `ROLE_CHANGE` audit | YES | `test_admin_can_change_other_user_role` | |
| D9 | Deactivate + session flush | `PATCH is_active=false` | Sessions deleted; next me fails | YES — `flush_user_sessions` | `test_deactivate_flushes_session` | |
| D10 | Activate inactive user | `PATCH is_active=true` | 200; audited as role_change detail | YES — code path in `AdminUserDetailView` | none (activate success) | |
| D11 | Self-demotion / self-deactivate refused | Patch self | 400 | YES | `test_admin_audit_and_users` | |
| D12 | Non-admin cannot call admin APIs | `GET /api/admin/audit/` as owner | 403 | YES — `IsAdminRole` | `test_admin_audit_and_users` | |
| D13 | No download button / file bytes on admin pages | UI `/admin` | Copy says metadata only; no download links to docs | YES — admin page has no document download controls (charts use audit metadata) | none (frontend) | |

---

## Cross-role security

| # | Check | Where (UI / API) | Expected result | Implemented? | Automated test | Manual result |
|---|--------|------------------|-----------------|--------------|----------------|---------------|
| X1 | Revoke then next request | Grant delete then detail | 404 | YES | `test_grants_owner_upsert_and_revoke` | |
| X2 | Mass-assign owner ignored | `POST /api/documents/` with `owner` field | Owner = requester | YES | `test_mass_assignment_owner_ignored` | |
| X3 | Mass-assign role ignored | Upload/`/me` body `role` | Role unchanged / not writable | YES | `test_mass_assignment_owner_ignored`; `test_me_role_not_writable` | |
| X4 | Missing CSRF refused | Session POST without `X-CSRFToken` | 403 | YES — DRF `SessionAuthentication` | `test_csrf_refused_on_session_mutating_request_without_token` | |
| X5 | Anonymous refused (non-public) | Various `/api/*` | 401/403 | YES | `test_anonymous_blocked_except_public_routes` | |
| X6 | Download headers | `GET .../download/` | attachment, nosniff, no-store, octet-stream | YES | `test_download_headers_and_audit` | |
| X7 | Django `/admin/` not mounted | `GET /admin/` | 404 | YES — not in `config/urls.py` | `test_django_admin_route_not_mounted` | |
| X8 | Login throttling | `LoginRateThrottle` 10/min | 429 after spray | YES — throttle class wired | none (no rate-limit assert) | |
| X9 | Audit ORM immutability | UPDATE/DELETE via ORM | Raises | YES | `test_audit_orm_update_and_delete_raise` | |
| X10 | Audit Postgres triggers | UPDATE/DELETE/TRUNCATE | Rejected on Postgres | YES — migrations 0002/0003 | `test_postgres_trigger_rejects_update_and_delete`; `test_postgres_trigger_rejects_truncate`; `test_postgres_verify_ok_after_blocked_mutations` (**skipped on SQLite**) | |
| X11 | Guessed UUID 404 | Random doc id | 404 | YES | `test_guessed_uuid_404` | |
| X12 | Health public write-free | `GET /api/health/` | 200 `{ok}`; no audit write | YES | `test_health_allow_any_no_audit` | |

---

## Mutation checks for new authz tests (2026-10-25)

| Mutation | Test | Result |
|----------|------|--------|
| `DocumentListCreateView.get_permissions` always `IsAuthenticated` (skip owner-only POST) | `test_non_owner_cannot_upload` | FAILED (good); file restored byte-identical |
| `if target is None or not target.is_active` → `if False and …` | `test_grant_unknown_user_id_refused` | FAILED (good); restored |
| `LogoutView` → `AllowAny` + empty `authentication_classes` (bypass session CSRF) | `test_csrf_refused_on_session_mutating_request_without_token` | FAILED (good); restored |
| Note: removing only `CsrfViewMiddleware` left the CSRF test **green** — DRF `SessionAuthentication` still enforces CSRF | — | Documented |
| `IsAdminRole.has_permission` → `False` | `test_admin_can_change_other_user_role` | FAILED (good); restored |

---

## Gaps to fix or to declare as unfinished

| Item | Status | Recommendation |
|------|--------|----------------|
| O1 Per-type successful upload tests | PARTIAL | **Declare** in README/submission Q6: allowlist tested via rejections; happy-path per MIME not fully automated. Optional fix (~15 min) if you want matrix of tiny fixtures. |
| D3 Multi-page audit pagination assert | PARTIAL | **Declare** — UI + `page_size` exist; no test that page 2 differs. |
| D4 Audit filter combinations | PARTIAL | **Declare** — code filters; no dedicated matrix test. Manual check filters once on live. |
| D5 Denied-only list filter | PARTIAL | **Declare** — denied rows are written (tested); admin UI filter untested. Manual. |
| D6 Every action type in UI | PARTIAL | **Declare** — free-text filter; AI actions unused. Do **not** claim a complete action catalogue UI. |
| D10 Activate user success | PARTIAL | **Declare** or **fix now** (~10 min): one PATCH `is_active=true` test. Not added this pass to keep scope to clear authz holes. |
| O16 Owner dashboard scoping | PARTIAL | **Declare** — relies on `visible_to` + `owner=` filter; no unique dashboard test. Manual: owner_a must not see owner_b charts. |
| A4–A7 Frontend routing | YES code / no API test | **Manual** on live — RoleGuard and login redirect are UI-only. |
| X8 Login throttling | YES code / no test | **Declare** — throttle wired at 10/min; no automated 429 test (flaky/timing). Manual spray optional. |
| X10 Postgres triggers | YES / skipped locally | **TODO(you):** run on Postgres before deadline. |

No production bugs were found that required a code fix beyond adding the four tests named above.

---

## Counts

| Implemented? | Count |
|--------------|------:|
| YES | 52 |
| PARTIAL | 8 |
| NO | 0 |

*(Items A1–X12 as listed; A10 signup-closed counted YES.)*

**Tests added this pass:**  
`test_non_owner_cannot_upload`, `test_admin_can_change_other_user_role`, `test_grant_unknown_user_id_refused`, `test_csrf_refused_on_session_mutating_request_without_token`.

**False claims removed from other docs:** none this pass (no additional false production claims found beyond Entry 20’s earlier `/api` rewrite fixes).

**Could not verify (no live deploy access):** all Manual result cells; Vercel/Render URLs; production CSRF origins; Postgres trigger suite on real PG; cold-start behaviour.
