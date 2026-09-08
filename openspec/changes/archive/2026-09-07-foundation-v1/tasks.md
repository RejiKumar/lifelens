# Tasks: foundation-v1

## Phase 1: Documentation Foundation (complete)

### Task 1: Create AGENTS.md
- [x] Write master instruction file
- [x] Include: mission, tech stack, security rules, AI rules, safety rules, coding rules, subagent rules, mandatory workflow, version control
- [x] File: `AGENTS.md`

### Task 2: Create OpenSpec configuration
- [x] Write `openspec/README.md` explaining EXPLORE → PROPOSE → REVIEW → APPLY → VERIFY
- [x] Write `openspec/config.yaml` with project config, environments, branches, quality gates, security rules, testing definitions
- [x] Files: `openspec/README.md`, `openspec/config.yaml`

### Task 3: Create product and architecture specs
- [x] Write `product.md` (vision, screens, roles, metrics)
- [x] Write `auth.md` (guest/email/google, server enforcement, endpoints)
- [x] Write `scan.md` (camera, gallery, image pipeline, upload, endpoints)
- [x] Files in `openspec/specs/`

### Task 4: Create AI, safety, and data specs
- [x] Write `ai-provider.md` (interface, Gemini, OpenAI future, errors, timeouts)
- [x] Write `ai-analysis.md` (schema, validation pipeline, follow-up chat)
- [x] Write `safety.md` (risk levels, categories, warning injection, filtering)
- [x] Write `usage-quota.md` (plans, enforcement, concurrency, rewarded bonuses)
- [x] Write `entitlements.md` (purchase flow, verification, management)
- [x] Write `storage-privacy.md` (data model, image storage, deletion, GDPR)
- [x] Files in `openspec/specs/`

### Task 5: Create UX, business, and release specs
- [x] Write `mobile-ui.md` (themes, visual direction, components, navigation)
- [x] Write `monetization.md` (AdMob, billing, conversion, protection)
- [x] Write `analytics.md` (events, Crashlytics, privacy)
- [x] Write `environments.md` (QA/PROD isolation, config, secrets)
- [x] Write `testing.md` (mobile + backend test strategy)
- [x] Write `release.md` (EAS, Play Store, listing requirements)
- [x] Write `docs/development-workflow.md` (human-readable lifecycle)
- [x] Files in `openspec/specs/` and `docs/`

### Task 6: Create workflow definitions
- [x] Write `explore.md` (how Explore works)
- [x] Write `propose.md` (how Propose works)
- [x] Write `review.md` (how Review works)
- [x] Write `apply.md` (how Apply works)
- [x] Write `verify.md` (how Verify works)
- [x] Files in `openspec/workflows/`

### Task 7: Create foundation change records
- [x] Write `foundation-v1/proposal.md` (why foundation exists)
- [x] Write `foundation-v1/design.md` (system architecture)
- [x] Write `foundation-v1/tasks.md` (this file)
- [x] Files in `openspec/changes/foundation-v1/`

---

## Phase 2: Repository Setup (this phase)

> No product features (auth, scan, Gemini, subscriptions, AdMob, Firebase) are implemented. One repo, `qa` default + `prod` protected, no `main`.

### Task 8: Git repository and branches

- [x] 8.1 Initialize git repo at project root with `git init -b qa`
- [x] 8.2 Create initial commit, then `git branch prod` (parallel pointer)
- [x] 8.3 Verify `qa` is the default branch and no `main` exists
- [x] 8.4 Document (root README) protection rules: `prod` PR-only, `qa` protected, feature branches off `qa`

### Task 9: Root files and development tooling

- [x] 9.1 Create root `.gitignore` (node_modules, .expo, .env*, keys, caches, IDE files)
- [x] 9.2 Create root `README.md` (product blurb, repo layout, quickstart, branch/PR model)
- [x] 9.3 Create `.tool-versions` (nodejs 24, python 3.13)
- [x] 9.4 Add EditorConfig at repository root
- [x] 9.5 Verify toolchain from a clean shell: `node -v` → 24, `python3 --version` → 3.13, `uv --version`, `npm -v`
- [x] 9.6 Add a pre-commit secret-scanning hook (e.g., gitleaks) to enforce the environments.md gate locally
- [x] 9.7 Confirm no secrets/keys present in any committed file

### Task 10: Mobile Expo scaffold

