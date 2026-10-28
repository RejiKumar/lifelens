## 1. Backend contract

- [x] 1.1 Add `evidence: list[str]` to `AnalysisResult` in `backend/app/schemas/scan.py` with bounds (max 10 items, each max 300 chars after trim)
- [x] 1.2 Add `evidence: list[str]` to `RawAnalysis` in `backend/app/providers/base.py`
- [x] 1.3 Add `evidence` handling to `backend/app/providers/gemini.py`: `_RESPONSE_SCHEMA` property, system-instruction rule (grounded, visible-only, mandatory non-empty for HIGH/CRITICAL), and `_to_raw_analysis` parsing via `_as_text_list`
- [x] 1.4 Add deterministic evidence to `backend/app/providers/stub.py` `analyze_image`

## 2. Backend service enforcement

- [x] 2.1 In `backend/app/services/analysis.py` `_coerce`: map/clamp evidence, enforce §5.4 honesty rules (confidence < 0.3 floors risk at MEDIUM; confidence < 0.5 injects a low-confidence warning, dedupe by message), reject HIGH/CRITICAL with empty evidence as `analysis_failed`
- [x] 2.2 In `_build_response`: return persisted `evidence` from the analysis record (default `[]` for legacy rows); include `evidence` in the freshly-coerced `AnalysisResult` too

## 3. Backend persistence

- [x] 3.1 Add `evidence` column + `AnalysisRecord.evidence` (`default_factory=list`) in `backend/app/models/scan.py` and `backend/app/repositories/scan.py` (create, get_by_scan path, update_by_scan)
- [ ] 3.2 Add Alembic migration `backend/alembic/versions/0004_add_analyses_evidence.py` (`evidence ARRAY(String) NOT NULL DEFAULT '{}'`) and verify `alembic upgrade head` against the backend database — **migration written and offline-validated (`ALTER TABLE analyses ADD COLUMN evidence VARCHAR[] DEFAULT '{}' NOT NULL`); live apply BLOCKED: Supabase project `zcworxplrqaeymxmugtc` no longer resolves (pooler `tenant not found`, project domain NXDOMAIN)**

## 4. Backend tests

- [x] 4.1 Extend backend tests: evidence coercion/normalization bounds, §5.4 risk floor + warning injection, HIGH/CRITICAL-with-no-evidence rejection, evidence replay from storage, blank-but-from-stub happy path
- [x] 4.2 Run `pytest` in `backend/` until green — **101 passed; ruff clean; mypy clean**

## 5. Mobile contract and UI

- [x] 5.1 Add `evidence: string[]` to `AnalysisResult` in `mobile/src/features/scan/domain/types.ts` and `evidence: []` to the two existing analysis test fixtures
- [x] 5.2 Add a confidence indicator (percentage + plain-language label) and an evidence card and a low-confidence honesty callout to `mobile/src/app/analysis/[id].tsx` using existing UI primitives and tokens (defensive on missing `evidence`)
- [x] 5.3 Insert evidence card above the summary for HIGH/CRITICAL results and after the summary otherwise; honesty callout only when confidence < 0.5, shown above the moment card, non-dismissible and accessible (screen-reader announcement)
- [x] 5.4 Extend `analysis-screen.test.tsx` (and any trust-UI component tests) to cover: confidence shown, evidence render/prominence, honesty callout on/off thresholds, legacy no-evidence tolerance
- [x] 5.5 Run mobile `tsc`, jest, and the layout-token guard until green — **tsc clean; 24 suites / 106 tests pass (incl. layout-tokens guard); new components `confidence-indicator.tsx`, `evidence-card.tsx`, `honesty-callout.tsx` token-compliant**

## 6. Device verification

- [ ] 6.1 Run a live scan on the connected device (camera/gallery), confirm confidence + evidence render on a real result and that stub/backend paths behave per spec
- [ ] 6.2 Confirm restored legacy scan (if reachable) does not error without evidence