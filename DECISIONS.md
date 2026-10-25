# Decisions

## Roles

Three roles: **admin**, **owner**, **viewer**. Role is never accepted from a self-service request body. Admin manages users and reads audit metadata; admin does **not** get file bytes without a normal grant (`authorize()` ignores `user.role`).

## Permission model

Per-document grants (`read` | `edit`) to named users. No folder inheritance. Every list/search/detail starts from `Document.objects.visible_to(user)`. Detail/download/edit/delete/grants go through `get_document_or_404` → `authorize()`. Missing or forbidden → identical **404**; denial is audited first.

## Storage

File bytes live in Postgres (`DocumentContent`) with a size cap, because Render’s disk is ephemeral.
At-rest encryption (AES-GCM) was **not** shipped in the hardening pass (Tier 3 optional, skipped under freeze). Download re-checks sha256 with `hmac.compare_digest` and fails closed on mismatch (`integrity_failure` audit).

## Email identity

Emails are stored and compared lowercased (`User.save` + login/lookup). Case variants cannot create two accounts.

## Production HTTP hardening

When `DEBUG=False`: HSTS (1y, no subdomains/preload), Secure cookies, COOP, JSON-only DRF renderers, `/api/` CSP `default-src 'none'`. `SECURE_SSL_REDIRECT` stays off so platform health checks over HTTP on the dyno still work behind the TLS proxy. `__Host-` session cookie name skipped (BFF cookie hop risk).

## Revocation

“Immediately” means the grant row is deleted and the next request re-reads the DB (no long-lived download URLs). Cost: every access hits authorize + DB. In-flight HTTP responses already streaming after a successful check are **accepted** residual risk.

## Audit

Append-only hash chain; app code refuses UPDATE/DELETE; Postgres triggers block UPDATE/DELETE/TRUNCATE for non-superusers. Audit write shares the action’s transaction (except `record_denied`, which commits before 404).

## Not built

2FA, folders/groups, public share links, versioning, AI suggestions — out of scope for the challenge window.

## Download authorization (interview paragraph)

When someone downloads a file, the decision is made in `apps/documents/views.py` inside `DocumentDownloadView.get`, which calls `get_document_or_404(request, pk, "download")` in `apps/documents/permissions.py`. That function loads the document only via `visible_to()`, then `authorize(user, document, "download")`. If either check fails it records a denial and raises Http404. If that line were removed and the view loaded bytes by primary key alone, any authenticated user who guessed a UUID could download another person’s file; the matrix and download tests are what catch that class of bug.