- [x] 10.1 Scaffold `mobile/` with `npx create-expo-app@latest mobile --template default@sdk-57`
- [x] 10.2 Confirm Expo Router present and `tsconfig.json` has `strict: true`
- [x] 10.3 Keep `eas-cli` OUT of the app manifest (`expo-doctor` requires it absent); EAS CLI is provided in CI by `expo/expo-github-action` (`eas-version: latest`), and locally via `npx eas`
- [x] 10.4 Add planned Expo modules as prep: expo-camera, expo-image-picker, expo-secure-store, expo-file-system, expo-blur, expo-splash-screen, expo-system-ui, react-native-reanimated
- [x] 10.5 Run `eas init` to register the project and store `extra.eas.projectId`
- [x] 10.6 Create `eas.json` with profiles: development, preview, production
- [x] 10.7 Set application id `com.lifelens.app` (Android package + iOS bundle)
- [x] 10.8 Configure `EXPO_PUBLIC_API_URL` per profile: QA → `https://api-qa.lifelens.app`, PROD → `https://api.lifelens.app`
- [x] 10.9 Verify: `npx expo-doctor` passes, `npx tsc --noEmit` passes
- [x] 10.10 Verify `npx expo start` boots scaffold (config-only; feature screens are out of scope)

### Task 11: Backend FastAPI scaffold

- [x] 11.1 Create `backend/` with `uv init` on Python 3.13
- [x] 11.2 Add dependencies: fastapi, uvicorn[standard], pydantic-settings, sqlalchemy[asyncio], asyncpg, supabase, pyjwt, httpx
- [x] 11.3 Add dev dependencies: ruff, mypy, pytest, pytest-asyncio
- [x] 11.4 Create `backend/app/main.py` (FastAPI app, CORS config, `/healthz`) and `app/api/health.py`
- [x] 11.5 Create `app/core/config.py` using pydantic-settings (env-driven, includes `APP_ENV`)
- [x] 11.6 Create `app/core/database.py` async engine bootstrap (session mode, port 5432; Supavisor 6543 documented as alternative)
- [x] 11.7 Add `.env.example` / `.env.qa.example` / `.env.prod.example` with placeholder keys only
- [x] 11.8 Write `tests/test_health.py`; ensure `pytest` green
- [x] 11.9 Ensure `ruff check` and `mypy` pass on `backend/`
- [x] 11.10 Confirm auth/Gemini/scan endpoints are NOT implemented (JWT verify deferred to auth-v1)

### Task 12: Docker

- [x] 12.1 Write `backend/Dockerfile` (multi-stage: uv builder → python:3.13-slim runtime, non-root, healthcheck on `/healthz`)
- [x] 12.2 Write `backend/.dockerignore`
- [x] 12.3 Add `docker/docker-compose.qa.yml` for local QA backend (env references QA Supabase, no values)
- [x] 12.4 Build image locally and smoke-test `/healthz` from the container — HTTP 200, `{"status":"ok","environment":"configured"}`; non-root (`lifelens`), `$PORT` CMD, HEALTHCHECK verified; test container removed, image `lifelens/backend:test` kept

### Task 13: GitHub Actions

- [x] 13.1 Write `.github/workflows/ci.yml` (PR + push to qa: backend ruff/mypy/pytest; mobile tsc + expo-doctor; gitleaks secret scan)
- [x] 13.2 Write `.github/workflows/build-backend.yml` (docker build + push `ghcr.io/lifelens/backend:<sha>` on qa/prod + workflow_dispatch)
- [x] 13.3 Write `.github/workflows/build-mobile.yml` (EAS `preview` on qa, `production` on prod via expo/expo-github-action + `EXPO_TOKEN`)
- [x] 13.4 Pin actions: checkout@v7, setup-node@v7 (node 24), setup-python@v6 (3.13) + astral-sh/setup-uv@v10
- [x] 13.5 Scope secrets via GitHub Environments `qa` / `prod` only; `concurrency` with cancel-in-progress
- [x] 13.6 Document in README the GitHub repo creation checklist (branches, protections, Environments, `EXPO_TOKEN`)
- [x] 13.7 Confirm no `deploy-backend.yml` is created (Render deployment is a future deploy-v1 change)
- [x] 13.8 Add a CI secret-scanning step to `ci.yml` that fails the build on detected secrets (per `environments.md`)

### Task 14: QA/PROD environment configuration

- [x] 14.1 Validate `.env.qa.example` and `.env.prod.example` are structurally distinct with no shared values
- [x] 14.2 Grep repo for secrets/keys/tokens (AGENTS.md security gate) — none found
- [x] 14.3 Document promotion rules: feature → qa (CI) → prod (PR); prod protected

### Task 15: Render deployment documentation

- [x] 15.1 Write `docs/deployment.md` (Render Docker image service, `$PORT` start command, `/healthz`, env var map, Blueprint outline)
- [x] 15.2 Note explicitly that live deployment and `render.yaml` are deferred to deploy-v1

---

**Phase 2 Completion**: Repository setup complete and CI-verifiable. STOP. Report and await next phase approval (features via separate changes).