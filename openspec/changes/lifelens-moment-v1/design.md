# Design: lifelens-moment-v1 — Proactive Actionable Insight

## Context

See `proposal.md` — Why. scan-v1 delivered the synchronous `POST /scan/analyze` pipeline (image normalize → de-dup → AI provider → `_coerce` clamp/validate → persist `scans` + `analyses` → inline `ScanResponse`). The production provider is `GeminiProvider` (`AI_PROVIDER=gemini`, the code default), which returns identification, confidence, safety metadata, and the Moment in one structured JSON call; `StubProvider` is pinned for local QA and automated tests only. The result shape (`AnalysisResult` in `backend/app/schemas/scan.py`), the in-memory `RawAnalysis` (provider seam), `AnalysisRecord` (persistence seam), and the `analyses` table all mirror the same flat field set, threaded through `AnalysisService._coerce`/`_build_response`. The mobile result screen (`mobile/src/app/analysis/[id].tsx`) renders risk badge → safety banner → identification sections, all from `AnalysisResult`. lifeLens-moment-v1 threads one new "moment" pair (headline + action) through that same pipeline and surfaces it as a leading card above the identification result.

## Goals / Non-Goals

**Goals:**
- Single source of truth: the moment travels through the existing provider → coerce → schema → repository → model → migration chain so each layer stays consistent with today's flat-field pattern.
- Zero new latency or round-trips for the user; the moment comes from the same AI response already required for the analysis.
- Safety remains authoritative and prominent; the moment is display content that must not contradict safety metadata.

**Non-Goals:**
- No new API endpoint, no async/queuing, no change to the safety engine or risk classification.
- Production AI is always real Gemini (see Decision 5); no fallback to fabricated content while serving requests.
- No moment personalization, memory of past scans, deep links, or moment-specific analytics.
- No data migration/backfill for pre-existing rows (MVP has no durable production data).

## Decisions

### 1. Two flat columns vs. a JSONB moment object on `analyses`
**Decision:** Add `moment_headline` and `moment_action` as two `Text` columns (migration `0002`).
**Rationale:** The existing `analyses` table persists every analysis field as a typed scalar column (`when_to_seek_help` is a nullable `Text`, arrays as `ARRAY`). Two scalars match that pattern, keep rows readable, and avoid hydration logic at the repo boundary.
**Alternative considered:** a JSONB `moment` object. Rejected — it introduces a new persistence shape for one capability and complicates the `AnalysisRepository.create`/`Analysis` model mapping for no query benefit (no moment indexing needed).

### 2. Flat fields on `RawAnalysis`, composed into a nested `Moment` schema
**Decision:** Extend the provider seam `RawAnalysis` with flat `headline: str` and `action: str`. The public `AnalysisResult` gains a nested `moment: Moment` object (`Moment` = `headline` + `action`).
**Rationale:** `_coerce` currently reads flat attributes via `getattr`; flat provider fields keep that pattern zero-friction. The *public* contract is nested because that is the desired API/UI shape (one logical thing). Composition happens once, in `_coerce`.
**Alternative considered:** a nested `RawMoment` dataclass. More "pure", but adds an object to normalize in every future provider for no contract benefit.

### 3. Moment is validated normally, but missing content rejects the analysis
**Decision:** `headline`/`action` are normalized like other strings (trim, bound: headline ≤200 chars, action ≤300 chars). Unlike `_strings`, which pads missing detail lists with a placeholder, an **empty or absent moment is a hard `AnalysisFailedError`**.
**Rationale:** The spec requires a non-empty moment on every completed analysis, and padding an *action* with filler would violate the "defer to professional help rather than invent a procedure" rule — the most dangerous failure mode is a fabricated action. Rejecting forces the provider (or future prompt) to supply one, per AI Rules #4 (invalid AI responses are rejected, never presented).
**Alternative considered:** fallback text like "See the details below." Rejected for the safety reason above.

### 4. Safety metadata stays authoritative; the moment is prompt-constrained, not recomputed
**Decision:** No change to risk classification, warning injection, or the `SafetyMetadata` shape. The moment is produced by the same single AI response and its conservatism is enforced by (a) schema validation, (b) the rejection rule in Decision 3, and (c) provider prompt guidance (headline addresses the safety matter first when risk is HIGH/CRITICAL).
**Rationale:** Re-deriving the moment on the server would duplicate safety logic and risk drift between the safety engine and displayed content. Keeping rejection + prompt guidance is consistent with the existing "backend authoritative, prompt-mediated content" approach.
**Risk accepted:** prompt-level conservatism is only as good as the prompt; mitigated by Decision 3 (worst case rejects rather than misleads).

