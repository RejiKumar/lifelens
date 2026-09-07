# LifeLens - Agent Instructions

## Mission

LifeLens is an AI-powered camera utility. The core experience is:

**Point → Understand → Act**

A user points their camera at something unfamiliar, uploads an image, or selects from gallery. LifeLens uses AI to identify what they are looking at, explain it in simple language, provide useful and safe next steps, allow follow-up questions, and save results to history.

This is NOT a generic AI chatbot. The camera/visual understanding experience is the primary product.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile | React Native, Expo, TypeScript, Expo Router |
| Architecture | Feature-first Clean Architecture |
| Backend | FastAPI, Python, Pydantic, SQLAlchemy |
| Database | Supabase PostgreSQL |
| Storage | Supabase Storage |
| AI (MVP) | Gemini via backend proxy |
| Auth | Supabase Auth (Guest, Email, Google) |
| Analytics | Firebase Analytics |
| Crashes | Firebase Crashlytics |
| Ads | Google AdMob |
| Billing | Google Play Billing |
| Build | Expo EAS |
| CI/CD | GitHub Actions |
| Containers | Docker |
| Environments | QA, PROD |

---

## Security Rules

1. AI credentials NEVER exist on the mobile client.
2. All AI requests go through FastAPI backend.
3. Authentication and authorization enforced server-side.
4. Never log passwords, access tokens, refresh tokens, or OAuth secrets.
5. Never commit secrets to version control.
6. Never expose permanent public image URLs.
7. Never trust client-provided quota or entitlement data.
8. Backend is authoritative for all entitlement decisions.
9. Images are private by default.
10. Never send raw images to analytics or logs.

---

## AI Rules

1. Mobile app NEVER calls Gemini or OpenAI directly.
2. All AI requests route through FastAPI.
3. AI responses MUST be structured (parsed, validated, normalized).
4. Invalid AI responses are rejected, never presented to the user.
5. Provider-specific errors are converted to internal error categories.
6. AI calls have bounded timeout and bounded retry.
7. AI logging must not include sensitive content.
8. Provider architecture: `AIProvider` interface → `GeminiProvider` → future `OpenAIProvider`.
9. Provider changes must NOT require rewriting mobile UI, API contracts, or business logic.

---

## Safety Rules

Risk levels: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`

Categories: electrical, fire, gas, chemical, medical, structural, vehicle, hazardous substances, legal/financial.

1. Backend safety policy is authoritative. Client-side safety logic is NEVER the final authority.
2. High-risk and critical situations use conservative language.
3. No dangerous procedural instructions.
4. Medical visual analysis is never presented as a medical diagnosis.
5. Safety warnings are displayed prominently and cannot be dismissed silently.
6. AI analysis results include risk_level and safety flags before persistence.

---

## Coding Rules

1. Feature-first Clean Architecture: `presentation/`, `domain/`, `data/` per feature.
2. UI must not contain business logic.
3. Every async operation must have loading, success, empty, error, and retry states.
4. Never display an unexplained infinite loader.
5. Prefer existing libraries already in the project.
6. Follow existing code conventions and patterns.
7. TypeScript strict mode.
8. Python type hints on all functions.
9. Pydantic models for all API schemas.
10. No comments unless explicitly requested.
11. Accessibility must be considered in all UI components.
12. Support reduced motion preferences.
13. Support system, light, and dark themes (system is default).

---

## Subagent Rules

Use subagents to parallelize work. Available roles:

- **Product Analyst**: Requirements analysis, user stories, acceptance criteria
- **UX/UI Analyst**: Design system, component specs, interaction patterns
- **Mobile Architect**: React Native architecture, navigation, state management
- **React Native Engineer**: Component implementation, hooks, screens
- **Backend Engineer**: API endpoints, services, repositories
- **Database Engineer**: Schema design, migrations, queries
- **AI Engineer**: Provider integration, prompt engineering, structured output
- **Security Engineer**: Auth flows, token handling, data protection
- **QA Engineer**: Test plans, test cases, automation
- **DevOps Engineer**: CI/CD, Docker, deployment pipelines
- **Performance Engineer**: Profiling, optimization, memory management
- **Release Engineer**: Store submission, signing, versioning

Rules:
- Main orchestrator owns final architecture, contracts, integration, conflict resolution, verification.
- Subagents must not silently redefine requirements.
- Subagents must report back with clear outputs, not assumptions.
- Subagents must not commit code without orchestrator approval.

---

## Mandatory Workflow

Every significant change MUST follow this workflow. No exceptions.

```
EXPLORE → PROPOSE → REVIEW → APPLY → VERIFY
```

1. **EXPLORE**: Understand the problem, search codebase, gather context, identify constraints.
2. **PROPOSE**: Create a concrete plan with design decisions, file changes, and acceptance criteria.
3. **REVIEW**: Validate the proposal against specs, conventions, and security rules.
4. **APPLY**: Implement the changes following the approved proposal.
5. **VERIFY**: Run tests, lint, typecheck, and validate against acceptance criteria.

Never skip Explore. Never jump from user request to implementation.

---

## Project Structure

```
lifelens/                        # Single git repository (no monorepo tooling)
├── AGENTS.md                    # This file
├── openspec/                    # OpenSpec workflow and specifications
│   ├── README.md
│   ├── config.yaml
│   ├── specs/                   # Product and engineering specifications
│   ├── changes/                 # Active change proposals
│   └── workflows/               # Workflow definitions
├── docs/                        # Human-readable documentation
├── .github/                     # GitHub Actions workflows (CI/CD)
├── mobile/                      # Expo React Native app (created later)
├── backend/                     # FastAPI application (created later)
├── docker/                      # Docker configurations (created later)
└── .gitignore                   # Ignore rules at repo root
```

Repository model: one git repo; branches `qa` (default) and `prod`; feature branches off `qa`. No npm workspaces, Nx, or Turborepo.

---

## Priority Order

When conflicts arise between specifications, the priority order is:

1. Safety (user safety is non-negotiable)
2. Security (data protection and auth)
3. Privacy (user data handling)
4. UX (user experience quality)
5. Performance (app responsiveness)
6. Architecture (code organization)
7. Features (functionality scope)

---

## Version Control

- Branches: `qa`, `prod`
- Feature branches off `qa`
- No direct commits to `prod`
- All changes pass through QA before production
- Never commit secrets, credentials, or API keys
