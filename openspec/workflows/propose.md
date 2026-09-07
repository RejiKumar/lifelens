# Workflow: Propose

## Purpose

Propose is the second phase. It converts the Explore findings into a concrete, reviewable plan. A good proposal is specific enough that another engineer could implement it without guessing.

---

## Input

- The Explore Report (from the Explore phase)

## Output

- A change proposal, written to `openspec/changes/<change-name>/proposal.md`
- A set of design decisions documented in the same folder (design.md)
- A task list (tasks.md) with ordered, verifyable steps

---

## Steps

### 1. Name the Change

- Use kebab-case: `feature-name` or `fix-description`
- Create folder: `openspec/changes/<change-name>/`

### 2. Write the Proposal

Use this structure:

```markdown
# Change: <change-name>

## Summary
<One paragraph: what changes and why>

## Motivation
<Why this change is needed; which product/spec request it fulfills>

## Affected Specs
- <spec.md>: <what aspect is affected>
- (specs that do not change need not be listed)

## Design Decisions
| Decision | Rationale |
|----------|-----------|
| <decision> | <reason> |

## File Changes
<For documentation/planning:
  - openspec/changes/<change-name>/proposal.md (new)
  - openspec/changes/<change-name>/design.md (new)
  - openspec/changes/<change-name>/tasks.md (new)>
<For code:
  - mobile/src/features/.../file.ts (new)
  - backend/app/api/.../file.py (modified)>

## API Changes (if any)
<New or changed endpoints, request/response shapes>

## Data Changes (if any)
<New tables, columns, or migration steps>

## Edge Cases
- <edge case and how it is handled>

## Risks and Mitigations
- <risk>: <mitigation>

## Acceptance Criteria
- [ ] <measurable criterion>
- [ ] <measurable criterion>
```

### 3. Write the Design

For anything beyond a trivial change, write `design.md` covering:

- System context / diagrams
- Component responsibilities
- Data flow
- Interface contracts
- Error handling strategy
- What is explicitly OUT OF SCOPE

### 4. Write the Task List

Write `tasks.md` with ordered tasks. Each task must be:

- Actionable (starts with a verb)
- Concrete enough to implement without re-deciding
- Verifyable (acceptance defined)
- Grouped into phases that stop for review

### 5. Define Acceptance Criteria

Acceptance criteria must be:

- **Measurable**: "the upload endpoint returns 201 with a scan_id"
- **Testable**: "unit tests cover quota exhaustion for all three plans"
- **Observable**: "the Home screen shows a camera button"
- Never vague: "the app should work"

### 6. Document Out-of-Scope Items

Explicitly state what is NOT part of this change. This prevents scope creep and keeps proposals reviewable.

---

## Rules

1. Propose happens only AFTER Explore.
2. A proposal must identify affected specs.
3. A proposal must define acceptance criteria.
4. A proposal must list file changes precisely.
5. The orchestrator reviews/approves the proposal (see Review).
6. Do not write code during Propose.
7. If the proposal requires decisions the user must make, list them as questions instead of guessing.

---

## Proposal Quality Checklist

- [ ] Can another engineer implement this without asking you questions?
- [ ] Are acceptance criteria testable/observable?
- [ ] Are all affected files listed?
- [ ] Are edge cases covered?
- [ ] Are risks identified with mitigations?
- [ ] Is scope explicitly bounded (including out-of-scope)?
- [ ] Does it conflict with any spec (checked against AGENTS.md priority order)?
- [ ] Does it respect security, AI, and safety rules from AGENTS.md?

---

## Common Mistakes

- Proposing vague scope ("improve the camera")
- Missing acceptance criteria
- Skipping edge case analysis
- Ignoring existing patterns
- Including out-of-scope work (scope creep)
- Proposing without an Explore report