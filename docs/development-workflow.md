# LifeLens Development Workflow

## Overview

LifeLens follows the OpenSpec workflow for all development. This document explains the development lifecycle in plain language.

## The Five Phases

### 1. Explore

**What**: Understand the problem before solving it.

**When**: Every time a new feature, bug fix, or change is requested.

**How**:
- Read the relevant specs in `openspec/specs/`
- Search the existing codebase for related code
- Identify constraints, risks, and dependencies
- Ask clarifying questions if the request is ambiguous
- Document what you found

**Output**: Context summary with findings and questions answered.

**Rule**: Never skip Explore. Even "obvious" changes benefit from a quick codebase search.

---

### 2. Propose

**What**: Create a concrete implementation plan.

**When**: After Explore is complete.

**How**:
- Define the change in specific terms
- List every file that will be created or modified
- Define API contracts if applicable
- Write acceptance criteria
- Identify which specs are affected
- Estimate complexity

**Output**: A proposal document in `openspec/changes/<change-name>/proposal.md`.

**Rule**: A proposal must be specific enough that another engineer could implement it without guessing.

---

### 3. Review

**What**: Validate the proposal before writing code.

**When**: After Propose is complete.

**How**:
- Check proposal against product specs
- Check proposal against security rules
- Check proposal against safety rules
- Check proposal against coding conventions
- Verify no spec conflicts
- Verify no breaking changes without migration plan

**Output**: Approved proposal or revision requests.

**Rule**: Review catches problems early. Code written against a bad proposal is wasted work.

---

### 4. Apply

**What**: Implement the approved proposal.

**When**: After Review approves the proposal.

**How**:
- Follow the proposal exactly
- Use existing patterns and libraries
- Write tests alongside implementation
- Run lint and typecheck after each significant change
- Do not deviate from the proposal without re-approval

**Output**: Working code that matches the proposal.

**Rule**: If you need to deviate from the proposal, stop and get re-approval first.

---

### 5. Verify

**What**: Confirm the implementation is correct.

**When**: After Apply is complete.

**How**:
- Run the full test suite
- Run lint and typecheck
- Manually test against acceptance criteria
- Check edge cases
- Verify no regressions
- Document any deviations

**Output**: Verification report with pass/fail status.

**Rule**: Verification is not optional. Code that does not pass verification is not done.

---

## Branch Strategy

```
main (production-ready)
  └── qa (integration branch)
       └── feat/feature-name (feature branches)
```

- Feature branches are created from `qa`
- Changes are merged into `qa` after verification
- `qa` is promoted to `prod` after full QA cycle
- No direct commits to `prod`

---

## Spec Changes

When a change requires modifying a specification:

1. Create a change proposal that references the spec being modified
2. Include the diff of what changes in the spec
3. Get review approval before modifying the spec
4. Update the spec in the same change that implements the feature

---

## Subagent Usage

For complex tasks, the orchestrator may delegate to specialized subagents:

1. Orchestrator identifies which work can be parallelized
2. Orchestrator creates clear task descriptions for each subagent
3. Subagents work independently with their assigned scope
4. Subagents report back with outputs, not assumptions
5. Orchestrator integrates subagent outputs and resolves conflicts
6. Orchestrator owns final architecture and contract decisions

---

## Quick Reference

| Phase | Input | Output | Time |
|-------|-------|--------|------|
| Explore | Request | Context summary | 5-30 min |
| Propose | Context | Proposal doc | 15-60 min |
| Review | Proposal | Approval/revision | 5-15 min |
| Apply | Approved proposal | Working code | 30 min - hours |
| Verify | Working code | Verification report | 10-30 min |
