# TrustVault — AI agent context

Reusable context for AI tools working on this repository. Documented in
`PROMPTS.md` as a reused context file.

## THE PROJECT

TrustVault is a secure document-sharing platform for a 7-day hiring challenge
(solo, individual assessment, window Mon 19 Oct 2026 09:00 to Sun 25 Oct 2026
18:00 IST). Stack: Next.js (App Router, TypeScript) in `frontend\`, Django +
Django REST Framework + PostgreSQL in `backend\`, apps in `backend\apps\`
(accounts, documents, audit). Deploy: Django + Postgres on Render, Next.js on
Vercel, with Next.js proxying `/bff/*` to Django `/api/*` so the browser sees one origin.
Files are stored in Postgres (size-capped) because Render's disk is ephemeral.

## WHAT IT MUST DO

Authentication with roles (admin, owner, viewer); upload/organise/search/manage
documents; per-document permissions (read, edit) granted to named people;
owners grant and revoke; non-granted users cannot read, download, change or
delete; audit trail of uploads, downloads, changes, deletions and permission
changes (including REFUSED attempts); search by name, owner, category, date;
upload validation; admin view of activity and permission changes; automated
tests proving one user cannot reach another's documents.

Deliverables: public repo (kept PRIVATE until the deadline), live URL with seed
accounts per role in README, `THREATS.md`, `PROMPTS.md`, tests, schema and setup
scripts, API docs stating who may call each endpoint, short write-up.

## THREE NON-NEGOTIABLES

1. **Reachable only by someone granted it.** The SERVER decides on every route,
   including routes nobody thought of. Hidden buttons do not count.
2. **Provable who reached it, including refused attempts.** The audit trail must be
   tamper-evident (append-only, hash chain, no UPDATE/DELETE).
3. **Revoking access works immediately.** Nothing issued earlier may keep working.

## DESIGN DECISIONS ALREADY MADE

- Per-document grants (document, user, level `read`|`edit`). No folder inheritance.
- Admin manages users and sees metadata + audit, but cannot read file contents
  without a grant.
- One authorization chokepoint: `authorize(user, document, action)`, plus a
  `Document.objects.visible_to(user)` queryset used by EVERY list/search/detail
  query. No view may call `Document.objects.get(pk)` directly.
- Unauthorised access returns 404 (not 403); the refusal is still audited.
- UUID primary keys everywhere. `role` is never writable from a request body.
- Session auth (HttpOnly, Secure, SameSite=Lax) + CSRF. No tokens in
  localStorage. DRF default permission is `IsAuthenticated` (deny by default).
- Downloads are streamed through Django after the authz check; no presigned or
  long-lived URLs.
- Audit write happens in the same transaction as the action; if the audit write
  fails, the action fails.
- AI feature (later): suggests who should see a document using METADATA ONLY;
  never writes grants; a human confirms through the normal grant endpoint; the
  suggestion and the decision are both audited.

## CODING RULES

- Security first; prefer a smaller system that holds over a larger one with a
  hole. Deny by default.
- Never trust client input for owner, role, document id ownership, or
  permission level.
- Validate uploads: size cap, extension allowlist, magic-byte check, sanitised
  filename, serve with `Content-Disposition: attachment` and nosniff.
- Never log file contents or secrets. Sanitise filenames before logging.
- Every authorization/audit decision must carry a short comment explaining WHY,
  and when you write such code, explain your reasoning in plain words so the
  human can defend it in the interview. Keep the code simple enough to rewrite
  from memory.
- Every new endpoint needs tests for: anonymous, stranger, read grantee, edit
  grantee, owner, admin, revoked user, deactivated user.
- Never invent features, endpoints or results. If something is unfinished or
  you are unsure, say so plainly.

## GIT AND HONESTY RULES (HARD)

- NEVER run git add/commit/push/rebase/reset or touch git history. The human
  commits themselves. Never suggest rewriting or back-dating history.
- Never print or commit secrets. Real values live only in ignored `.env` files.
- The repo stays private until the human decides otherwise.
- Use of AI must be documented honestly. Never claim a feature works unless it
  was run and tested.

## ONGOING PROTOCOL

- After each meaningful task, append a `PROMPTS.md` entry draft per the format
  and update the tracker line. Keep "Wrong" and "Commit" honest.
- Keep a short "Open items" list at the bottom of `PROMPTS.md` for TODO(you)s.
- For any authorization, access-control or audit change, ALSO state in chat
  which tests prove it and what would break if the check were removed.
- At the start of each session, re-read `AGENTS.md` and `PROMPTS.md`.
