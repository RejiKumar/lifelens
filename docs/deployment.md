# Backend Deployment — Render (MVP)

Render is the MVP hosting target for the LifeLens FastAPI backend.

> **Status: planned, not live.** Phase 2 sets up the Docker image `ghcr.io/lifelens/backend`
> via `build-backend.yml`. Creating the Render service, wiring secrets, and the first real
> deployment are tracked in the future `deploy-v1` change. No production backend is deployed yet.

## Model

- One Render **Web Service (Docker)** per environment: `lifelens-backend-qa` and `lifelens-backend-prod`.
- Both environments are fully isolated: separate services, separate secret sets, separate Supabase projects.
- Image: `ghcr.io/lifelens/backend:<sha>` (pushed by the `Build Backend Image` workflow).
- Render redeploys on push-triggered webhook from the GitHub container registry.

## Start command

The Dockerfile default command honors Render's injected `$PORT`:

```sh
uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
```

Health check: `GET /healthz` → `{"status":"ok","environment":"<app_env>"}`.

## Environment variables

| Variable | QA | PROD | Source |
|---|---|---|---|
| `APP_ENV` | `qa` | `prod` | Config | 
| `DATABASE_URL` | QA Supabase pooler URL | PROD Supabase pooler URL | Supabase project dashboard |
| `SUPABASE_URL` | QA project URL | PROD project URL | Supabase project dashboard |
| `SUPABASE_ANON_KEY` | QA anon key | PROD anon key | Supabase project dashboard |
| `SUPABASE_SERVICE_ROLE_KEY` | QA service role | PROD service role | Supabase project dashboard (server-side only) |
| `CORS_ORIGINS` | `https://api-qa.lifelens.app` | `https://api.lifelens.app` | Config |
| `GEMINI_API_KEY` | QA key | PROD key | Provider console (added in AI phase) |

Every value is injected as a Render secret/`env` value — never committed. Secrets must never be
shared between the QA and PROD services.

> Connect to Supabase via **transaction/pooler mode** (port `5432`) for the default
> `asyncpg` session pool. Supavisor (port `6543`) is supported as an alternative: the engine
> bootstrap in `app/core/database.py` passes the extra kwargs that Supavisor requires.

## Render service (outline — created in deploy-v1)

1. Create per-env GitHub container registry integration and point Render at GitHub.
2. New Web Service → type Docker → image `ghcr.io/lifelens/backend:<sha>`.
3. Set the environment variables from the table above (all as encrypted values).
4. Set the start command above; health check path `/healthz`.
5. Add an HTTPS domain: `api-qa.lifelens.app` (QA), `api.lifelens.app` (PROD).
6. Configure auto-deploy from the registry webhook.
7. Optional: commit a `render.yaml` Blueprint for infrastructure-as-code in deploy-v1.

## Verification

- `/healthz` returns `200` with `environment` matching the deployment env.
- `APP_ENV` mismatch traps (e.g. QA service claiming `prod`) fail the health check review.
- Lint (`ruff`), type checks (`mypy`), and tests (`pytest`) all green in CI before any deploy.
- Changes reach production only through `prod` branch; the `qa` → `prod` promotion path is enforced
  by branch protection (see `README.md`).