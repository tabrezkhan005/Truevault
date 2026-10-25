Entries: 22 total | Authorisation/access-control/audit entries: 7 (need >= 2)

## Tools used

- **Claude (planning/advice):** challenge planning, scaffolding guidance, project rules and documentation structure.
- **Cursor editor agent (code):** Django backend (Phases 1–2, Postgres trigger fix); frontend TrustVault landing + GSAP intro.
- **GSAP / @gsap/react:** intro typewriter and landing handoff animation.
- **21st.dev Hero2 (`hero-2-1`):** third-party React/Tailwind marketing hero (LeadGenie demo) used as visual starting point, then rewritten for TrustVault branding and accurate product copy.
- **21st.dev String Tie Footer (`string-tie-footer`):** third-party interactive envelope/cord footer (React-only); adapted for TrustVault closing + contact.
- **Hyperiux Vault Timeline (`timeline`):** third-party GSAP ScrollTrigger + SplitText horizontal journey; adapted for TrustVault How it works.

## Reused context

- **AGENTS.md** — purpose: reusable project/security/git rules for AI tools working on TrustVault. Date added: 2026-10-21.
- **21st.dev Hero2 component** — third-party source adapted into `frontend/components/ui/hero-2-1.tsx` (not used verbatim). Date added: 2026-10-23.
- **21st.dev String Tie Footer** — third-party source adapted into `frontend/components/ui/string-tie-footer.tsx` and wired via `components/landing/closing.tsx`. Date added: 2026-10-23.
- **Hyperiux Vault Timeline** — third-party source adapted into `frontend/components/ui/timeline.tsx` and wired via `components/landing/how-it-works.tsx`. Date added: 2026-10-25.
- **21st.dev Progress Metric Card (Mak VieSAinte)** — card pasted; companions reconstructed (registry omits them) + Recharts; landing section `activity-proof`. Date added: 2026-10-25.

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

### Entry 5 - 2026-10-22 ~09:59 IST - Phase 2 grants/edit/search/admin + view/health/NUM_PROXIES [tag: authz]

- Asked: Continue Phase 2; add audit action `view` for document detail; `NUM_PROXIES` from env (default 0); `/api/health/` AllowAny with no audit/DB writes; grants, lookup, edit, search, admin APIs, `seed_demo`, extended tests, draft `THREATS.md`.
- Produced: grants/edit/search/admin/lookup/health/seed_demo; `view` audit action; settings `NUM_PROXIES`; filled `THREATS.md`; tests in `tests/test_phase2.py` and updates to matrix/api_surface. `pytest -q`: 44 passed, 1 skipped. `seed_demo` and `verify_audit_chain` ran OK.
- Wrong: TODO(you): review and fill in
- Fixed: n/a yet
- Commit: TODO(you): paste commit link

### Entry 6 - 2026-10-23 ~12:47 IST - Fix Postgres audit trigger migration + TRUNCATE [tag: audit]

- Asked: Fix `0002` migrate failure on Render (`incomplete placeholder: '%'`): pass `params=None` on `schema_editor.execute`; add TRUNCATE defence in new `0003` if missing; add `postgres` pytest marker and Postgres-only trigger/concurrency tests; report Django `/admin/` exposure and remove if safe; run SQLite `pytest -q`; give PowerShell commands for local Postgres (agent must not hit remote DB).
- Produced: `0002` execute calls use `params=None` (trigger SQL unchanged); `0003_auditevent_truncate_trigger.py`; `postgres` marker + four Postgres tests; removed Django `/admin/` route; `test_django_admin_route_not_mounted`. Local SQLite: `pytest -q` → 45 passed, 4 skipped. Postgres tests were NOT run in this environment.
- Wrong: The migration crashed on first real Postgres run because the Postgres-only code path had never executed in tests (skipped on SQLite). Cause verified in file: RAISE EXCEPTION message contains a literal `%` for `TG_OP`, which Django/psycopg treated as a bind placeholder when `params` defaulted to `()`.
- Fixed: `params=None` so SQL is sent unprocessed; added statement-level BEFORE TRUNCATE trigger in `0003`; tests now auto-run when `DATABASES` engine is postgresql.
- Commit: TODO(you)

