# TrustVault

Secure document-sharing for a hiring challenge: grants, revoke-now, append-only audit.

## Stack

- **Frontend:** Next.js (App Router, TypeScript) in `frontend/`
- **Backend:** Django + Django REST Framework in `backend/`
- **Database:** PostgreSQL in production; SQLite OK for local API tests

## Live URLs

| What | URL |
|------|-----|
| Frontend (Vercel) | TODO(you): paste |
| Backend (Render) | TODO(you): paste |

## Roles

| Role | Can do |
|------|--------|
| **viewer** | See/download docs they were granted; no upload |
| **owner** | Upload; full control of own docs; grant/revoke |
| **admin** | Users + audit metadata; **not** file bytes without a grant |

## Seed accounts (local `seed_demo`)

Password for all (default; override with env `SEED_DEMO_PASSWORD`): **`DemoPass123!`**

| Email | Role / notes |
|-------|----------------|
| `admin@trustvault.demo` | admin |
| `owner_a@trustvault.demo` | owner (has demo docs) |
| `owner_b@trustvault.demo` | owner (separate docs) |
| `viewer_none@trustvault.demo` | viewer, no grants |
| `viewer_read@trustvault.demo` | read on owner_a notes |
| `viewer_edit@trustvault.demo` | edit on owner_a notes |

Production seed credentials: TODO(you): fill after deploy.

## Local setup

### Backend (Windows PowerShell)

```powershell
cd D:\trustvault\backend
.\.venv\Scripts\Activate.ps1   # or: python -m venv .venv; .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env         # edit SECRET_KEY etc. — never commit .env
python manage.py migrate
python manage.py seed_demo
python manage.py runserver 127.0.0.1:8000
```

### Backend (macOS/Linux)

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python manage.py migrate
python manage.py seed_demo
python manage.py runserver 127.0.0.1:8000
```

### Frontend

```bash
cd frontend
npm install
# optional: set BACKEND_ORIGIN if Django is not on 127.0.0.1:8000
npm run dev
```

Open http://localhost:3000 — Sign in → role home (`/viewer`, `/owner`, or `/admin`). Browser calls go to `/bff/*`, proxied by `frontend/app/bff/[...path]/route.ts` to Django `/api/*` (`BACKEND_ORIGIN`, default `http://127.0.0.1:8000`). Legacy `/api/*` on the Next host returns 410.

Ensure `CSRF_TRUSTED_ORIGINS` includes `http://localhost:3000` (see `.env.example`).

## Tests

```powershell
cd D:\trustvault\backend
.\.venv\Scripts\python.exe -m pytest -q
python manage.py check
python manage.py makemigrations --check
```

```powershell
cd D:\trustvault\frontend
npm run lint
npm run build
```

Postgres-only trigger tests: see `docs` / agent notes — set `DATABASE_URL` to a throwaway local Postgres and re-run pytest (marker `postgres`). Do not point at production.

## Deploy — environment variables (set these in the dashboards)

Empty env = crash or CSRF/login failures. Paste values into **Render → Environment** and **Vercel → Settings → Environment Variables**, then redeploy.

### Render (Web Service: Django)

| Key | Example / value |
|-----|-----------------|
| `SECRET_KEY` | Long random string (not the local `.env` value) |
| `DEBUG` | `False` |
| `ALLOWED_HOSTS` | `your-api.onrender.com` (Render hostname only, no `https://`) |
| `CSRF_TRUSTED_ORIGINS` | `https://your-app.vercel.app` (exact Vercel URL, with `https://`, no trailing slash). Add a second origin comma-separated if you use a custom domain. |
| `DATABASE_URL` | From Render Postgres (**Internal Database URL**). Prefer linking the DB so Render injects this. |
| `NUM_PROXIES` | `1` (Render sits in front of Gunicorn) |
| `SEED_DEMO_PASSWORD` | Optional; default demo password must be ≥12 chars if set |

Suggested service settings:

- Root directory: `backend`
- Build: `pip install -r requirements.txt && python manage.py collectstatic --noinput`
- Start: `gunicorn config.wsgi:application`
- After first deploy (Shell): `python manage.py migrate` then `python manage.py seed_demo`

### Vercel (Next.js)

| Key | Example / value |
|-----|-----------------|
| `BACKEND_ORIGIN` | `https://your-api.onrender.com` (Render URL, `https://`, **no** trailing slash) |

- Root directory: `frontend`
- No other secrets required for the App Router BFF (`/bff/*` → `BACKEND_ORIGIN` + `/api/*`).

Free-tier note: first request after idle can take up to a minute.

## What works / limitations

**Works (API + UI):** login/logout, document list/search/upload (owners), detail/download/delete, grants, admin audit + verify + users.  
**Not built:** 2FA, folders/groups, external sharing links, versions, AI suggestions, at-rest file encryption.  
**UI note:** Hiding admin nav by role is cosmetic; the API enforces `IsAdminRole`.  
**Residual risks:** CSP allows `'unsafe-inline'` scripts (Next); in-flight download after revoke; DB superuser bypasses audit triggers; chain head must be recorded outside the DB from `/api/admin/audit/verify/` (`head_seq` / `head_hash`); free-tier cold starts; direct Render URL still speaks the API.

## Docs

- `docs/API.md` — endpoints  
- `THREATS.md` — threat table  
- `DECISIONS.md` — design choices  
- `docs/SUBMISSION_DRAFT.md` — draft answers with `[VERIFY]` markers  
- `PROMPTS.md` — AI usage log  
