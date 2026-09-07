# Workflow: Explore

## Purpose

Explore is the first phase of every significant change. It builds understanding before any plan is written or code is changed. It is mandatory. Never skip Explore.

---

## Input

- A feature request, bug report, or change request (from a user, stakeholder, or spec)

## Output

- A context summary that includes:
  - What the request actually asks for
  - What exists in the codebase today
  - Which specs are affected
  - Constraints, risks, and dependencies
  - Answers to clarifying questions
  - A recommendation for the Propose phase

---

## Steps

### 1. Restate the Request

- Write the request in your own words
- Identify the core problem, not the surface ask
- Note any ambiguity to resolve

### 2. Search the Codebase

- Search for relevant existing code (files, patterns, functions)
- Look for prior implementations or partial attempts
- Find existing utilities or components that can be reused
- Check for naming conventions in the codebase
- Check for existing tests that define expected behavior

### 3. Read Relevant Specs

- Read the applicable spec(s) in `openspec/specs/`
- Check `openspec/changes/` for related active or archived changes
- Note spec requirements that constrain the solution
- Identify spec conflicts or gaps (flag them, do not fix them)

### 4. Check AGENTS.md Rules

- Verify against security rules (AI keys, tokens, privacy)
- Verify against AI rules (mobile never calls AI directly)
- Verify against safety rules (backend authoritative)
- Verify against coding rules (architecture, states, conventions)

### 5. Identify Constraints and Risks

- Platform constraints (Android first, iOS compatible)
- Environment constraints (QA, PROD isolation)
- Performance constraints (lower-end Android devices)
- Dependency constraints (prefer existing libraries)
- Security/privacy risks in the proposed change

### 6. Ask Clarifying Questions

- If the request is ambiguous, ask the user before proceeding
- Do not guess on product decisions
- Do not guess on security or safety behavior
- If no user is available, document the assumption as a decision

### 7. Produce Explore Report

Summarize findings for the Propose phase:

```markdown
## Explore Report: <change-name>

Request: <what was asked>
Understanding: <what it really means>

Codebase context:
- Existing code: <files and patterns found>
- Reusable assets: <utilities, components, services>

Spec context:
- Affected specs: <list>
- Spec constraints: <requirements that apply>

Constraints:
- <list of constraints>

Risks:
- <list of risks>

Dependencies:
- <list of dependencies>

Open questions:
- <questions answered OR flagged as requiring user input>

Recommendation:
- <what to propose>
```

---

## Rules

1. Explore is always the first phase. No exceptions.
2. Read the codebase before writing a proposal.
3. Read the specs before touching code.
4. Ask when ambiguous. Never silently guess on product/security/safety decisions.
5. Report findings clearly. Do not skip documenting exploration.
6. Do not fix code or specs during Explore. Explore only.

---

## Exploration Depth Guide

| Change Size | Exploration Depth |
|-------------|-------------------|
| Trivial (rename, comment, one-line fix) | Quick targeted search |
| Small (single component, one endpoint) | Medium: search files, read neighbors, read applicable spec |
| Medium (a new feature, several components) | Thorough: search broadly, read specs, check integrations |
| Large (new architecture, new subsystem) | Comprehensive: full codebase scan, all relevant specs, risk analysis |

---

## Common Mistakes

- Jumping from request straight to implementation (missing constraints)
- Designing a solution in your head during Explore (defer to Propose)
- Assuming the request means something it does not say (ask)
- Ignoring existing patterns in favor of what you know (follow codebase)
- Forgetting security/safety rules (they override all other concerns)