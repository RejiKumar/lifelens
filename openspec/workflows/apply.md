# Workflow: Apply

## Purpose

Apply is the fourth phase. It implements the approved proposal. Apply is deterministic: the code follows the proposal, not the implementer's preference. Deviations require re-approval.

---

## Input

- An approved proposal (from the Review phase)

## Output

- Working code that implements the proposal
- Tests for the new behavior
- Updates to affected specs (if the proposal changes a spec)
- Passing lint and typecheck

---

## Steps

### 1. Confirm Approval

- Ensure the proposal passed Review
- If it was revised, re-read the revised version
- If any part is unclear, stop and ask (never invent behavior)

### 2. Set Up

- Create a feature branch from `qa`: `feat/<change-name>`
- Read the relevant files before editing
- Read neighboring code to match conventions
- Check which libraries are already in the project

### 3. Implement

- Follow the proposal exactly
- Follow existing code patterns and conventions
- Create files in their planned locations
- Do NOT add comments unless requested
- Use TypeScript strict mode (mobile) and Python type hints (backend)

### 4. Write Tests Alongside Implementation

- Unit tests for new logic
- Component/API tests where applicable
- Tests for error paths (not just happy paths)
- Tests for acceptance criteria where testable

### 5. Respect the Architecture

- Feature-first Clean Architecture on mobile (presentation/domain/data per feature)
- Layered separation on backend (api/schemas/services/repositories/providers/policies)
- UI must not contain business logic
- Business logic must not live in presentation

### 6. Handle Async/States

Every async operation must have:
- Loading state
- Success state
- Empty state (when applicable)
- Error state with retry
- No unexplained infinite loaders

### 7. Follow Security, AI, and Safety Rules

During implementation, verify:
- No AI keys or credentials on the mobile client
- No AI calls from the mobile client (all via backend)
- No logging of passwords, tokens, or OAuth secrets
- No permanent public image URLs
- Safety warnings persisted and rendered as received
- Quota/entitlement decisions server-side only

### 8. Run Quality Gates as You Go

After each significant unit of work:
- Lint (mobile: `npm run lint`, backend: `ruff check .`)
- Typecheck (mobile: `npx tsc --noEmit`, backend: `mypy .`)
- Focused tests for what you just wrote

### 9. Do Not Deviate

If implementation reveals that the proposal is wrong:
- STOP
- Document the problem and the proposed deviation
- Return to Propose/Review for re-approval
- Never silently change the design

---

## Rules

1. Apply follows an approved proposal only.
2. Follow existing conventions (patterns, libraries, naming).
3. Write tests alongside code.
4. Run lint and typecheck after changes.
5. No comments unless explicitly requested.
6. No secrets, credentials, or API keys in code or commits.
7. Stop on deviation from the proposal; get re-approval first.

---

## Apply Completion Checklist

- [ ] All planned files created/modified
- [ ] Acceptance criteria implemented
- [ ] Tests written for new behavior and error paths
- [ ] Lint passes
- [ ] Typecheck passes
- [ ] No secrets committed
- [ ] No deviation from proposal without re-approval
- [ ] Specs updated if the proposal included spec changes

---

## Common Mistakes

- Silently changing the design mid-implementation
- Skipping tests to save time
- Adding unrequested comments or features
- Introducing a new library when an existing one works
- Logging sensitive data during debugging
- Only handling the happy path