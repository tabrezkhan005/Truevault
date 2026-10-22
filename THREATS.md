# Threats

Threat model and mitigations for TrustVault. Rows below are only threats that
are actually addressed in code today, with the tests that prove them.

| Threat | Attack | What I did | Test | Accepted? (why) |
|--------|--------|------------|------|-----------------|
| Cross-user document access | Guess UUID / list another owner's files | Every list/search/detail uses `visible_to()`; unauthorized → identical 404 | `test_owner_b_cannot_see_or_download_owner_a_doc`, `test_document_access_matrix`, `test_search_never_returns_inaccessible` | No |
| Admin bypass of file ACL | Use admin role to read/download without grant | `authorize()` ignores `user.role`; admin without grant gets 404 | `test_document_access_matrix` (admin row) | No |
| Existence oracle | Distinguish missing vs forbidden docs via 403 | Always 404 after denied audit | `test_document_access_matrix`, `test_denied_attempt_persists_after_404` | No |
| Stale grant after revoke | Keep using access after revoke | Grant row deleted; next request re-checks DB (no cache) | `test_grants_owner_upsert_and_revoke` | No |
| Privilege via grant APIs | Read/edit grantee manages grants | `manage_grants` is owner-only via `authorize` + `get_document_or_404` | `test_grants_matrix`, `test_edit_grantee_cannot_manage_grants_read_cannot_edit` | No |
| Read grantee writes | PATCH/PUT with read-only grant | `authorize(..., "edit")` requires edit level | `test_edit_grantee_cannot_manage_grants_read_cannot_edit` | No |
| Mass assignment | POST `owner` / `role` in body | Serializers omit those fields; owner forced to `request.user` | `test_mass_assignment_owner_ignored`, `test_me_role_not_writable` | No |
| Malicious upload | Wrong type, oversize, NUL/UTF-8 tricks, path names | Size/extension/magic/Office ZIP/txt checks + filename sanitise | `test_upload_validation_cases` | No |
| Soft-delete resurrection | Download/list deleted doc | `deleted_at` excluded from `visible_to` | `test_soft_deleted_not_listed_or_downloadable`, `test_owner_delete_soft_deletes` | No |
| Audit tampering | UPDATE/DELETE audit rows | ORM immutability + hash chain verify (+ PG trigger) | `test_audit_orm_update_and_delete_raise`, `test_verify_audit_chain_ok_and_fails_after_tamper` | No |
| Silent refusal | Deny access with no trail | `record_denied` commits before 404 | `test_denied_attempt_persists_after_404` | No |
| User enumeration at login | Different errors for bad email vs bad password | Same "Invalid credentials" + `login_failed` audit | `test_login_wrong_password_and_unknown_email_same_response` | No |
| Directory scrape via lookup | Partial email / listing users | Exact email only; owner/admin; throttled | `test_users_lookup_exact_only` | No |
| Admin self-lockout | Demote/deactivate self | Rejected + denied audit | `test_admin_audit_and_users` | No |
| Session after deactivate | Keep using old session cookie | Sessions flushed on deactivate | `test_deactivate_flushes_session` | No |
| Anonymous API probing | Hit /api/* without login | Deny-by-default + explicit AllowAny only on csrf/login/health | `test_anonymous_blocked_except_public_routes`, `test_all_api_views_declare_permission_classes` | No |
| Download sniffing / caching | Browser treats bytes as HTML; shared caches | `application/octet-stream`, attachment, nosniff, `private, no-store` | `test_download_headers_and_audit` | No |
| Proxy IP spoofing for throttles | Forge `X-Forwarded-For` | `NUM_PROXIES` from env (default 0) until chain measured | TODO(you): add deploy-time measurement test/note | TODO(you): accept residual risk until `NUM_PROXIES` set correctly in prod |
| Search side-channels | Infer hidden docs via counts/errors | Filters apply only after `visible_to` | `test_search_never_returns_inaccessible` | No |
