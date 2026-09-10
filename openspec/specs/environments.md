# Environments Specification

## 1. Environment Matrix

LifeLens maintains **two application/deployment environments: QA and PROD**. They SHARE the
same single production infrastructure — one Supabase project and one Gemini project with one
`GOOGLE_AI_API_KEY`. No separate QA Supabase project, QA Supabase credentials, QA Gemini
project, or QA Gemini key exist. The two environments differ only in configuration values
(`APP_ENV`, CORS origins, API URL, logging verbosity, build profile), never in infrastructure.

| Aspect | QA | PROD |
|--------|-----|------|
| Branch | qa (development/integration) | prod (protected, PR-only) |
| API URL | api-qa.lifelens.app | api.lifelens.app |
| Supabase project | `lifelens` (shared, single project) | `lifelens` (shared, single project) |
| Gemini project/key | shared production key | shared production key |
| Firebase project | `lifelens` (shared) | `lifelens` (shared) |
| AdMob | test IDs | production IDs |
| Billing | test products | live products |

Behavioral differences:

| Aspect | QA | PROD |
|--------|-----|------|
| Signing | EAS preview keystore | EAS production keystore |
| Crashlytics | shared project | shared project |
| Logging | verbose | minimal |
| Release channel | internal APK | Play Store AAB |
| Database content | same shared production data | same shared production data |

## 2. Configuration Management

### 2.1 Environment Variables

Configuration is supplied exclusively through environment variables. There are three variable groups:

1. **Backend environment variables** — read by the FastAPI backend at container startup (e.g., `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_AI_API_KEY`, `AI_MODEL_GEMINI`).
2. **Mobile environment variables** — consumed at build time by Expo/EAS and at runtime via `process.env.EXPO_PUBLIC_*` (e.g., `EXPO_PUBLIC_API_URL`).
3. **Pipeline environment variables** — used only by CI/CD (GitHub Actions secrets) and never bundled into artifacts.

Each environment (QA, PROD) has its own set of these variables, but both reference the same
single Supabase project and the same single Gemini deployment key.

### 2.2 `.env` Files NOT Committed to Git

`.env` files contain real secrets and are excluded from version control. The following files are never committed:

- `.env`
- `.env.local`
- `.env.qa`
- `.env.prod`
- `mobile/.env*` and `backend/.env*`

The `# Temp` section of the root `.gitignore` also excludes local scratch (e.g. `backend/_e2e/`, `*.pid`). Committing a real secret is treated as a security incident requiring rotation.

### 2.3 `.env.example` with Structure Only

A committed file named `.env.example` (in the repository root, `mobile/`, and `backend/`) documents every variable name with a placeholder value. It contains only the keys and non-secret defaults, never real values. `.env.qa.example` / `.env.prod.example` mirror the same shared configuration values (JSON-array `CORS_ORIGINS`, placeholder secrets). This file serves as the source of truth for required configuration and is kept in sync whenever a new variable is introduced.

### 2.4 CI/CD Injects Env Vars per Branch

The continuous integration pipeline reads environment variables from GitHub Actions secrets scoped per environment:

- Push/PR to `qa` branch → QA variable set injected (same Supabase/Gemini project).
- Release/tag on `prod` branch → PROD variable set injected (same Supabase/Gemini project).

Variable sets are named distinctly (e.g., `QA_CORS_ORIGINS`, `PROD_CORS_ORIGINS`) to prevent cross-environment config leakage. The pipeline is responsible for writing the selected set into the build context and never persists secrets into the repository or build cache.

### 2.5 Runtime Environment Detection

The backend reads `APP_ENV` (values: `qa`, `prod`) and reports it via `/healthz`. The mobile app reads `EXPO_PUBLIC_APP_ENV` at build/runtime for logging verbosity and provider selection. Runtime detection is a configuration flag only, not a security boundary.

## 3. Supabase — Single Shared Project

### 3.1 One Project for All Environments

There is exactly **one** Supabase project: `lifelens`. QA and PROD environments both connect to
it. Under no circumstances are additional Supabase projects created for QA or any other
environment.

### 3.2 Database Schema

The schema is maintained via versioned migrations in the repository. Migrations are applied to the single project through CI/CD. Schema drift is detectable by a migration checksum check in CI.

### 3.3 Storage Bucket

