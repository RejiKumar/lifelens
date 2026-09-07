# Workflow: Review

## Purpose

Review is the third phase. It validates the proposal BEFORE any code is written. Its goal is to catch design problems, spec conflicts, and rule violations early — when they are cheap to fix. Code written against a bad proposal is wasted work.

---

## Input

- A proposal (from the Propose phase): `openspec/changes/<change-name>/proposal.md` plus `design.md` and `tasks.md` where applicable

## Output

- A review decision: **APPROVED** or **REVISION REQUIRED**
- Findings: what passes, what must change, and why

---

## Steps

### 1. Read the Proposal Completely

- Read `proposal.md` in full
- Read `design.md` to ensure the design is coherent
- Read `tasks.md` to ensure tasks are ordered and verifyable
- Do not skim. Gaps found here save rework later.

### 2. Validate Against Product Specs

For each affected spec (listed in the proposal):
- Does the change contradict any requirement in the spec?
- Does the change extend the spec in a way that conflicts with other features?
- Are the acceptance criteria consistent with what the spec requires?

If the change modifies a spec, verify the proposed diff is attached and consistent.

### 3. Validate Against Engineering Specs

- `ai-provider`: No mobile AI calls. Provider abstraction respected. Structured output.
- `ai-analysis`: Schema validation and normalization pipeline respected.
- `safety`: Backend authoritative. No client-side safety override.
- `usage-quota`: Server-side enforcement. Atomic decrement. Configurable values.
- `entitlements`: Backend-verified purchases. No local permanent grants.
- `storage-privacy`: No public URLs. No raw images in logs. RLS enforced.
- `environments`: QA/PROD isolation. No secrets.
- `mobile-ui`: Clean Architecture per feature. Async states complete. Testing plan defined.

### 4. Validate Against AGENTS.md Rules

Check in priority order (per AGENTS.md Priority Order):
1. **Safety** — no safety downgrade, dangerous instructions, or medical-diagnosis-as-fact
2. **Security** — no secret exposure, no client-trusted auth/quota/entitlement
3. **Privacy** — no image leaks, no PII in analytics/logs
4. **UX** — complete async states, no unexplained infinite loaders
5. **Performance** — Pixel 6a-class baseline respected, bounded timeouts
6. **Architecture** — feature-first Clean Architecture respected
7. **Features** — scope is explicit and not silently expanded

### 5. Review Design Decisions

- Question every decision the proposal makes
- Is there a simpler alternative?
- Does it follow existing patterns and libraries?
- Are future extensions (OpenAIProvider, iOS, StoreKit) supported without rework?
- Are edge cases identified and handled?

### 6. Review Acceptance Criteria

- Is each criterion measurable/testable/observable?
- Can a reviewer later tell "PASS" or "FAIL" objectively?
- Are there criteria for error paths, not just happy paths?
- Are there security/safety criteria where relevant?

### 7. Produce the Review Verdict

```markdown
## Review: <change-name>

Decision: APPROVED / REVISION REQUIRED

Findings:
- <pass finding or must-change finding>

Blocking issues (if any):
- <issue>: <why it blocks>

Non-blocking recommendations (if any):
- <recommendation>

Spec conflicts found: <none or list>
Rule violations found: <none or list>
```

---

## Decision Rules

### APPROVED
- No rule violations (safety, security, privacy, AI)
- No spec conflicts
- Acceptance criteria are testable
- Design decisions are sound and simpler-than-or-equal existing patterns
- Tasks are ordered and verifyable
- Scope is explicit with no creep

### REVISION REQUIRED
- Any safety, security, or privacy rule violation → mandatory revision
- Spec conflict without a migration/update plan → mandatory revision
- Vague or untestable acceptance criteria → mandatory revision
- Risk identified without a mitigation → mandatory revision
- Ambiguous scope → mandatory revision

### Conditions Allowed on Approval
- Approved-with-recommendations (non-blocking improvements noted for Apply)
- Approved-with-scope-cut (features deferred, acceptance criteria updated)

---

## Rules

1. Review happens before Apply. Never approve-then-build without review.
2. Review is independent: the reviewer does not implement the change.
3. Safety, security, and privacy violations are always blocking.
4. The orchestrator owns the final review decision.
5. A revised proposal must be re-reviewed in full, not assumed fixed.
6. Review findings are documented in the change folder for the record.

---

## Checklist

- [ ] Proposal read completely
- [ ] No safety rule violation
- [ ] No security rule violation
- [ ] No privacy rule violation
- [ ] No AI-rule violation
- [ ] No spec conflicts (or migration plan attached)
- [ ] Acceptance criteria testable
- [ ] Edge cases covered
- [ ] Risks identified with mitigations
- [ ] Scope explicit, no creep
- [ ] Design respects existing patterns and future extensibility
- [ ] Verdict documented (APPROVED / REVISION REQUIRED)

---

## Common Mistakes

- Skimming the proposal instead of reading it
- Approving despite a safety/security/privacy violation "to keep momentum"
- Approving vague acceptance criteria that cannot be verified
- Failing to check the proposal against the actual specs
- Letting the implementer review their own proposal alone
- Treating recommendations as blocking (or blocking issues as recommendations)