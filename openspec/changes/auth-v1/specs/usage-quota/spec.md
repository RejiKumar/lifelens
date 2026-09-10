# Deltas for auth-v1 — capability `usage-quota`

## MODIFIED Requirements

### Requirement: Daily AI usage is enforced and backend-authoritative

The system SHALL enforce the daily AI usage allowance server-side for the verified identity, and SHALL NOT trust client-reported usage or entitlement data. Each completed scan analysis and each answered follow-up question SHALL consume exactly one AI usage unit from the same daily bucket. The server SHALL check the allowance before invoking the AI provider and SHALL decrement the bucket only after the result is produced and validated successfully. Responses SHALL carry current quota state (used, limit, and for PRO status) so the client can reflect meaningful remaining budget. The identity the allowance is keyed to SHALL be the server-verified Supabase identity — the authenticated user's `sub`/`user_id` or the anonymous-auth `sub` for guests — never a client-supplied header or id.

#### Scenario: Scan analysis consumes a unit

- **WHEN** a scan analysis completes successfully for a verified member within their daily allowance
- **THEN** the member's daily usage increments by one and the response includes updated quota state

#### Scenario: Exhausted allowance blocks before any AI call

- **WHEN** a verified member's daily allowance has no remaining units
- **THEN** a scan or follow-up request is rejected with a structured quota-exceeded error, no AI call occurs, and the response includes quota state

#### Scenario: Failed result does not consume a unit

- **WHEN** a scan or follow-up fails before a validated result (provider failure, invalid output, timeout)
- **THEN** the member's daily usage is not incremented

#### Scenario: Forged identity cannot inflate or share quota

- **WHEN** an unauthenticated or header-only request or a request asserting another identity reaches a quota-bounded endpoint
- **THEN** the backend attributes the allowance to the verified token identity only, and the forged or ambiguous identity is not honored

## ADDED Requirements

### Requirement: Quota limit source derives from verified identity

The GUEST / FREE / PRO limit selection SHALL be derived from the server-verified identity state — anonymous-auth guest, or a known authenticated user (email-verified state and entitlement metadata as available) — and SHALL NOT be derived from client headers or claims beyond the verified token. Behavior of the guest tier (5/day) and FREE tier (20/day) SHALL remain as specified; PRO (100/day) SHALL remain reserved until the monetization change.

#### Scenario: Guest token applies guest quota

- **WHEN** a request presents a verified anonymous-auth token
- **THEN** the daily allowance applied is the guest allowance regardless of any client headers or extra form fields

#### Scenario: Authenticated token applies user quota

- **WHEN** a request presents a verified authenticated-user token
- **THEN** the daily allowance applied is the authenticated-user allowance (FREE today, PRO later) regardless of any client headers or extra form fields