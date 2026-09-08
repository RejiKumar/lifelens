# Deltas for lifelens-moment-v1 — capability `ai-analysis`

## MODIFIED Requirements

### Requirement: AnalysisResult includes a moment block

The `AnalysisResult` schema SHALL include, in addition to its existing fields, a `moment` object composed of `headline` (string) and `action` (string). Every completed analysis SHALL carry a present and valid `moment`. The structured-output schema sent to AI providers SHALL include the moment block in its required fields. The validation and normalization pipeline SHALL cover the moment field (trimming, length bounds, empty-content removal) before persistence, and persistence SHALL store the moment with the analysis row. Both `POST /scan/analyze` and `GET /scan/{id}` responses SHALL include the persisted moment.

#### Scenario: Completed analysis returns a moment

- **WHEN** analysis completes successfully within the scan request
- **THEN** the response contains `analysis.moment` with a valid `headline` and `action`

#### Scenario: Invalid moment fails validation

- **WHEN** the provider response's moment violates schema or normalization bounds
- **THEN** the analysis is rejected with a structured `analysis_failed` error and is not persisted or returned