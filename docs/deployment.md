# Backend Deployment — Railway

Railway hosts the LifeLens FastAPI backend. There are two application/deployment environments
(QA and PROD) that SHARE a single Supabase project and a single Gemini key/project; they differ
only in configuration values.

> **Status: planned, not live.** Phase 2 sets up the Docker image `ghcr.io/lifelens/backend`
> via `build-backend.yml`. Creating the Railway service, wiring secrets, and the first real
> deployment are tracked in the future `deploy-v1` change. No production backend is deployed yet.

## Model

- One Railway service per environment: `lifelens-backend-qa` and `lifelens-backend-prod`.
- Both environments share the SAME single Supabase project, the SAME single Gemini project, and
  the SAME `GOOGLE_AI_API_KEY`. No separate QA Supabase/Gemini credentials are created or required.
- The environments differ only in configuration (`APP_ENV`, CORS, API URL, logging).
- Deployment uses the Dockerfile build path (`README`/`railway.toml`), which already honors the
  Railway-injected `$PORT` and exposes the `/healthz` health check.
- Railway redeploys on push to the tracked branch.

## Start command

The Dockerfile default command honors Railway's injected `$PORT`:

```sh
uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
```

Health check: `GET /healthz` → `{"status":"ok","environment":"<app_env>"}` (already configured
in `railway.toml`).

## Environment variables

| Variable | QA | PROD | Source |
|---|---|---|---|
| `APP_ENV` | `qa` | `prod` | Config |
| `DATABASE_URL` | shared project pooler URL | shared project pooler URL | Supabase project dashboard |
| `SUPABASE_URL` | shared project URL | shared project URL | Supabase project dashboard |
| `SUPABASE_ANON_KEY` | shared anon key | shared anon key | Supabase project dashboard |
| `SUPABASE_SERVICE_ROLE_KEY` | shared service role | shared service role | Supabase project dashboard (server-side only) |
| `STORAGE_BUCKET` | shared bucket | shared bucket | Supabase project dashboard |
| `CORS_ORIGINS` | `["https://api-qa.lifelens.app"]` | `["https://api.lifelens.app"]` | Config (JSON array — the setting is `list[str]`) |
| `AI_PROVIDER` | `gemini` | `gemini` | Config |
| `AI_MODEL_GEMINI` | `gemini-3.5-flash-lite` | `gemini-3.5-flash-lite` | Config |
| `GOOGLE_AI_API_KEY` | shared prod key | shared prod key | Provider console (server-side only) |

Every value is injected as a Railway variable — never committed. The single `GOOGLE_AI_API_KEY`
is backend-only: never expose it to the mobile client, log it, print it, or commit it.

> Connect to Supabase via **transaction/pooler mode** (port `5432`) for the default
> `asyncpg` session pool. Supavisor (port `6543`) is supported as an alternative: the engine
> bootstrap in `app/core/database.py` passes the extra kwargs that Supavisor requires.

## Railway service (outline — created in deploy-v1)

1. Create a Railway project with two services: `lifelens-backend-qa` and `lifelens-backend-prod`.
2. Attach each service to its Git branch (`qa` / `prod`), builder = Dockerfile (via `railway.toml`).
3. Set the environment variables from the table above (all as Railway variables).
4. Health check `/healthz` (already in `railway.toml`).
5. Add HTTPS domains: `api-qa.lifelens.app` (QA), `api.lifelens.app` (PROD).
6. Configure auto-deploys per branch.

## Mobile build environment (EAS)

The mobile app reads these `EXPO_PUBLIC_*` values at build time (`eas.json` profiles) and runs with
the shared single Supabase project:

| Variable | Value source | Notes |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | `eas.json` profile / local `.env` | QA and PROD API URLs |
| `EXPO_PUBLIC_SUPABASE_URL` | shared Supabase project URL | Same across QA and PROD |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_…` (publishable key) | **Client-safe** by design; same across QA and PROD; never use the service role key here |

- No new Supabase project or credential pair is introduced for mobile — the anon/publishable key is
  the public, client-side key of the single shared project (`environments.md` §3.4).
- The Supabase URL and publishable key are the same for every EAS profile; only `EXPO_PUBLIC_API_URL`
  differs per environment.
- Local development: copy `mobile/.env.example` to `mobile/.env` and fill in the real values. `.env*`
  files are gitignored; templates (`mobile/.env.example`, `.env.qa.example`, `.env.prod.example`) are
  committed with empty values.

## Verification

- `/healthz` returns `200` with `environment` matching the deployment env (`qa`/`prod`).
- `APP_ENV` mismatch traps (e.g. QA service claiming `prod`) fail the health check review.
- Lint (`ruff`), type checks (`mypy`), and tests (`pytest`) all green in CI before any deploy.
- Changes reach production only through `prod` branch; the `qa` → `prod` promotion path is enforced
  by branch protection (see `README.md`). Both environments share the same single project infra.