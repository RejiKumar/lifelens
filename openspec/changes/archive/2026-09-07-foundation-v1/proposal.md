# Change: foundation-v1

## Why

Phase 1 delivered the complete documentation foundation (AGENTS.md, 15 specs, workflows, config). The project is still an empty folder — there is no git repository, no `mobile/`, no `backend/`, no CI, and no runnable code. Phase 2 bootstraps the repository so the product features (auth, scan, AI analysis, monetization) have a place to be implemented against a working, testable foundation.

## What Changes

- **Git repository**: initialize one repo at the project root. Branches `qa` (default) and `prod` only — **no `main`**. `prod` protected.
- **Root files**: `.gitignore`, `README.md` (product blurb + repo layout + quickstart + branch/PR model).
- **Mobile scaffold**: `mobile/` Expo app via `create-expo-app --template default@sdk-57` (Expo Router + TypeScript strict). EAS preparation: `eas init`, `eas.json` with `development` / `preview` / `production` profiles, `com.lifelens.app` application id, `EXPO_PUBLIC_API_URL` per profile.
- **Backend scaffold**: `backend/` FastAPI app on **Python 3.13** managed with **uv** (FastAPI, uvicorn, pydantic-settings, SQLAlchemy async + asyncpg, supabase-py, PyJWT), `/healthz` endpoint, config via environment, lint/type/test tooling wired (ruff, mypy, pytest).
- **Docker**: multi-stage backend image (slim, non-root, healthcheck), `.dockerignore`, `docker-compose` for local QA.
- **GitHub Actions**: `ci.yml` (PR/push lint+type+test), `build-backend.yml` (build + push image to GHCR on qa/prod), `build-mobile.yml` (EAS `preview` for qa, `production` for prod). GitHub Environments `qa` / `prod` for secrets. Pinned action versions, concurrency cancellation.
- **QA/PROD environment separation**: per-environment configuration skeletons (`.env.example` family, profile-level mobile vars), document that secrets live only in GitHub Environments / EAS / Supabase and are never committed.
- **Render deployment preparation (documentation only)**: `docs/deployment.md` with the Render plan (runtime, start command, healthcheck, env mapping, Blueprint outline). **No live deployment in this change.**
- **Basic development tooling**: pinned runtimes (Node 24, Python 3.13), editor config, root dev scripts.

## Capabilities

### New Capabilities
None. This change creates infrastructure and tooling only. No product behavior changes; the existing 15 specs in `openspec/specs/` already define all product behavior. Change sets `skip_specs: true` (see `.openspec.yaml`).

### Modified Capabilities
None. Spec-level requirements do not change in this phase.

## Impact

- **New directories**: `mobile/`, `backend/`, `docker/`, `.github/`, plus root `README.md`, `.gitignore`, `.tool-versions`.
- **New tooling**: git, npm (Node 24), uv (Python 3.13), ruff/mypy/pytest, Expo CLI + EAS, Docker, GitHub Actions.
- **No product features**: no authentication, camera/scanning, Gemini, subscriptions, AdMob, or Firebase code. Nothing behind an endpoint beyond `/healthz`.
- **No credentials created or committed**; secret values are introduced later by the consuming changes (auth-v1, etc.).
- Existing specs, workflows, and config are authoritative and unchanged.

## Decisions Made (locked 2026-09-07)

| Decision | Value |
|----------|-------|
| MVP backend hosting | **Render** (no AWS, K8s, Fly.io, Railway, Cloud Run for MVP; abstraction kept swappable) |
| Node.js runtime | **24** |
| Python runtime | **3.13** |
| Python package manager | **uv** |
| JS package manager | **npm** (standard Expo workflow) |
| Default/dev branch | `qa` |
| Production branch | `prod` (protected) |
| `main` branch | **Not used** |
| QA/PROD isolation | Complete separation of secrets/config; no shared infra (per `environments.md`) |
| Scan pipeline | Synchronous MVP (see `ai-analysis.md` §1.1) |
| Auth architecture | Supabase Auth SDK → JWT → FastAPI server-side verify; Anonymous Auth for Guest (see `auth.md` §0) |

## Out of Scope (explicitly not implemented now)

- Authentication, camera/scanning, AI/Gemini, subscriptions/entitlements, AdMob, Firebase analytics
- Supabase schema migrations and project provisioning
- Live production deployment and `deploy-backend.yml` wiring (future `deploy-v1` change, depends on Render docs)
- App feature screens beyond the scaffold placeholder

## Acceptance Criteria

- [ ] Git repo initialized; `qa` default, `prod` exists and is noted protected; no `main`
- [ ] `mobile/` scaffold builds and passes `expo-doctor` + `tsc --noEmit`; EAS config present
- [ ] `backend/` scaffold passes `ruff check`, `mypy`, `pytest` (health endpoint test green)
- [ ] Docker image builds; `/healthz` responds from container
- [ ] GitHub Actions files present; CI green on repository host (verified at APPLY on GitHub)
- [ ] No secrets, credentials, or API keys anywhere in the repo
- [ ] CI includes a secret-scanning step; pre-commit secret-scanning hook configured (per `environments.md`)
- [ ] QA/PROD configuration skeletons present and mutually isolated
- [ ] Render deployment documented in `docs/deployment.md` (no live deployment)