### Entry 7 - 2026-10-23 ~22:58 IST - TrustVault static landing from 21st.dev Hero2 [tag: other]

- Asked: Adapt the pasted 21st.dev Hero2 into a static TrustVault landing page in `frontend\` (no API/cookies); fix dead `bg-noise`/`bg-grainy` classes; install only `motion` + `lucide-react`; wire `app/page.tsx`; run `npm run lint` and `npm run build`.
- Produced: `components/ui/hero-2-1.tsx` + landing sections; noise utilities in `globals.css`; layout metadata; `page.tsx` renders `Hero2`. Lint exited 0 (no findings). Build exited 0 — static `/` prerendered. `/login` route does not exist yet (Next shows `/_not-found` only).
- Wrong: The stock Hero2 used LeadGenie branding, fake product nav, trial/demo CTAs, yellow/pink gradients, undefined `bg-noise`/`bg-grainy` classes, and a remote netlify hero image. Confirmed before change: no `components.json` / `components/ui`; Tailwind **4.3.3**; `@/` maps to `./*`.
- Fixed: TrustVault branding + accurate copy; JSX audit-table illustration; guarantees / how-it-works / footer; noise CSS defined; Geist Google fonts removed (no external fonts); Sign in → `/login` Link.
- Commit: TODO(you)

### Entry 8 - 2026-10-23 ~23:35 IST - String-tie thank-you footer on landing [tag: other]

- Asked: Integrate 21st.dev String Tie Footer as landing footer; “That’s the whole story” closer for judges; Thank You / Looking Forward to Connect; email only `tabrezkhangnt@gmail.com`; Warm regards + signature text “Tabrez Khan”; no extra npm deps.
- Produced: `components/ui/string-tie-footer.tsx`; `components/landing/closing.tsx` (story + footer props); hero swaps plain footer for `Closing`. Lint exit 0; build exit 0 (static `/`). Removed orphan root `package-lock.json` from earlier mistaken `npm install` at repo root. No new dependencies.
- Wrong: Stock footer defaults were portfolio (phone, social links, Mara signature paths). ESLint initially failed on `draw`/`tick` use-before-declare / ref-during-render (confirmed by `npm run lint`); also linted a nested `frontend/frontend/.next` artifact until ignores/cleanup.
- Fixed: TrustVault props only (email, empty phone/links, `signatureText`); declare-order + `tickRef` via effect; `**/.next/**` eslint ignore; deleted nested junk folder.
- Commit: TODO(you)

### Entry 9 - 2026-10-25 ~09:02 IST - GSAP Raleway typewriter intro [tag: other]

- Asked: GSAP site opener — centred sentence with typewriter, Raleway (Google Fonts), then smooth pop/transition into the landing page.
- Produced: `gsap` + `@gsap/react`; `components/landing/site-intro.tsx`; `home-experience.tsx`; Raleway via `next/font` (`--font-raleway`); landing fonts restored in layout. Lint 0; build 0.
- Wrong: TODO(you): review and fill in
- Fixed: Used `next/font` for Raleway instead of a raw `@import` stylesheet; reduced-motion short-circuits the long sequence.
- Commit: TODO(you)

### Entry 10 - 2026-10-25 ~09:26 IST - Progress metric card + activity proof section [tag: other]

- Asked: Integrate 21st.dev Progress Metric Card (shadcn/Tailwind/TS); place near Guarantees; make the section more than a single card dump.
- Produced: `progress-metric-card.tsx` + reconstructed `metric-chart.tsx` / `metric-controls.tsx` (registry ships card only); `recharts`/`clsx`/`tailwind-merge`; shadcn-style tokens in `globals.css`, `lib/utils.ts`, `components.json`; `activity-proof.tsx` after Guarantees (dual cards + proof list); nav #activity.
- Wrong: Companion files are not published on 21st CDN — rebuilt from public fork patterns to match the card’s imports. Series on the landing are illustrative, not live audit API.
- Fixed: Dark-theme accents/controls; honest sample-data caption; multi-series grant vs refuse card.
- Commit: TODO(you)

### Entry 11 - 2026-10-25 ~09:30 IST - How-it-works GSAP Timeline [tag: other]

- Asked: Integrate Hyperiux Vault Timeline into shadcn-style `components/ui`, install `gsap`, use it for How it works with TrustVault copy and site alignment.
- Produced: `components/ui/timeline.tsx` (Upload→Grant→Authorize→Refuse→Audit→Revoke→Search; teal accent; Unsplash desk image); `how-it-works.tsx` wraps Timeline; hero `overflow-x-hidden` scoped so sticky scroll works. `gsap` already present (incl. SplitText). Lint 0; build 0.
- Wrong: Stock demo used product-roadmap years/months and orange accent; root `overflow-x-hidden` would break sticky pinning. Follow-up: landing stayed in-flow under the intro so timeline height forced a vertical scrollbar during typewriter; `w-screen` / wide track also caused a bottom scrollbar.
- Fixed: TrustVault step labels + copy; black/teal tokens; Guarantees / Activity / How it works / Closing sit outside the clipped hero shell. Intro locks `overflow` + fixes landing to viewport; `overflow-x: clip` + dark custom scrollbar in `globals.css`; timeline uses `w-full` / `overflow-x-clip`.
- Commit: TODO(you)

### Entry 12 - 2026-10-25 ~12:40 IST - Finish: app UI + mutations + docs [tag: authz]

- Asked: Complete Phase 0–3 so the product is testable; no git; deadline day.
- Produced: Frontend `/documents`, `/documents/[id]` (download/delete/grants), `/admin/audit`, `/admin/users`; CSRF `apiFetch`; login → documents; `seed_demo` accounts. Mutation table (9); gap tests `test_authorize_ignores_admin_role`, Session.exists in deactivate test. README, `docs/API.md`, THREATS, DECISIONS, SUBMISSION_DRAFT. pytest: 46 passed, 4 skipped. Frontend lint/build green after Suspense fix.
- Wrong: Mutation 1 stayed green until unit-testing `authorize` (visible_to already blocked admin). Mutation 9 stayed green until asserting Session row deleted (inactive user alone still denied me).
- Fixed: Added those two tests; re-ran mutations → both FAILS (good).
- Commit: TODO(you)

### Entry 13 - 2026-10-25 ~13:00 IST - Deploy env checklist + local login 500 [tag: other]

- Asked: No env variables on Render/Vercel; local Sign in showed Invalid credentials with 500 on `/api/auth/login`.
- Produced: README deploy table with exact Render (`SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS`, `DATABASE_URL`, `NUM_PROXIES`) and Vercel (`BACKEND_ORIGIN`) keys; install `argon2-cffi` into the system Python that was running `runserver` outside `.venv`.
- Wrong: Local `runserver` used Store Python without Argon2 → `ValueError: Couldn't load Argon2PasswordHasher` surfaced as UI "Invalid credentials". Deploy dashboards had no env → production would not boot or CSRF would fail.
- Fixed: `pip install argon2-cffi` on that interpreter (prefer always `backend\.venv`); documented dashboard values.
- Commit: TODO(you)

### Entry 14 - 2026-10-25 ~13:10–~14:00 IST - Role dashboards (Tier A) [tag: other]

- Asked: Build viewer/owner/admin dashboards on existing API only; dark enterprise UI; role guard; real data; Tier B aggregates only if time; feature freeze 16:00 IST.
- Produced: Design tokens + UI primitives; app shell (sidebar/drawer); `/viewer`, `/owner`, `/admin` with RoleGuard comment; DocumentsTable, FileDropzone (XHR progress), document detail (download anchor, edit/replace, sharing + revoke copy); cold-start banner; list serializer adds `owner_email` + `effective_level` (still via `visible_to` + existing `effective_level()`). Tier B endpoints **not** built — no frontend usage. `npm run lint` 0; `npm run build` green; `manage.py check` OK; `pytest -q` 46 passed, 4 skipped.
- Wrong: First build failed on `/documents/[id]` prerender (`usePathname` in RoleGuard) and owner `onRowsChange` prop after table API trim.
- Fixed: Removed pathname from RoleGuard; Suspense wrap; dropped unused prop.
- Commit: TODO(you)

### Entry 15 - 2026-10-25 ~13:24 IST - Fix API slash redirects + route clash [tag: other]

- Asked: Owner dashboard 0 docs, upload 500, console ERR_TOO_MANY_REDIRECTS + parallel pages `/(app)/documents/[id]` vs `/documents`.
- Produced: `skipTrailingSlashRedirect` + dual `/api` rewrites; `djangoApiPath()` normaliser; moved `/documents` redirect under `(app)/documents/page.tsx`, removed outer `app/documents`.
- Wrong: Next default slash redirect stripped `/api/documents/` before the Django rewrite → APPEND_SLASH 301 loop; POST without slash → RuntimeError 500. Split `documents` trees also conflicted.
- Fixed: as above. Restart `npm run dev` required for next.config.
- Commit: TODO(you)

### Entry 16 - 2026-10-25 ~13:27 IST - Replace API rewrite with route proxy [tag: other]

- Asked: Still ERR_TOO_MANY_REDIRECTS on `/api/documents/`; owner stats and table empty.
- Produced: `app/api/[...path]/route.ts` BFF (`redirect:manual`, slash normalize); removed next.config rewrites. Smoke: owner list/stats via proxy → 200 count=3.
- Wrong: Next rewrite followed Django APPEND_SLASH 301s back onto localhost:3000 → browser redirect loop; stats catch set zeros.
- Fixed: proxy once to Django; do not follow cross-hop redirects.
- Commit: TODO(you)

### Entry 17 - 2026-10-25 ~13:35 IST - Vault bento dashboards + white theme [tag: other]

- Asked: Integrate Web3 Bento into owner/admin/viewer; collapsible sidebar; restore white sign-in (no purple).
- Produced: Adapted `components/ui/web3-bento.tsx` for TrustVault (real API props only; no crypto DEMO on live dashboards); wired three role homes; collapsible desktop sidebar; globals primary back to white; login Continue forced `bg-white`.
- Wrong: Stock component ships invented Web3 stats — using DEMO on production dashboards would violate AGENTS honesty.
- Fixed: Bento tiles consume list/audit aggregates with captions; crypto DEMO not used.
- Commit: TODO(you)

### Entry 18 - 2026-10-25 ~13:42 IST - Kill stale Next; harden API proxy [tag: other]

- Asked: Console still ERR_TOO_MANY_REDIRECTS on `/api/documents/` after proxy change.
- Produced: Killed stale PID holding :3000 (pre-proxy rewrite process); proxy never returns 3xx to browser; follows Django redirects only on backend origin. Smoke: owner list 200.
- Wrong: Browser can cache 301s; old `next dev` kept serving rewrite loop despite code change.
- Fixed: fresh server + hardened `app/api/[...path]/route.ts`.
- Commit: TODO(you)

### Entry 19 - 2026-10-25 ~13:46 IST - Move browser API to /bff [tag: other]

- Asked: Network tab still `(failed) net::ERR_TOO_MANY_REDIRECTS` on documents fetch (1 ms / 0 kB).
- Produced: Browser calls go to `/bff/*` (new route); `/api/*` returns 410 no-store; `djangoApiPath`/`apiHref` map `/api`→`/bff`. Smoke: `/bff/documents/` 200.
- Wrong: Server already returned 200 on `/api`; Chrome had cached permanent 301s so the browser never hit the fixed proxy (1 ms fail).
- Fixed: new path busts redirect cache.
- Commit: TODO(you)

### Entry 20 - 2026-10-25 ~14:05 IST - Final verification pass [tag: authz]

- Asked: Deadline-day verification — tests/build, secrets hygiene, `/api` authz walk + mutation suite, docs truth, deploy settings; fix only real bugs/false docs; no git writes; no new features.
- Produced: All listed mutations FAILED (good), no gaps; corrected false docs (README/AGENTS `/api` rewrite → `/bff` BFF; SUBMISSION routes; next.config comment); `seed_demo` reads `SEED_DEMO_PASSWORD` (default public demo); section 1 green (`46 passed, 4 skipped`; check/makemigrations/lint/build/collectstatic OK).
- Wrong: README still claimed Next “rewrites `/api/*`” and Sign in → `/documents` after the BFF move; seed comment claimed the demo password was “not stored in the repo” while the constant was committed.
- Fixed: Doc/proxy wording; env-overridable seed password with documented default.
- Commit: TODO(you)

### Entry 21 - 2026-10-25 ~14:30 IST - Role checklist + authz test gaps [tag: authz]

- Asked: Create `docs/ROLE_CHECKLIST.md` from code (all roles / viewer / owner / admin / cross-role); mark Implemented from views/UI; real test names; add authz/audit tests where none; mutate-verify new tests; no new features.
- Produced: Checklist with YES/PARTIAL/NO; added `test_non_owner_cannot_upload`, `test_admin_can_change_other_user_role`, `test_grant_unknown_user_id_refused`, `test_csrf_refused_on_session_mutating_request_without_token`; `pytest -q` → 50 passed, 4 skipped; mutations FAILED (good) with restores.
- Wrong: Checklist would have marked CSRF / non-owner upload / unknown grant as covered without dedicated tests (only adjacent tests existed).
- Fixed: four tests + mutation notes (CsrfViewMiddleware-only removal does not fail CSRF test; SessionAuthentication does).
- Commit: TODO(you)

### Entry 22 - 2026-10-25 ~15:00 IST - Hardening pass (integrity, email, filters) [tag: authz]

- Asked: Feature-freeze hardening: deploy check, API/Next headers, JSON-only DRF, password min 12, login throttle IP+email hash, email normalisation, filter allowlist, ZIP upload limits, download sha256 integrity + audit, verify chain head, HTTP abuse tests; no Tier 3 encryption; local only; mutation-backed tests.
- Produced: settings/middleware/validators/search/download/login changes; tests in `test_hardening.py` / `test_http_abuse.py`; Next CSP headers; `pytest` 66 passed, 4 skipped; bandit clean; npm audit 0; pip-audit none; mutations on integrity/email/order FAILED (good). Skipped: `__Host-` cookie, SECURE_SSL_REDIRECT, Tier 3 encryption, threaded revoke/download race, local Postgres/ZAP run.
- Wrong: fixture `owned_document` used fake sha256 `"a"*64` so integrity check 500’d legitimate downloads until fixture digest matched `TXT_BYTES` (confirmed by matrix download failures).
- Fixed: conftest stores real sha256; Cache-Control middleware uses setdefault so download can keep `private, no-store`.
- Commit: TODO(you)

## Open items

- TODO(you): review Entries 1–22 wording and fill "Wrong" where still TODO.
- TODO(you): paste commit links for Entries 1–22.
- TODO(you): walk `docs/ROLE_CHECKLIST.md` Manual result column on live site.
- TODO(you): after deploy, record audit `head_seq`/`head_hash` offline; confirm HSTS/CSP in browser; CSP console for violations.
- TODO(you): set Render + Vercel env from README table; migrate + `seed_demo` on Render.
- TODO(you): run Postgres verification (trigger tests + `verify_audit_chain`); set production `NUM_PROXIES=1`.
- TODO(you): paste live Vercel/Render URLs and production seed credentials into README.
- TODO(you): confirm deployed Sign in → role home → grant/revoke → admin audit manually.
- TODO(you): Tier B aggregate endpoints deferred past freeze — add only with matrix tests if needed later.
