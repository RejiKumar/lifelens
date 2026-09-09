## 1. Backend schemas and provider contract

- [x] 1.1 Add `Moment` schema to `backend/app/schemas/scan.py` (`headline` non-empty ≤200 chars, `action` non-empty ≤300 chars) and add `moment: Moment` to `AnalysisResult`
- [x] 1.2 Extend `RawAnalysis` in `backend/app/providers/base.py` with flat `headline: str` and `action: str` fields
- [x] 1.3 Update `StubProvider` in `backend/app/providers/stub.py` with a deterministic, LOW-risk-consistent moment (headline + action) matching its existing "common household object" analysis

## 2. Backend persistence

- [x] 2.1 Add `moment_headline` and `moment_action` (`Text`, `nullable=False`, `server_default=""`) to the `Analysis` model in `backend/app/models/scan.py`
- [x] 2.2 Add Alembic migration `0002_add_analyses_moment` (down_revision `0001`): `add_column` both moment columns; downgrade drops them
- [x] 2.3 Extend `AnalysisRecord` in `backend/app/repositories/scan.py` with `moment_headline`/`moment_action` and map them in `AnalysisRepository.create`

## 3. Backend analysis service

- [x] 3.1 Extend `AnalysisService._coerce` in `backend/app/services/analysis.py`: normalize `headline`/`action` (trim + bound like other strings), compose the nested `Moment`, and reject the analysis with `AnalysisFailedError` when either is empty/missing (never pad with placeholder)
- [x] 3.2 Extend `AnalysisService._build_response` to read `moment_headline`/`moment_action` from the persisted row into the `AnalysisResult.moment`
- [x] 3.3 Run backend `ruff` + `mypy` clean on changed files

## 4. Backend tests

- [x] 4.1 Schema tests: `Moment`/`AnalysisResult.moment` accepts valid values, rejects empty/oversized headline or action
- [x] 4.2 Service tests: `_coerce` passes a valid moment through; empty or absent headline/action raises `AnalysisFailedError`; stub output round-trips into `AnalysisResult.moment`
- [x] 4.3 API tests: `POST /scan/analyze` happy path returns `analysis.moment`; invalid-moment provider output returns structured `analysis_failed`; `GET /scan/{id}` replays the persisted moment
- [x] 4.4 Run full pytest suite green against dev DB (no Gemini credentials required)

## 5. Mobile domain and data types

- [x] 5.1 Add `Moment` interface (`headline`, `action`) and `moment: Moment` to `AnalysisResult` in `mobile/src/features/scan/domain/types.ts`
- [x] 5.2 Verify all existing fixtures/tests that construct `AnalysisResult` include a valid `moment` (run `npm run test` to confirm no breakage)

## 6. Mobile result screen UI

- [x] 6.1 Add `MomentCard` component (`mobile/src/components/ui/moment-card.tsx`) using existing theme tokens/glass styling, accessibility header role, and reduced-motion-safe (static) presentation
- [x] 6.2 Render `MomentCard` at the top of the analysis body in `mobile/src/app/analysis/[id].tsx` — above the risk badge/title; risk badge and safety banner remain visible without scrolling
- [x] 6.3 Include the moment headline in the existing "Analysis complete" `AccessibilityInfo.announceForAccessibility` announcement

## 7. Mobile tests

- [x] 7.1 Add RNTL tests for `MomentCard` (renders headline + action; empty moment renders nothing)
- [x] 7.2 Add/extend result screen tests asserting moment renders above the risk badge for LOW risk, and that on HIGH/CRITICAL risk the risk badge and safety banner remain prominent and unobstructed
- [x] 7.3 Run `npm run lint` and `npm run test` green

## 8. End-to-end verification

- [x] 8.1 Backend: manual curl happy path against dev Supabase returns `analysis.moment`; `GET /scan/{id}` replays the same moment
- [x] 8.2 Mobile: guest scan (gallery) on real device shows the moment card above the identification result; safety banner/risk badge still visible
- [x] 8.3 Confirm no AI credentials on client, nothing new logged containing sensitive content, and no change to public-URL handling
- [x] 8.4 Full mobile `lint`/`test` and backend `pytest` + `ruff` + `mypy` green before merge to `qa`