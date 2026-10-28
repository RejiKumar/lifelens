## ADDED Requirements

### Requirement: Analysis carries evidence

Every analysis result SHALL include an `evidence` field: an ordered list of short, plain-language clues that are visible in the image and that the identification and risk call were based on. The field SHALL be present in every analysis response (empty list when the result is ungrounded or absent), with at most 10 items, each at most 300 characters after trimming. Each item SHALL describe something visible in the image rather than an inference.

#### Scenario: Provider returns evidence

- **WHEN** a provider response includes evidence items
- **THEN** they are trimmed, pruned to the list bounds, and persisted and returned with the analysis

#### Scenario: Provider returns no evidence

- **WHEN** a provider response omits evidence or returns a non-list value
- **THEN** the analysis carries an empty evidence list and validation does not fail

#### Scenario: Stored analysis replayed

- **WHEN** an existing analysis is fetched from storage
- **THEN** the response includes the persisted evidence list (empty when the stored record predates the field)

### Requirement: Low-confidence honesty policy is enforced server-side

The analysis service SHALL enforce the low-confidence safety policy in code rather than relying on the prompt. When a normalized confidence is below 0.3, the risk level SHALL be raised to at least MEDIUM. When a normalized confidence is below 0.5, a low-confidence warning SHALL be appended to the warnings, framed conservatively and referencing possible inaccuracy.

#### Scenario: Confidence below 0.3 floors risk at MEDIUM

- **WHEN** an analysis normalizes with confidence below 0.3 and a risk level of LOW
- **THEN** the served risk level is MEDIUM or higher, and the response reflects the raised risk

#### Scenario: Confidence below 0.5 injects a low-confidence warning

- **WHEN** an analysis normalizes with confidence between 0.3 (inclusive) and 0.5 and has no low-confidence warning yet
- **THEN** the served warnings include a conservative low-confidence warning, and when confidence is at or above 0.5 no such warning is injected

### Requirement: Severe results must be grounded

An analysis that claims HIGH or CRITICAL risk SHALL be rejected (analysis failed) rather than returned when it carries no evidence, because a severe, ungrounded call must never be surfaced.

#### Scenario: High-risk result without evidence is rejected

- **WHEN** a provider response yields HIGH or CRITICAL risk and an empty evidence list
- **THEN** the analysis fails with the existing structured analysis-failed behavior and is neither persisted nor returned

#### Scenario: High-risk result with evidence is accepted

- **WHEN** a provider response yields HIGH or CRITICAL risk with at least one evidence item
- **THEN** the analysis is persisted and returned with the evidence intact

### Requirement: Evidence normalization

Evidence items SHALL be trimmed of surrounding whitespace, have empty items removed, and be truncated to the list bound. Categories, titles, and the moment are unaffected by this normalization.

#### Scenario: Trimming and pruning

- **WHEN** a provider returns evidence with stray whitespace or more than the bound of 10 items
- **THEN** each kept item is trimmed and the list is pruned in order to the first 10 non-empty items