### 5. Production Gemini provider returns the moment in the same structured call
**Decision:** The production provider (`app/providers/gemini.py`) calls the Gemini `generateContent` REST API with structured JSON output (`responseMimeType: application/json` + `responseSchema`, which makes `headline`/`action` required non-empty fields) so identification, confidence, safety metadata, and the Moment arrive in the same bounded request. The schema-constrained response is adapted into `RawAnalysis`; the analysis service remains the single authority that clamps, validates, and rejects. Provider failures surface as typed `ProviderError` categories (retryable: timeout/network/rate-limit; non-retryable: auth/invalid/model) mapped to user-facing `ANALYSIS_FAILED` messages.
**Rationale:** The product requires the production Moment to come from the real model, not a stub. Structured output + schema enforcement gives the "required non-empty highlight/action" guarantee in-band; `_coerce`'s rejection rule remains the backstop. Seams are preserved (the mobile contract and business logic never mention Gemini).
**Risk accepted:** live real-Gemini verification depends on a `GOOGLE_AI_API_KEY` in the production environment; QA/dev is pinned to the stub (`backend/.env`: `AI_PROVIDER=stub`).

### 6. Stub provider returns a deterministic, low-risk moment
**Decision:** `StubProvider` gains a fixed `headline`/`action` consistent with its existing LOW-risk "common household object" analysis (e.g. headline: "It looks intact and safe to handle." action: "No action needed right now — rescan if it changes.").
**Rationale:** Keeps the entire pipeline testable end-to-end without credentials, exactly as today.

### 7. Mobile: a `MomentCard` component surfaced above the risk badge
**Decision:** New `MomentCard` in `src/components/ui/moment-card.tsx` (same seat as `RiskBadge`/`SafetyBanner`), rendered at the very top of the analysis body in `analysis/[id].tsx`, above `RiskBadge`/title. The risk badge and safety banner remain directly below, visible without scrolling. Card uses existing theme tokens (surface elevated/card styling, glass per the design system) — no new palette, reduced-motion safe (static), with an accessibility header and inclusion in the existing "Analysis complete" announce.
**Rationale:** The leading placement is a spec requirement (moment above identification); keeping safety immediately adjacent preserves the "prominent, unobstructed" constraint without burying either.
**Alternative considered:** rendering the moment below the safety banner. Rejected — contradicts the spec's leading placement for low-risk results.

### 8. Tests mirror the existing suites
**Decision:** Backend pytest: schema test for `Moment`/`AnalysisResult.moment`, `_coerce` normalize+reject cases, stub determinism, repository persistence + `GET /scan/{id}` replay. Mobile: RNTL test for `MomentCard` and the result screen ordering (moment above risk badge; safe+high-risk placements).
**Rationale:** Matches the established backend (`tests/api/`) and mobile (`__tests__/`) layout and the prior change's coverage pattern.

## Risks / Trade-offs

- **Risk: a future Gemini provider might omit or fabricate the moment despite validation.** → Validation rejects omissions; prompt guidance (Decision 4) constrains fabrication. If a real provider later produces poor moments, prompt tuning is a provider-only change (seam preserved).
- **Risk: adding a required `moment` field is contract-breaking for any older client.** → MVP has a single in-repo client updated in the same change; the mobile app and backend ship together.
- **Risk: two scalar columns grow the `analyses` row width trivially.** → Negligible (two Text values); no query impact since the moment is never indexed/filtered.
- **Trade-off: prompt-constrained conservatism depends on the future provider prompt.** → Accepted; the stub and rejection rule keep the MVP honest, and the spec cedes no safety ground.

## Migration Plan

- New Alembic revision `0002_add_analyses_moment`: `op.add_column("analyses", moment_headline Text, server_default="", nullable=False)` and same for `moment_action`. Existing rows (if any in QA) read as `""`; the API never serves them because `_coerce`/schema reject empty moments for new analyses, and the MVP has no durable production data requiring backfill.
- Rollback: `op.drop_column` both columns (revision downgrade). No data loss beyond the added columns.
- Deploy order: backend migration → backend code → mobile build. Backwards-compatible in DB terms (new columns are additive); the in-repo mobile client updates in the same change.

## Open Questions

None that change the specs, approach, or task breakdown. (User-facing copy for the moment may change names — that is a presentation detail handled during implementation without renegotiating this design.)