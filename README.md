# LifeLens

LifeLens is an AI-powered camera utility. Point → Understand → Act: aim at something unfamiliar, upload or pick an image, and LifeLens identifies it in plain language, explains it, and gives safe next steps with follow-up chat — every result saved to history.

## Repository Layout

```
lifelens/
├── AGENTS.md              # Master agent instructions (security, AI, safety, workflow)
├── openspec/              # Specifications, change proposals, workflow definitions
├── docs/                  # Human-readable documentation
├── .github/workflows/     # CI/CD
├── mobile/                # Expo React Native app
├── backend/               # FastAPI service
└── docker/                # Docker configurations
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile | React Native, Expo SDK 57, TypeScript (strict), Expo Router |
| Backend | FastAPI, Python 3.13, uv |
| Database / Auth / Storage | Supabase |
| AI (MVP) | Gemini via backend proxy |
| Hosting (MVP) | Railway |
| Package managers | npm (mobile), uv (backend) |

Runtime versions pinned in `.tool-versions`: Node.js 24, Python 3.13.

## Quickstart

### Backend

```sh
cd backend
uv sync
uv run uvicorn app.main:app --reload
# GET http://localhost:8000/healthz
```

### Mobile

```sh
cd mobile
npm install
npx expo start   # or: npx expo start --android
```

## Branch & PR Model

- `qa` is the **default** development/integration branch. No `main` branch exists. It is a git
  workflow branch only — there are no QA infrastructure, secrets, or services.
- `prod` is the production branch and is **protected**: no direct pushes, PR-only.
- Feature branches are created **off `qa`**; every change is integrated through `qa` before it is
  promoted to production.
- Promotion flow: `feature �+' qa (CI green) �+' prod (PR, review)`. Development, integration, and
  production all use the same single production infrastructure and credentials.

## GitHub Repository Setup Checklist

Performed when the repository is created on GitHub (requires owner access):

1. Create repository, set default branch to `qa`.
2. Branch protection on `prod`: require PR, require status checks to pass, no force-push, no direct pushes.
3. Branch protection on `qa`: prevent force-push to shared history.
4. Create a GitHub **Environment** `prod`; scope secrets to it (never repo-level where avoidable):
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_AI_API_KEY`
5. Add `EXPO_TOKEN` (EAS) and any EAS owner/account secrets used by `build-mobile.yml`.
6. Enable the `ci.yml` status check as required on PRs.

## Documentation

- `AGENTS.md` — mandatory workflow: EXPLORE → PROPOSE → REVIEW → APPLY → VERIFY
- `openspec/` — OpenSpec framework, specs, and active changes
- `docs/development-workflow.md` — full lifecycle guide
- `docs/deployment.md` — Railway deployment plan (deferred to deploy-v1)