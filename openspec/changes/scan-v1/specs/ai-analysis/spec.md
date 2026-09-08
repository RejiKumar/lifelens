# Deltas for scan-v1 — capability `ai-analysis`

## MODIFIED Requirements

### Requirement: Synchronous analysis result
The analysis step SHALL execute inside the synchronous `POST /scan/analyze` request and SHALL return the fully validated `AnalysisResult` (including safety metadata) in the same HTTP response. The MVP SHALL NOT expose analysis through a separate 202 `processing` status and SHALL NOT require result polling; the result is returned before the response completes.

#### Scenario: Result returned inline
- **WHEN** analysis completes successfully within the scan request
- **THEN** the response contains the validated analysis result, safety metadata, and server timestamps

#### Scenario: Failed or invalid analysis
- **WHEN** analysis cannot produce a valid result within the bounded timeouts and retries
- **THEN** the server returns a structured `analysis_failed` error with a user-friendly message and the originating scan reference