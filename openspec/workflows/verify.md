# Workflow: Verify

## Purpose

Verify is the fifth and final phase of the workflow. It confirms the implementation is correct, complete, and safe. Code that has not passed verification is not done.

---

## Input

- The implementation (from the Apply phase)

## Output

- A verification report:
  - Tests run and results
  - Lint/typecheck results
  - Manual validation against acceptance criteria
  - Any deviations documented
  - Final pass/fail status

---

## Steps

### 1. Run the Automated Suite

Run all configured quality gates (from openspec/config.yaml):

- Mobile lint: `npm run lint`
- Mobile typecheck: `npx tsc --noEmit`
- Mobile tests: `npm run test`
- Backend lint: `ruff check .`
- Backend typecheck: `mypy .`
- Backend tests: `pytest`

All must pass. Fix failures found, then re-run.

### 2. Run Relevant Test Categories

Beyond the general suite, run the categories relevant to the change:

- Mobile: unit, component, API, navigation, accessibility, critical E2E
- Backend: unit, API, schema, auth, authorization, quota, entitlement, safety, AI provider mock

Document which categories were run and with what result.

### 3. Validate Against Acceptance Criteria

Go through each acceptance criterion from the proposal and verify it:

- [ ] Criterion 1: PASS/FAIL with evidence
- [ ] Criterion 2: PASS/FAIL with evidence

Evidence = test result, reproduction, or observed behavior. Do not mark PASS on assumption.

### 4. Check Edge Cases

Verify the edge cases identified in the proposal:

- Empty states
- Error states
- Retry behavior
- Boundary values (quota limits, size limits, timeouts)
- Platform differences (Android/iOS where relevant)
- Theme differences (system/light/dark)
- Reduced motion
- Offline behavior

### 5. Check Security and Safety Rules

Re-verify for this change:

- No secrets/keys/credentials committed or logged
- No AI calls from mobile client
- No permanent public URLs
- No raw image data in logs/analytics
- Safety data rendered as received (not modified client-side)
- Entitlement/quota enforced server-side
- RLS / authorization enforced for new data access

### 6. Check Conventions

- Feature-first Clean Architecture respected
- Presentation/domain/data separation maintained
- No business logic in UI
- Every async operation has loading/success/empty/error/retry states
- TypeScript strict mode unaffected
- Python type hints present
- No unrequested comments

### 7. Document Deviations

Any deviation from the proposal (approved or not):
- What was changed and why
- Whether it was re-approved
- Impact on acceptance criteria and specs

### 8. Produce Verification Report

```markdown
## Verification Report: <change-name>

### Quality Gates
- Lint: PASS/FAIL
- Typecheck: PASS/FAIL
- Tests: PASS/FAIL (N passed, M failed)

### Test Categories
- <category>: PASS/FAIL (coverage notes)

### Acceptance Criteria
- [x] Criterion 1 — PASS (evidence)
- [ ] Criterion 2 — FAIL (what failed, why)

### Edge Cases Checked
- <list>

### Security/Safety Review
- <findings>

### Deviations
- <none or list>

### Result
- APPROVED / NOT APPROVED
```

---

## Rules

1. Verification is mandatory. It is never skipped.
2. Automated gates must pass (lint, typecheck, tests).
3. Acceptance criteria must be validated with evidence, not assumption.
4. Security and safety rules are re-checked on every change.
5. Deviations must be documented.
6. NOT APPROVED blocks merge and requires rework.

---

## What Counts as Done

A change is done when:
- [ ] All automated gates pass
- [ ] All acceptance criteria validated PASS
- [ ] Edge cases verified
- [ ] Security/safety review clean
- [ ] Deviations documented
- [ ] Verification report written

---

## Common Mistakes

- Marking PASS without running the check
- Skipping tests because "the change is small"
- Forgetting security/safety re-verification
- Not testing error paths
- Ignoring a failing acceptance criterion
- Merging code that hasn't passed verification