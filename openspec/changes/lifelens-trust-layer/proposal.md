# Proposal: lifelens-trust-layer

## Why

Users make real decisions from LifeLens results, but the app gives them no way to judge how sure the AI is. `confidence` is computed, persisted, and sent to the client, yet never shown; summaries can quietly hedge without structure. When the model is uncertain or when a HIGH/CRITICAL call is made, there is no grounded, visible explanation of *why*. Without this, users cannot calibrate trust — and an un-grounded severe warning can be as harmful as a missed one.

## What Changes

- **Evidence surfaces**: the analysis gains a structured `evidence` field (list of grounded, visible clues the model based its identification and risk call on). Flows end-to-end: provider output → schema → normalization → DB column → API → mobile UI.
- **Confidence becomes visible**: the analysis screen renders the confidence score (percentage + label).
- **Honesty handling**: the client shows an explicit, non-dismissible honesty callout (avoiding "when in doubt, use caution") when confidence is low, and shows the evidence prominently on HIGH/CRITICAL results.
- **Server-side honesty policy enforced** (spec `ai-analysis` §5.4, currently unimplemented): confidence < 0.3 floors `risk_level` at `MEDIUM`; confidence < 0.5 injects a low-confidence warning.
- **Grounded severity**: an analysis that claims HIGH or CRITICAL risk with zero evidence is rejected as `analysis_failed` rather than presented — a severe, ungrounded result is never surfaced.
- Consistency rule in the moment/headline: `headline` and `action` continue to be grounded in visible content only; the trust UI adds a "verify before acting" framing under low confidence.

## Capabilities

### New Capabilities
- `trust-layer`: Requirements covering confidence display, evidence rendering, low-confidence honesty UX, and how the analysis screen communicates uncertainty and grounds severe results. This is the behavioral contract for what users see and how the client renders trust signals.

### Modified Capabilities
- `ai-analysis`: The `AnalysisResult` schema gains the `evidence` field (constraints, JSON schema, normalization rules, persistence). The low-confidence safety rules from §5.4 (risk floor at <0.3, warning injection at <0.5) become enforced server-side in the analysis service rather than prompt-only.

## Impact

- **Backend**: `schemas/scan.py` (add `evidence`), `providers/base.py` (`RawAnalysis.evidence`), `providers/gemini.py` (response schema + system instruction + parse), `providers/stub.py` (deterministic evidence), `services/analysis.py` (`_coerce` maps/clamps evidence, enforces §5.4 honesty rules and the HIGH/CRITICAL-evidence gate; `_build_response` returns it), `models/scan.py` (new `evidence` column), `repositories/scan.py` (`AnalysisRecord` + create/get/update), new alembic migration `0004_add_analyses_evidence`. Backend tests: schema, service coercion, provider parse, safety rules.
- **Mobile**: `features/scan/domain/types.ts` (`AnalysisResult.evidence`), the analysis screen (`[id].tsx`) renders a confidence indicator, an evidence card (prominent for HIGH/CRITICAL), and a low-confidence callout; new/updated component tests and the two existing analysis fixtures.
- **No breaking API changes**: `evidence` is additive; existing stored analyses return `evidence: []` (backfill or default) and older clients ignore the field.