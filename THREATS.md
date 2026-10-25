# Threats

Threat model for TrustVault. **Test** cells name real tests; gaps say so.
This system is **not** unhackable — residual risks are listed as **ACCEPTED**.

| Threat | Attack | What I did | Test that proves it | Accepted? why |
|--------|--------|------------|---------------------|---------------|
| IDOR / UUID guessing | Guess document UUID | `visible_to` + 404 | `test_guessed_uuid_404`, `test_document_access_matrix` | No |
| Admin without grant | Use admin role to read bytes | `authorize` ignores role | `test_authorize_ignores_admin_role`, matrix admin row | No |
| Mass assignment | POST owner/role | Serializers omit; owner forced | `test_mass_assignment_owner_ignored`, `test_me_role_not_writable` | No |
| Self-grant / edit escalation | Grantee manages grants | `manage_grants` owner-only | `test_grants_matrix`, `test_edit_grantee_cannot_manage_grants_read_cannot_edit` | No |
| Search/list leakage | Infer others’ docs | Filters after `visible_to` | `test_search_never_returns_inaccessible` | No |
| Filter / order injection | `order_by`, `owner__password`, NUL | Allowlist + reject | `test_filter_rejects_order_by_and_injection` | No |
| 404 vs 403 leak | Distinguish missing vs forbidden | Always 404 after denied audit | `test_denied_attempt_persists_after_404` | No |
| Soft-deleted access | Download deleted | Excluded from `visible_to` | `test_soft_deleted_not_listed_or_downloadable` | No |
| Revoked user | Use access after revoke | Grant deleted | `test_grants_owner_upsert_and_revoke` | No |
| Deactivated session | Keep old cookie | Flush sessions on deactivate | `test_deactivate_flushes_session` | No |
| In-flight download after revoke | Finish stream started before revoke | No mid-stream kill | no threaded race test (time-boxed skip) | **ACCEPTED**: revoke is next-request |
| Upload abuse | Type/size/magic/ZIP bomb/macros | Validators + ZIP limits | `test_upload_validation_cases`, `test_upload_rejects_nul_filename_and_macros`, `test_upload_rejects_zip_path_traversal_member` | No |
| Stored-byte tamper | Alter `DocumentContent` in DB | sha256 compare_digest on download | `test_download_integrity_failure_refuses_and_audits` | No |
| Content-Disposition injection | Nasty filename | ASCII + RFC5987 quote | `test_download_headers_and_audit` | Partial |
| CSRF | Cross-site POST | Session + CSRF | `test_csrf_refused_on_session_mutating_request_without_token` | Confirm prod origins |
| Cookie flags | Steal session | HttpOnly, SameSite=Lax; Secure when not DEBUG | settings + deploy check | No browser cookie test |
| Login brute force / enum | Spray passwords | IP + hashed-email throttle; same error | `test_login_wrong_password_and_unknown_email_same_response` | Residual; no 429 assert |
| Email case twins | `Owner@x` vs `owner@x` | Lowercase on save + login/lookup | `test_email_case_collision_and_lookup`, `test_login_case_insensitive_email` | No |
| Open redirect after login | `?next=https://evil` | `safeRedirectPath` / `safe_redirect_path` | `test_safe_redirect_path_allowlist` | No |
| No 2FA | Stolen password | — | no test | **ACCEPTED**: out of scope |
| X-Forwarded-For / NUM_PROXIES | Spoof client IP | `NUM_PROXIES` from env (default 0) | no test | **TODO(you)** set prod=1 |
| Direct Render URL | Hit API origin | Django authz still applies | matrix | Fine; rate limits weaker |
| Django admin | Staff HTML admin | Route not mounted | `test_django_admin_route_not_mounted` | No |
| Browsable API / schema UI | HTML API / Swagger public | JSONRenderer when not DEBUG; schema URLs not mounted | settings review | No |
| Audit tamper via app | UPDATE/DELETE events | ORM immutability | `test_audit_orm_update_and_delete_raise` | No |
| Audit tamper via SQL | UPDATE/DELETE | PG trigger | `test_postgres_trigger_*` (skipped on SQLite) | Run on Postgres |
| TRUNCATE audit | Wipe log | PG truncate trigger | `test_postgres_trigger_rejects_truncate` | Run on Postgres |
| DB superuser / host compromise | Bypass triggers; steal env | — | no test | **ACCEPTED**: triggers don’t stop superuser; no at-rest file encryption (Tier 3 skipped) |
| Chain head not external | Rewrite DB + recompute | Verify returns `head_seq`/`head_hash` for offline note | `test_verify_returns_chain_head` | **ACCEPTED**: you must record head outside DB |
| CSP inline scripts | XSS via inline JS | Next CSP allows `'unsafe-inline'` script/style | none (browser check) | **ACCEPTED**: Next needs inline without nonces |
| Free DB / cold starts / DoS | Exhaust free tier | Throttles partial | — | **ACCEPTED** free tier |
| AI suggestion | — | Not built | — | N/A |

## Hardening mutations (2026-10-25 ~15:00 IST)

| Mutation | Test | Result |
|----------|------|--------|
| Skip `hmac.compare_digest` on download | `test_download_integrity_failure_refuses_and_audits` | FAILED (good) |
| Skip email+username normalise on save | `test_email_case_collision_and_lookup` | FAILED (good) |
| Allow `order_by` in query allowlist | `test_filter_rejects_order_by_and_injection` | FAILED (good) |
