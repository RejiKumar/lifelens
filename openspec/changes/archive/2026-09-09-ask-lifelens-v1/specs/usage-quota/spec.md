# Deltas for ask-lifelens-v1 — capability `usage-quota`

Existing specification: `openspec/specs/usage-quota.md`

## ADDED Requirements

### Requirement: Daily AI usage is enforced and backend-authoritative

The system SHALL enforce the daily AI usage allowance server-side for the identity, and SHALL NOT trust client-reported usage or entitlement data. Each completed scan analysis and each answered follow-up question SHALL consume exactly one AI usage unit from the same daily bucket. The server SHALL check the allowance before invoking the AI provider and SHALL decrement the bucket only after the result is produced and validated successfully. Responses SHALL carry current quota state (used, limit, and for PRO status) so the client can reflect meaningful remaining budget.

#### Scenario: Scan analysis consumes a unit

- **WHEN** a scan analysis completes successfully for a member within their daily allowance
- **THEN** the member's daily usage increments by one and the response includes updated quota state

#### Scenario: Exhausted allowance blocks before any AI call

- **WHEN** a member's daily allowance has no remaining units
- **THEN** a scan or follow-up request is rejected with a structured quota-exceeded error, no AI call occurs, and the response includes quota state

#### Scenario: Failed result does not consume a unit

- **WHEN** a scan or follow-up fails before a validated result (provider failure, invalid output, timeout)
- **THEN** the member's daily usage is not incremented

### Requirement: Follow-up questions share the member quota bucket

Follow-up questions SHALL consume from the same daily bucket as scan analyses under the same GUEST/FREE/PRO allowances. Rewarded-ad and promotional bonus units SHALL count into the same bucket transparently.

#### Scenario: Follow-up and scan share one daily allowance

- **WHEN** a member has used N units on scan analyses and asks a follow-up question
- **THEN** the question consumes the (N+1)th unit from the same daily bucket

#### Scenario: Bonus units extend the same bucket

- **WHEN** a member receives bonus units through a rewarded action
- **THEN** the bonus adds to the same daily bucket and is consumed by both scans and follow-up questions