Entries: 4 total | Authorisation/access-control/audit entries: 1 (need >= 2)

## Tools used

- **Claude (planning/advice):** challenge planning, scaffolding guidance, project rules and documentation structure.
- **Cursor editor agent (code):** Django backend settings, custom User model, environment files, root docs, and Phase 1 core security model (audit chain, documents/grants authz, auth + document APIs, tests).

## Reused context

- **AGENTS.md** — purpose: reusable project/security/git rules for AI tools working on TrustVault. Date added: 2026-10-21.

## Entries

### Entry 1 - 2026-10-21 ~09:20 IST - Scaffold apps under backend/apps [tag: other]

- Asked: Scaffolding commands from the planning assistant: create Django apps (`accounts`, `documents`, `audit`) under `backend\apps\` using `python manage.py startapp <name> apps/<name>`.
- Produced: Attempted `startapp` with target directories under `backend\apps\`.
- Wrong: `startapp` failed with destination-directory-does-not-exist errors because the command sequence omitted creating `apps\accounts`, `apps\documents`, and `apps\audit` first.
- Fixed: Created those folders, then re-ran `startapp` successfully.
- Commit: TODO(you): paste commit link

### Entry 2 - 2026-10-21 ~09:24 IST - Custom User model and Django settings [tag: other]

- Asked: Settings/user-model prompt to the editor agent: set app names to `apps.*`, add UUID custom `User` with email/role, create `.env`/`.env.example`, configure `config/settings.py` (DRF, WhiteNoise, Argon2, sessions/CSRF, upload limits), then check/migrate and freeze requirements — stop if `.env` is not git-ignored.
- Produced: Custom `User` model; updated `apps.py` names; `backend\.env` and `backend\.env.example`; updated `backend\config\settings.py`. Agent stopped before migrate/`pip freeze` when ignore check failed.
- Wrong: My setup assumed a root `.gitignore` existed. The only `.gitignore` was inside `frontend\`, so `backend\.env` was not ignored. Agent correctly stopped per "do not edit `.gitignore`".
- Fixed: I created a root `.gitignore` and verified with `git check-ignore`. No secret was committed.
- Commit: TODO(you): paste commit link

### Entry 3 - 2026-10-21 ~09:31 IST - Root context and stub docs [tag: other]

- Asked: Create repo-root `AGENTS.md`, `README.md` stub, `THREATS.md` stub, `DECISIONS.md` stub, and `PROMPTS.md` (format + seed entries 1–2); do not touch `backend\.env` or run git.
- Produced: `AGENTS.md`, `README.md`, `THREATS.md`, `DECISIONS.md`, `PROMPTS.md` at repo root.
- Wrong: TODO(you): review and fill in
- Fixed: n/a yet
- Commit: TODO(you): paste commit link

### Entry 4 - 2026-10-22 ~09:48 IST - Phase 1 core security model [tag: authz]

- Asked: Build Phase 1 only (stop before Phase 2): append-only hash-chained `AuditEvent` + `record`/`verify_audit_chain`; `Document`/`DocumentContent`/`Grant` with `visible_to`/`authorize`/`get_document_or_404`; upload validators; `/api/auth/*` and `/api/documents/*` endpoints; pytest matrix and audit immutability tests; run `pytest -q`.
- Produced: audit/documents/accounts services, models, views, urls, migrations (incl. Postgres immutability trigger migration), `pytest.ini`, `backend/tests/*`. `pytest -q`: 27 passed, 1 skipped (Postgres trigger test on SQLite). `manage.py check` clean; `verify_audit_chain` printed OK after tests.
- Wrong: TODO(you): review and fill in
- Fixed: n/a yet
- Commit: TODO(you): paste commit link

## Open items

- TODO(you): review Entries 1–4 wording and fill "Wrong" where still TODO.
- TODO(you): paste commit links for Entries 1–4.
- Phase 2 not started (grants API, edit, search, admin, seed_demo, extended matrix).
- Authorisation/access-control/audit PROMPTS entries: 1 so far (need >= 2 before challenge end).
- `pip freeze > requirements.txt` still may be stale from early setup — refresh when you want a clean lock of current venv.
