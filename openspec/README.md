# OpenSpec for LifeLens

OpenSpec is the specification and workflow system that governs how LifeLens is designed, built, and verified.

## Workflow

Every significant change follows this mandatory cycle:

```
EXPLORE → PROPOSE → REVIEW → APPLY → VERIFY
```

### EXPLORE

Understand the problem before solving it. Search the codebase, read existing specs, gather context, identify constraints and risks. Never skip this phase.

### PROPOSE

Create a concrete plan: design decisions, file changes, API contracts, acceptance criteria. The proposal must be specific enough that another engineer could implement it without guessing.

### REVIEW

Validate the proposal against product specs, engineering specs, security rules, safety rules, and coding conventions. Catch issues before they become bugs.

### APPLY

Implement the approved proposal. Follow existing patterns. Write tests. Run lint and typecheck. Do not deviate from the approved plan without explicit re-approval.

### VERIFY

Run the full verification suite: tests, lint, typecheck, manual validation against acceptance criteria. Document any deviations.

---

## Spec Structure

```
openspec/
├── config.yaml          # Project configuration
├── specs/               # Living specifications
│   ├── product.md       # Product requirements
│   ├── auth.md          # Authentication system
│   ├── scan.md          # Scan flow and camera
│   ├── ai-provider.md   # AI provider architecture
│   ├── ai-analysis.md   # AI analysis output
│   ├── safety.md        # Safety system
│   ├── usage-quota.md   # Usage quota management
│   ├── entitlements.md  # Subscription entitlements
│   ├── storage-privacy.md # Data storage and privacy
│   ├── mobile-ui.md     # Mobile UI/UX system
│   ├── monetization.md  # Ads and billing
│   ├── analytics.md     # Analytics and crash reporting
│   ├── environments.md  # Environment configuration
│   ├── testing.md       # Testing strategy
│   └── release.md       # Release process
├── changes/             # Active change proposals
│   └── foundation-v1/   # Initial foundation change
└── workflows/           # Workflow phase definitions
    ├── explore.md
    ├── propose.md
    ├── review.md
    ├── apply.md
    └── verify.md
```

## Rules

1. Specs are the source of truth. Code implements specs, not the other way around.
2. Changes reference the specs they affect.
3. No spec is modified without a change proposal.
4. The workflow is mandatory for all significant changes.
5. The orchestrator owns final decisions. Subagents advise.