Uploaded scan images live in a private bucket (`scan-images`). Images are private by default; only signed, short-lived URLs are ever exposed.

### 3.4 API Keys

- The anon key is safe to ship in the mobile client.
- The service role key is backend-only, stored in the Supabase vault / backend secrets, and never exposed to the client.

QA does NOT use a different credential pair — the same project credentials are shared.

### 3.5 RLS Policies

Row-level security (RLS) policies are defined in migrations and enforced on the shared project.

## 4. Secrets Management

### 4.1 Never Commit Secrets to Version Control

All secrets — API keys, service role keys, OAuth client secrets, AdMob credentials, keystore passwords, Gemini keys — must never appear in committed source or environment example files. This is enforced with a pre-commit secret-scanning hook and a CI secret-scanning step.

### 4.2 Single Gemini Deployment Key

There is exactly one `GOOGLE_AI_API_KEY` (one Google AI Studio/Gemini project). It is
backend-only: it must never be exposed to the mobile client, logged, committed, or printed.
Both QA (with `AI_PROVIDER=gemini`) and PROD use this same key.

### 4.3 GitHub Actions Secrets for CI/CD

All pipeline-injected secrets are stored in GitHub Actions secrets scoped per environment. Examples:

- `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_AI_API_KEY`
- `EAS_PROJECT_ID`, `EXPO_TOKEN`

These secrets are referenced by name in workflow files and never written into the workflow files themselves.

### 4.4 Supabase Vault for Backend Secrets

Backend-only secrets (service role key, Gemini key, Supabase auth configuration) are stored in the Supabase Vault. The FastAPI backend reads these at startup from the vault rather than baking them into container images, keeping secrets out of Docker layers and repository history.

### 4.5 Expo Secrets for Mobile Builds

Secrets required at mobile build/runtime time (project ID, AdMob app ID, API URLs, Firebase config) are provided through EAS environment variables configured in `eas.json` per profile and `EXPO_PUBLIC_*` values injected during build. Mobile secrets never live in source control.

### 4.6 Key Rotation Schedule (Quarterly)

All shared production secrets are rotated quarterly on a fixed schedule:

1. Rotate the single Gemini API key.
2. Rotate Supabase service role keys (recreate project-scoped key; update vault).
3. Rotate GitHub Actions secrets that depend on the rotated keys.
4. Rotate EAS/Expo credentials and export/update the new values.
5. Verify QA and PROD functionality after rotation with the smoke test suite.

Rotation is coordinated with the release calendar. All rotated values are invalidated immediately and replaced everywhere before the old values are retired.

## 5. Docker Configuration

### 5.1 Dockerfile for FastAPI Backend

A single production-grade `Dockerfile` in `backend/` builds the FastAPI service image.

Requirements:

- Multi-stage build: build/dependency stage + slim runtime stage.
- Non-root runtime user for security.
- `PYTHONUNBUFFERED=1` for logging.
- Install only pinned dependencies.
- Health check exposed as a dedicated endpoint.
- No secrets baked into the image; all configuration injected at runtime via environment variables.
- Minimal final image size.

### 5.2 docker-compose for Local Development

`docker/docker-compose.qa.yml` defines the local development stack (built from the local
`Dockerfile`); it runs the backend with `APP_ENV=qa` and the same shared single-project config.
It includes:

- `backend` — FastAPI service built from the local `Dockerfile`.
- A local Postgres instance for offline development (optional).
- Volume mounts for hot-reload of backend source.
- Environment overrides via a local `.env` (never committed).
- Ports exposed for `uvicorn` (e.g., `8000`).

Local developers run with `AI_PROVIDER=stub` by default (no key required) and reach the shared
production Supabase project only when explicit local `.env` values are provided.

### 5.3 Environment-Specific Configuration

All environment-specific configuration flows into containers strictly through environment variables. The backend validates at startup that required variables are present and fails fast with a clear message if any are missing. Configuration differences between QA and PROD are exclusively the values of these variables — never code differences and never different projects.

### 5.4 Health Check Endpoints

The backend exposes a health check endpoint (`/healthz`) that returns success status with service metadata (without secrets):

- Service process is up.
- Database/Supabase connectivity is reachable.
- (Optional) AI provider connectivity.

The same endpoint is used by QA and PROD orchestrators to drive container restart policies and by CI to gate deployments. It returns a non-2xx status when dependencies are unhealthy.