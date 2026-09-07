# Design: foundation-v1 — Phase 2 (Repository Setup)

Scope: bootstrap the repository. No product features (auth, scan, AI, monetization, analytics) are implemented here. The full system architecture is defined by the 15 specs in `openspec/specs/` and referenced below; this design describes how the repo is created so that future changes can implement against it.

---

## 1. Goals & Non-Goals

**Goals**
- One git repo with `qa` (default) and `prod` (protected) branches, no `main`.
- Runnable, testable, CI-verifiable scaffolds for `mobile/` and `backend/`.
- Docker image buildable locally; CI lint/type/test on every push.
- QA/PROD secrets isolated by construction.

**Non-Goals**
- Implementing auth, camera/scanning, Gemini, subscriptions, AdMob, Firebase.
- Live production deployment / deploy wiring.
- Supabase provisioning and DB migrations.

---

## 2. System Overview (locked, unchanged from Phase 1)

```
┌─────────────┐        ┌──────────────┐        ┌──────────────┐
│  Mobile App │ ─────▶ │  FastAPI BE  │ ─────▶ │  Supabase    │
│  (Expo RN)  │  HTTPS │  (Render)    │   SQL  │  Postgres    │
└─────────────┘        └──────┬───────┘        └──────────────┘
                              │
                              ▼
                     ┌──────────────┐
                     │  AI Provider │
                     │  (Gemini)    │
                     └──────────────┘
```

**Critical boundaries (locked)**:
- Mobile NEVER calls the AI provider directly; all AI routes through FastAPI.
- Auth: Supabase Auth SDK on mobile → Supabase JWT → FastAPI verifies server-side (PyJWT/JWKS); Guest = Supabase Anonymous Auth; no device tokens.
- Scan/AI: synchronous MVP (capture → compress → upload → analyze) — no queues/polling.
- Backend is authoritative for safety, quota, entitlements.

---

## 3. Repository Layout & Runtime Baseline

```
lifelens/
├── AGENTS.md
├── openspec/                    # specs, changes, workflows (unchanged)
├── docs/                        # development-workflow.md, deployment.md
├── .github/workflows/           # ci.yml, build-backend.yml, build-mobile.yml
├── mobile/                      # Expo app
├── backend/                     # FastAPI app
├── docker/                      # Docker configs
├── .gitignore
├── .tool-versions               # nodejs 24, python 3.13
└── README.md
```

| Runtime | Version | Manager | Where |
|---|---|---|---|
| Node.js | 24 LTS | npm | mobile + GitHub Actions |
| Python | 3.13 | uv | backend + GitHub Actions |
| Expo SDK | 57 | npm | mobile |
| FastAPI | 0.141.x | uv | backend |

Package managers: **npm** for JS (standard Expo workflow), **uv** for Python. No monorepo tooling (no npm workspaces / Nx / Turborepo).

---

## 4. Git & Branch Design

- `git init -b qa` at root. Create initial commit, then `git branch prod` (parallel pointer). Push both; set `qa` as GitHub default branch.
- Protection (applied when the repo is created on GitHub, documented in root README + docs):
  - `prod`: no direct pushes; requires PR + passing checks; `qa` promotable only via PR.
  - `qa`: protected against force-push; feature branches off `qa` merged via PR.
- No `main` branch anywhere (rename/never create).

---

## 5. Root Files

- `.gitignore`: `node_modules/`, `.expo/`, `dist/`, `build/`, `.env*` (keep `*.example`), `!.env.example`, `*.jks`, `*.keystore`, `google-services*.json`, `app-dist/`, `*.p12`, `__pycache__/`, `.venv/`, `.pytest_cache/`, `.ruff_cache/`, `.mypy_cache/`, `.idea/`, `.vscode/`, `*.log`, `.DS_Store`.
- `README.md`: one-paragraph product (Point → Understand → Act), repo layout, quickstart (backend + mobile), branch/PR model, links to AGENTS.md / openspec / docs.
- `.tool-versions`: `nodejs 24`, `python 3.13`.

---

## 6. Mobile Scaffold (Expo + EAS)

- Scaffold: `npx create-expo-app@latest mobile --template default@sdk-57` (Expo Router + TypeScript).
- Enforce `strict: true` in `tsconfig.json`.
- Dependencies: `eas-cli` (dev), plus Expo modules planned for feature phases (installed now as prep, not wired into UI): `expo-camera`, `expo-image-picker`, `expo-secure-store`, `expo-file-system`, `expo-blur`, `expo-splash-screen`, `expo-system-ui`, `react-native-reanimated` (respect reduced-motion per `mobile-ui.md`).
- Additional modules (e.g., `expo-haptics`, `expo-navigation-bar`, local-storage libraries) are installed in the feature change that uses them, not in this foundation change.
- `eas.json` profiles:
  - `development`: local/emulator, dev client.
  - `preview`: installable build for QA, points at QA API.
  - `production`: store-ready, points at PROD API.
- `EXPO_PUBLIC_API_URL` per profile: QA → `https://api-qa.lifelens.app`, PROD → `https://api.lifelens.app` (values finalized at apply/deploy time).
- Application id: Android `com.lifelens.app`, iOS `com.lifelens.app` (bundle).
- `eas init` generates `extra.eas.projectId`; EAS token lives in GitHub secret `EXPO_TOKEN`.
- Verification: `npx expo-doctor`, `npx tsc --noEmit`, `npx expo start` (config-only), `npx eas config` (profile dry-run).

