# Exploration Report: foundation-v1 — Phase 2 (Repository Setup)

Status: **VERDICT — READY FOR PROPOSE** (repo-setup scope; see "Blocking / deferred decisions")

Date: 2026-09-07
Phase: EXPLORE (workflow `explore.md`). No implementation performed.

---

## 1. Purpose

Explore what must be created to bootstrap the LifeLens repository for Phase 2: `git init`, branch topology, root files, mobile scaffold, backend scaffold, Docker, GitHub Actions, QA/PROD environment separation, and Expo/EAS preparation. Findings are recorded here; nothing was implemented.

## 2. Current Repository State (verified)

| Item | State |
|---|---|
| Git repo | **Not initialized** (no `.git`, `Environment: Is directory a git repo: no`) |
| `mobile/`, `backend/`, `docker/`, `.github/` | **Do not exist** |
| Root `README.md`, `.gitignore` | **Do not exist** |
| `AGENTS.md` | Exists (locked decisions B/C/D applied) |
| `openspec/` + `docs/` | Exists (Phase 1 complete, tracking reconciled) |
| Stray `workspace/` folder | Was removed during this exploration |

Foundation change tracking: `foundation-v1` is `in-progress`, schema `spec-driven`. Phase 1 (Tasks 1–7, docs) now marked complete; Phase 2 (Tasks 8–13) unchecked.

## 3. Applied Decisions (locked by user, recorded in specs)

- **B — Auth** (`auth.md`): Supabase Auth SDK on mobile → Supabase JWT → FastAPI verifies server-side (PyJWT). Guest = Supabase **Anonymous Auth**; no custom device token system. Upgrade/linking → separate `auth-v1` change.
- **C — Scan/AI** (`ai-analysis.md` §1.1, `scan.md`): **synchronous** MVP pipeline (capture → compress → upload → scan_id → analyze). No queues/workers/polling. Bounded timeout + retry. Async only via a future change if a Pixel 6a-class device misses the latency target.
- **D — Repo** (`AGENTS.md`, foundation config `design.md`): single git repo with `mobile/`, `backend/`, `docker/`, `.github/`, `openspec/`, `docs/`. No npm workspaces / Nx / Turborepo. Branches `qa` (default) + `prod`.

## 4. Phase 2 Findings by Area

### 4.1 Git initialization + branch topology
- No repo exists. Initialize git at repo root.
- Topology per AGENTS.md / foundation: long-lived `qa` (default) and `prod` branches. No `main`. Feature branches off `qa`; `prod` protected; all changes flow `qa` → `prod`.
- Create `prod` from `qa` at the same initial commit so histories are parallel; protect `prod` (and ideally `qa`) via GitHub branch protection.
- Default branch **qa** is a natural consequence of the locked model. Recommendation: confirm at REVIEW.

### 4.2 Root files
- `.gitignore`: ignore `node_modules/`, `.expo/`, `.env*` (keep `.env.example`), `*.jks`, `*.keystore`, `google-services.json`, `google-services-dev.json`, `app-dist/`, EAS credentials, `__pycache__/`, `.venv/`, `*.pyc`, `.pytest_cache/`, `.ruff_cache/`, `.mypy_cache/`, `.idea/`, `.vscode/`, `*.log`, local `.env`.
- `README.md`: one-paragraph product blurb (Point → Understand → Act), repo layout, quickstart (backend + mobile), branch/PR model, link to `AGENTS.md`, `openspec/`, `docs/development-workflow.md`.

### 4.3 Mobile scaffold (Expo + EAS)
Research (current, 2026): **Expo SDK 57** (`expo@57.0.18`), React Native 0.86, React 19.2.3.
- Node prerequisite: ≥22.13; **pin Node 24 LTS** in `.tool-versions`/CI.
- Scaffold: `npx create-expo-app@latest mobile --template default@sdk-57` (includes Expo Router + TypeScript — matches `mobile/src` feature layout and `apps/router` goals).
- **EAS**: `eas init` (writes `extra.eas.projectId`), `eas-build-on-success` off; `eas.json` profiles `development`, `preview`, `production`; runtime config via `EXPO_PUBLIC_*` vars; application id `com.lifelens.app`; EAS CLI installed as devDependency so `eas@^latest` is safe.
- Modules implied by specs: `expo-camera`, `expo-image-picker`, `expo-secure-store`, `expo-file-system`, `expo-blur`, `react-native-reanimated`, `expo-haptics`, `expo-navigation-bar`, `expo-splash-screen`, `expo-system-ui`; `react-native-mmkv` or `expo-sqlite` for local history cache (decision at APPLY).
- Direct camera UI decision: **Expo Camera** (managed) is acceptable for MVP; native CameraView only if Expo Camera proves insufficient. `expo-image-picker` covers gallery.

