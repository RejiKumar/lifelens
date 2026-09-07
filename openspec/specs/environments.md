# Environments Specification

## 1. Environment Matrix

LifeLens maintains two long-lived application environments: QA and PROD. Each environment is fully isolated in terms of infrastructure, credentials, and release pipeline.

| Aspect | QA | PROD |
|--------|-----|------|
| Branch | qa | prod |
| API URL | api-qa.lifelens.app | api.lifelens.app |
| Supabase | lifelens-qa | lifelens-prod |
| Gemini | test/qa model | production model |
| AdMob | test IDs | production IDs |
| Firebase | lifelens-qa | lifelens-prod |
| Billing | test products | live products |

Additional differences in behavior:

| Aspect | QA | PROD |
|--------|-----|------|
| Signing | EAS preview keystore (or development) | EAS production keystore |
| Crashlytics | qa project | prod project |
| Logging | verbose | minimal |
| Release channel | internal APK | Play Store AAB |
| Database content | synthetic/fixture data | real user data |

No QA build may reference production infrastructure, and no production build may reference QA infrastructure. This isolation is enforced through environment variables injected by the build pipeline.

## 2. Configuration Management

### 2.1 Environment Variables per Environment

Configuration is supplied exclusively through environment variables. There are three variable groups:

1. **Backend environment variables** — read by the FastAPI backend at container startup (e.g., `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `GOOGLE_PROJECT_ID`).
2. **Mobile environment variables** — consumed at build time by Expo/EAS and at runtime via `process.env.EXPO_PUBLIC_*` (e.g., `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_ADMOB_APP_ID`).
3. **Pipeline environment variables** — used only by CI/CD (GitHub Actions secrets) and never bundled into artifacts.

Each environment (QA, PROD) has its own complete set of these variables.

### 2.2 `.env` Files NOT Committed to Git

`.env` files contain real secrets and are excluded from version control. The following files are never committed:

- `.env`
- `.env.local`
- `.env.qa`
- `.env.prod`
- `mobile/.env*` and `backend/.env*`

`.env` and every environment-specific variant are listed in `.gitignore` at both the repository root and within `mobile/` and `backend/` directories. Committing a real secret is treated as a security incident requiring rotation.

### 2.3 `.env.example` with Structure Only

A committed file named `.env.example` (in the repository root, `mobile/`, and `backend/`) documents every variable name with a placeholder value. It contains only the keys and non-secret defaults, never real values. This file serves as the source of truth for required configuration and is kept in sync whenever a new variable is introduced.

### 2.4 CI/CD Injects Correct Env Vars per Branch

The continuous integration pipeline reads environment variables from GitHub Actions secrets based on the branch being built:

- Push/PR to `qa` branch → QA variable set injected.
- Release/tag on `prod` branch → PROD variable set injected.

Variable sets are named distinctly (e.g., `QA_API_URL`, `PROD_API_URL`) to prevent cross-environment leakage. The pipeline is responsible for writing the selected set into the build context and never persists secrets into the repository or build cache.

### 2.5 Runtime Environment Detection

At runtime, the app determines its environment from the injected `EXPO_PUBLIC_APP_ENV` variable (values: `qa`, `prod`). This value gates:

- Analytics project selection (already baked per build)
- Verbose vs. minimal logging
- Whether billing products resolve to test or live SKUs
- Whether Ad SDK uses test or production ad unit IDs

Runtime detection must not be spoofable into upgrading permissions; it is a configuration flag only, not a security boundary.

## 3. Supabase

### 3.1 Separate Projects for QA and PROD

Two isolated Supabase projects exist:

- `lifelens-qa` — used by QA backend and QA builds.
- `lifelens-prod` — used by production backend and production builds.

Projects share no storage, no auth users, and no database instances.

### 3.2 Separate Database Schemas

Each project maintains its own database schema, kept in sync via applied migrations. Migrations are versioned and stored in the repository and applied to each project through the CI/CD pipeline. Schema drift between environments is detectable by a migration checksum check in CI.

### 3.3 Separate Storage Buckets

Storage buckets for uploaded scan images are isolated per project. `lifelens-qa` uses the QA bucket; `lifelens-prod` uses the production bucket. Bucket names are environment-specific to prevent cross-project access:

- QA bucket: `scan-images-qa`
- PROD bucket: `scan-images-prod`

### 3.4 Separate API Keys

Each project exposes distinct API keys (anon key and service role key):

- The anon key is safe to ship in the mobile client and differs per project.
- The service role key is backend-only, stored in the Supabase vault / backend secrets, and is never exposed to the client.

Keys are injected per environment and never shared.

### 3.5 RLS Policies Identical Across Environments

Row-level security (RLS) policies are defined in migrations and applied identically to both QA and PROD projects. The same migration set is applied to both, guaranteeing no policy drift between environments. Any policy change goes through the migration pipeline and is applied to both projects before it can differ.

## 4. Secrets Management

### 4.1 Never Commit Secrets to Version Control

All secrets — API keys, service role keys, OAuth client secrets, AdMob credentials, keystore passwords, Gemini keys — must never appear in committed source or environment example files. This is enforced with a pre-commit secret-scanning hook and a CI secret-scanning step.

### 4.2 GitHub Actions Secrets for CI/CD

All pipeline-injected secrets are stored in GitHub Actions secrets (organization or repository level, scoped per environment). Examples:

- `QA_SUPABASE_SERVICE_ROLE_KEY`, `PROD_SUPABASE_SERVICE_ROLE_KEY`
- `QA_GEMINI_API_KEY`, `PROD_GEMINI_API_KEY`
- `EAS_PROJECT_ID`, `EXPO_TOKEN`

These secrets are referenced by name in workflow files and are never written into the workflow files themselves.

### 4.3 Supabase Vault for Backend Secrets

Backend-only secrets (service role key, Gemini key, Supabase auth configuration) are stored in the Supabase Vault on each project. The FastAPI backend reads these at startup from the vault rather than baking them into container images. This keeps secrets out of Docker layers and repository history.

### 4.4 Expo Secrets for Mobile Builds

Secrets required at mobile build/runtime time (project ID, AdMob app ID, API URLs, Firebase config) are provided through:

- EAS environment variables configured in `eas.json` per profile
- `EXPO_PUBLIC_*` values injected during build

Mobile secrets never live in source control or `.env` files that get committed.

### 4.5 Key Rotation Schedule (Quarterly)

All production secrets are rotated quarterly on a fixed schedule:

1. Rotate Gemini API key.
2. Rotate Supabase service role keys (recreate project-scoped key; update vault).
3. Rotate GitHub Actions secrets that depend on the rotated keys.
4. Rotate EAS/Expo credentials and export/update the new values.
5. Verify QA and PROD functionality after rotation with the smoke test suite.

Rotation is coordinated with the release calendar and performed in QA first, then PROD. All rotated values are invalidated immediately and replaced everywhere before the old values are retired.

## 5. Docker Configuration

### 5.1 Dockerfile for FastAPI Backend

A single production-grade `Dockerfile` in `backend/` builds the FastAPI service image.

Requirements:

- Multi-stage build: build/dependency stage + slim runtime stage.
- Non-root runtime user for security.
- `PYTHONUNBUFFERED=1` for logging.
- Install only pinned dependencies via `requirements.txt` (or equivalent lockfile).
- Health check exposed as a dedicated endpoint.
- No secrets baked into the image; all configuration injected at runtime via environment variables.
- Minimal final image size.

### 5.2 docker-compose for Local Development

A `docker-compose.yml` at the repository root (or `backend/`) defines the local development stack. It includes:

- `backend` — FastAPI service built from the local `Dockerfile`.
- A local Postgres instance matching the Supabase schema for offline development (optional, or pointing to QA Supabase).
- Volume mounts for hot-reload of backend source.
- Environment overrides via a local `.env` (never committed).
- Ports exposed for `uvicorn` (e.g., `8000`).

The local compose file uses the QA variable set so developers are never accidentally pointed at production.

### 5.3 Separate docker-compose for QA

A separate `docker-compose.qa.yml` (or profile) defines the QA deployment. It differs from local development by:

- Using built images (not source volumes).
- Pointing at the QA Supabase project and QA API key.
- Using lightweight resource limits.
- Enabling verbose logging for test inspection.
- Wiring the health check into an orchestrator/CI gate.

Production hosting may be a managed container platform rather than compose, but the QA compose file keeps parity for reproducible test environments.

### 5.4 Environment-Specific Configuration

All environment-specific configuration flows into containers strictly through environment variables defined in the relevant compose file or orchestrator. The backend validates at startup that required variables are present and fails fast with a clear message if any are missing. Configuration differences between local, QA, and PROD are exclusively the values of these variables — never code differences.

### 5.5 Health Check Endpoints

The backend exposes a health check endpoint (`/health` or `/healthz`) that returns success status with service metadata (without secrets). The health check verifies:

- Service process is up.
- Database/Supabase connectivity is reachable.
- (Optional) AI provider connectivity is reachable for QA.

The same endpoint is used by local, QA, and PROD orchestrators to drive container restart policies and by CI to gate deployments. It returns a non-2xx status when dependencies are unhealthy.