Default tab/placeholder content stays as scaffolded; product screens come in later feature changes.

---

## 7. Backend Scaffold (FastAPI + Supabase-ready)

- `uv init` in `backend/`, Python 3.13, `pyproject.toml`.
- Dependencies: `fastapi`, `uvicorn[standard]`, `pydantic-settings`, `sqlalchemy[asyncio]`, `asyncpg`, `supabase` (async client), `pyjwt`, `httpx`; dev: `ruff`, `mypy`, `pytest`, `pytest-asyncio`.
- Layout:
```
backend/
├── pyproject.toml
├── .env.example
├── app/
│   ├── main.py          # FastAPI app, CORS, /healthz
│   ├── core/config.py   # pydantic-settings from env
│   ├── core/database.py # async engine bootstrap (no schema yet)
│   └── api/health.py    # /healthz (no auth), liveness
└── tests/test_health.py
```
- Database connection: **session mode (port 5432)** recommended for MVP. Supavisor transaction mode (port 6543) documented as the alternative, requiring `statement_cache_size=0` + `prepared_statement_cache_size=0` + `NullPool` on asyncpg. No schema/migrations in this change (Supabase CLI later).
- JWT verification helper is intentionally **not** implemented here — it belongs to `auth-v1`. Design note only: PyJWT + Supabase JWKS, reject `python-jose`.
- Tooling wired: `ruff check`, `mypy`, `pytest` (health test). `uv run` for all.
- Config: `pydantic-settings` reads `APP_ENV`, QA/PROD-specific values via env; `.env.example` documents keys with **no real values**.

---

## 8. Docker Design

- `backend/Dockerfile` (multi-stage):
  - builder: `ghcr.io/astral-sh/uv` + `python:3.13-slim`, `uv sync --no-dev` into virtualenv.
  - runtime: `python:3.13-slim`, non-root user, copy venv + app, `HEALTHCHECK` → `GET /healthz`, start `uvicorn app.main:app`.
- `backend/.dockerignore`, root `docker/` holds shared compose configs:
  - `docker/docker-compose.qa.yml`: backend container + env referencing QA Supabase (no values committed).
- `.github`/GHCR push of the image (see §9) gives Render a ready artifact later.

---

## 9. GitHub Actions

| Workflow | Trigger | Scope |
|---|---|---|
| `ci.yml` | PR + push to qa | backend: `ruff` + `mypy` + `pytest`; mobile: `tsc --noEmit` + `expo-doctor`; gitleaks secret scan |
| `build-backend.yml` | push to qa/prod, `workflow_dispatch` | docker build + push `ghcr.io/lifelens/backend:<sha>` |
| `build-mobile.yml` | push to qa → EAS `preview`; push to prod → EAS `production` | via `expo/expo-github-action` + `EXPO_TOKEN` |

One workflow file handles both branches; the EAS profile is selected by branch condition within the workflow (not two separate workflow files).

Pins/patterns:
- `actions/checkout@v7`, `actions/setup-node@v7` (node 24, cache npm), `actions/setup-python@v6` (python 3.13) + `astral-sh/setup-uv`.
- `concurrency: group/... ; cancel-in-progress: true`.
- Secrets referenced via GitHub **Environments** `qa` / `prod` only; no secrets in workflow files or repo.
- **`deploy-backend.yml` is excluded** from this change (Render deployment = future `deploy-v1`).

---

## 10. QA/PROD Environment Isolation

Per `environments.md` and `openspec/config.yaml`:

| Scope | QA | PROD |
|---|---|---|
| Branch | `qa` | `prod` |
| GitHub Environment | qa | prod |
| Supabase project | lifelens-qa | lifelens-prod |
| API base (mobile profile) | `https://api-qa.lifelens.app` | `https://api.lifelens.app` |
| Image tag | backend:qa-* | backend:prod-* |

- Skeleton `.env.qa.example` / `.env.prod.example` (structure, placeholders) → live values never committed.
- No sharing of secrets across environments; CI reads strictly scoped environments.

---

## 11. Render Deployment Preparation (docs only)

- `docs/deployment.md`: 
  - Render service type (Docker image), region, instance class, autoscaling off for MVP.
  - Start command `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
  - Healthcheck path `/healthz`; outside port 10000 NOT baked (Render injects `$PORT`).
  - Environment variables map (Supabase URL/anon/service-role, Gemini key **later**, `APP_ENV=prod`, CORS origins).
  - Blueprint outline (`render.yaml`) for reproducible deploys, deferred.
  - Note: mobile → `https://api.lifelens.app`; no live deploy in this change.

---

## 12. Developer Tooling

- `.tool-versions` (Node 24, Python 3.13); editors auto-consume.
- Root convenience scripts (documented in README, not a task runner/framework):
  - `npm --prefix mobile run ...`, `uv --directory backend run ...` — check/lint/test short names.
- EditorConfig at root; no IDE-specific files committed.
- No git hooks in this change (PR checks carry the gate).

---

## 13. Security Notes (applies to this change)

- No AI credentials, Supabase service-role keys, EAS tokens, or API keys exist in the repo.
- `.gitignore` excludes all env/credential artifacts; only `.example` files are committed.
- Docker image contains no secrets; all values injected at runtime.
- Backend attaches no CORS wildcard for authenticated routes (health stays open for probes).

---

## 14. Open Questions

- None blocking. Runtime/hosting/package-manager decisions are locked by the user. Exact Render blueprint details and GHCR image name are finalized at apply time (deploy-v1) and documented, not blocking repo setup.