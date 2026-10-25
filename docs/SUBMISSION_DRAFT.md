# Submission draft (verify before send)

1. **What I built**  
   TrustVault: session-auth document sharing with per-document grants, soft delete, search, upload validation, and an append-only hash-chained audit log (including refusals). Next.js landing + role homes (`/viewer`, `/owner`, `/admin`) and document detail/sharing; browser talks to Django via `/bff/*` → `/api/*`. [VERIFY] live URLs and seed logins on deployed site.

2. **How authorization works**  
   Server-side only: `visible_to` + `authorize` / `get_document_or_404`. UI hiding is cosmetic. [VERIFY] stranger UUID → “not found or no access”.

3. **How audit / revoke work**  
   Actions and denials append to a hash chain; revoke deletes the grant so the next request fails. [VERIFY] revoke then download as that user.

4. **Trade-offs**  
   Files in Postgres (size-capped); no 2FA; free-tier cold starts. [VERIFY] upload size error message in UI.

5. **What the AI got wrong** (from `PROMPTS.md` only)  
   - Entry 1: `startapp` failed without creating app directories first.  
   - Entry 2: no root `.gitignore`, so `.env` was not ignored until fixed.  
   - Entry 6: Postgres trigger migration crashed on literal `%` in `RAISE` without `params=None`.  
   - Entry 7: stock Hero2 / missing noise classes; `/login` was not-found until later.  
   - Mutation check: `authorize()` admin bypass alone stayed green until `test_authorize_ignores_admin_role` (visible_to already blocked); deactivate test needed Session row assertion.  
   Do **not** invent other incidents.

6. **What I would do next**  
   Wire production `NUM_PROXIES`, harden CSRF origins for the real Vercel domain, Postgres CI for triggers, polish admin UI. [VERIFY] Render `NUM_PROXIES` value.