### 4.4 Backend scaffold (FastAPI + Supabase)
Research (current): FastAPI 0.141.1, Pydantic 2.13.5, SQLAlchemy 2.0.52, Python **3.13**.
- Async stack: `asyncpg` against Supabase. Two supported connection modes: Supavisor port **6543** transaction pool requires `statement_cache_size=0` + `prepared_statement_cache_size=0` + `NullPool`; or Postgres port **5432** session mode. Decision for proposal: session mode (5432) recommended for MVP simplicity.
- `supabase-py` 2.31.0 has async support (`acreate_client`) — use async client for admin/anon ops; do **not** mirror service-role keys server-side.
- JWT verification: **PyJWT** (+ JWKS from Supabase `.well-known/jwks.json`); verify `is_anonymous` claim for guest scope. Explicitly avoid `python-jose` (unpatched advisories).
- Migrations: supabase CLI (`supabase db push` / local migrations) recommended over Alembic for a small team.
- Tooling: `ruff` lint, `mypy` types, `pytest` + pytest-asyncio; `uv` recommended as package/venv manager (pip fallback ok). `pyproject.toml` at `backend/`.
- Security: FastAPI middleware rejects requests without valid Bearer JWT; service-role secrets only on server; no CORS wildcard for auth endpoints.

### 4.5 Docker
- Multi-stage backend image: builder (deps install) → runtime (slim Python 3.13), non-root user, only run app; healthcheck endpoint; `docker-compose` for local QA stack (backend + env). Secrets injected via env, never baked.
- Containerized backend serves as deployable unit for any chosen host (see §6).

### 4.6 GitHub Actions
- Files: `ci.yml` (PR + push to qa: lint, mypy, pytest backend; `expo-doctor` + TS check mobile), `build-backend.yml` (build + push Docker image on qa/prod merge + `workflow_dispatch`), `build-mobile.yml` (EAS `preview` on qa, `production` on prod via `expo/expo-github-action` + `EXPO_TOKEN`), `deploy-backend.yml` (**deferred**, see §6).
- Actions pinned: `actions/checkout@v7`, `actions/setup-node@v7` (Node 24), `actions/setup-python@v6` (3.13). Add `concurrency: cancel-in-progress`.
- Secrets via GitHub Environments (qa/prod) — env-scoped; never in repo.

### 4.7 QA/PROD environment separation
- Secrets split: QA and PROD Supabase projects, distinct keys, backend URLs, Google service files. `backend/.env.example` documents keys; actual values injected in CI/CD + local dev.
- Mobile: `EXPO_PUBLIC_API_URL` per EAS profile; QA points at QA backend, PROD at prod backend.
- Verification gate: `openspec/config.yaml` already encodes environments/branches/quality gates for these two tracks.

### 4.8 Expo/EAS prep
- `eas login` + `EXPO_TOKEN` in CI secrets; `eas init` on the scaffolded app to generate `projectId`; install `eas-cli` locally; validate with EAS (dev-build or cloud build at APPLY). Release pipeline itself is `release.md` scope.

## 5. Phase 2 Work Definitions Verdict

Repository-setup work (Tasks 8–13) can be proposed now. Recommended **proposal scope** for a single `repo-setup-v1` change plan.
Explicitly **out of scope** for Phase 2 to keep it non-blocking: production deploy wiring (host-dependent), Google Play signing/EAS cloud builds (release.md phase), Auth/Supabase project provisioning (auth-v1), DB migrations (backend-schema change).

## 6. Blocking / Deferred Decisions (need user input)

1. **Backend deployment host — NOT CHOSEN.** Research surfaced real options with trade-offs and deliberately did not select one: **GCP Cloud Run** (serverless, Autoscaled, low ops, cost at scale), **Render** (simple PaaS, easy previews, VMware-owned), **Fly.io** (global containers, Neon/DVMs), **Railway** (DevEx, add-ons, clear bills), **AWS ECS/Fargate** (if AWS already in play), **Hetzner VPS + Docker** (cheapest, most ops). Proposal is scoped to NOT depend on this; `deploy-backend.yml` design is a separate change. Recommendation: decide before CI/CD phase.
2. **Package/version pins** (low risk, confirm at REVIEW): Node 24 LTS, Python 3.13, npm for mobile, `uv` (or pip) for backend, `qa` as default branch. 
3. **GitHub org/repo hosting** assumed (`.github/` + Actions + branch protection). Needs repo creation on GitHub.
4. EAS/Expo account + `EXPO_TOKEN`, and Supabase QA project — credentials to be created/configured during APPLY, not now.

## 7. Risks / Constraints Noted
- Supavisor asyncpg pitfalls (cache settings) are fatal if unnoticed — bake them into the backend template.
- `python-jose` must not be used; PyJWT policy is a security gate.
- EAS secrets must not be committed; `.gitignore`/`.env.example` discipline from day one.
- Defaulting `qa` (no `main`) deviates from GitHub defaults; branch protection must be configured at repo creation to prevent accidental default-branch drift.

## 8. Next Steps
- **REVIEW this report** (workflow `review.md`): validate scoping + recommendations.
- **PROPOSE** `repo-setup-v1` covering §4.1–§4.5, §4.6 (build/lint/test only), §4.8 (EAS init/validate), with deployment wiring excluded.
- Resolve §6 blocking decision (deploy host) before `deploy-backend.yml` is designed.