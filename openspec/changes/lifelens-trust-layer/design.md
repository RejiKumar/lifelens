# Design: lifelens-trust-layer

## Context

The analysis pipeline already computes `confidence` (provider → `RawAnalysis` → `_coerce` clamps to [0,1] → `Analysis` column → mobile `AnalysisResult`), but it is never rendered and receives only prompt-level hedge guidance. `evidence` does not exist anywhere in the contract. Spec `ai-analysis` §5.4 defines low-confidence safety rules that were never implemented in code. Backend uses Alembic migrations (0001–0003); mobile casts API JSON directly to typed interfaces (no runtime validation), so an additive field is low-risk.

## Goals / Non-Goals

**Goals:**
- Ship the `evidence` field end-to-end with automatic compatibility for legacy rows.
- Render confidence, evidence, and a low-confidence honesty callout on the analysis screen, respecting the existing token/`GlassCard`/`Typography` design system and a11y conventions.
- Enforce the §5.4 honesty policy and the grounded-severity gate in the analysis service.
- Keep the change verifiable end-to-end: backend pytest + mobile jest/tsc + live device scan.

**Non-Goals:**
- No redesign of the analysis screen layout beyond additive sections.
- No changes to follow-up conversation schema/flow (evidence is analysis-only for now).
- No changes to Gigantic risk categories, emergency contacts, or safety spec prose.
- No async pipeline, confidence calibration from user feedback, or per-category confidence weighting.

## Decisions

**D1. `evidence` as a flat `list[str]` on the analysis, capped at 10 items, 300 chars each.**
Rationale: matches the shape of `observations`/`warnings` (arrays of short strings), so coercion, the DB `ARRAY(String)` column, the Gemini schema, and the mobile type all follow established patterns. Alternative considered: structured `evidence: list[{clue, supports: {identification, risk}}]` — richer but adds contract surface with no immediate consumer; revisit when a "why was risk HIGH" drill-down ships.

**D2. Add one Alembic migration `0004_add_analyses_evidence` (`evidence ARRAY(String) NOT NULL DEFAULT '{}'`).**
Rationale: existing pattern (0002 added moment columns). Backfill not needed: empty array is the correct value for legacy rows, satisfying both the "present in every response" requirement and the replay scenario. `AnalysisRecord` gains `evidence` with `default_factory=list` to keep the dataclass backward-compatible at call sites.

**D3. Enforce §5.4 and the evidence gate in `AnalysisService._coerce` (the existing normalization authority).**
Rationale: `_coerce` already clamps confidence and builds both the persisted record and the returned `AnalysisResult`; adding the rules there guarantees one enforcement path that tests already target. Rules:
- `confidence < 0.3 and coerce_risk(...) in LOW/MEDIUM` → force `MEDIUM` (never lower).
- `confidence < 0.5` → append the low-confidence warning if not already present; dedupe by exact message to avoid double-injection on legacy rows.
- `risk in {HIGH, CRITICAL} and len(evidence) == 0` → raise `AnalysisFailedError` (rejection before persistence). The stub stays valid because it emits LOW risk with evidence. Alternative — auto-downgrade instead of reject — rejected: silently downgrading a possibly-correct severe call is worse than asking for a retry.

**D4. Low-confidence honesty threshold is 0.5 on the client, matching the server warning threshold.**
Rationale: one number, no divergent meaning between what the server flags and what the screen explains. The callout is already backed by the server-injected warning; the callout adds the required "verify before acting" instruction and cannot be dismissed (silent dismissal is prohibited by safety rules).

**D5. Evidence prominence rule: severe (HIGH/CRITICAL) renders its evidence card above the "What it is" summary; otherwise the evidence card renders after the summary, and a low-confidence callout sits above the moment card.**
Rationale: the trust spec says severe calls must be visibly grounded and both trust signals must not move/override server content. Keeping each component additive (new `ConfidenceBadge`, `EvidenceCard`, `HonestyCallout` in `components/ui` or presentation, token-based per `mobile/AGENTS.md`) preserves the existing screen ordering.

**D6. Mobile type: `evidence: string[]` required on `AnalysisResult`; UI reads it defensively (`analysis.evidence?.length`).**
Rationale: the backend always returns the field post-migration, so requiring it is honest typing; defensive rendering protects against a stale backend or cached payload without any runtime validation overhead. The two existing analysis fixtures gain `evidence` in this change.

## Risks / Trade-offs

- **Rejection of ungrounded HIGH/CRITICAL could surface as a user-facing failure** in edge prompts → Mitigation: the capped `evidence` array is emitted with the same `required` schema slot; the Gemini instruction makes non-empty evidence mandatory for severe calls; the structured-error path already exists (`analysis_failed`) and the failure messaging is user-safe. Fallback if real-provider false rejects are observed on device: relax to inject a generic evidence string only on provider response, but keep rejection in the service.
- **Alembic migations vs. the live Supabase schema** → Mitigation: run `alembic upgrade head` explicitly in the apply/verify step; the backend tests derive tables from models via the existing test harness, and the migration is additive/null-safe.
- **`evidence` inflation filling token/summary context in follow-ups** → Mitigation: analysis dict sent to follow-ups already truncates context to 4000 chars; evidence rides inside `analysis` and is capped at 10×300 chars.
- **Hesitation that 0.3/0.5 thresholds over-trigger on real images** → Mitigation: thresholds are already codified in the spec (§5.4), and the stub passes with 0.72; device-test with a real kitchen-object scan to eyeball where confidence lands.
- **Empty evidence on legacy rows reading via `_build_response`** → Mitigation: default to `[]` from the record; no crash path.

## Migration Plan

1. Apply `0004_add_analyses_evidence` via Alembic (backend env) — additive, zero-backfill, reversible (drop column).
2. Deploy backend; then mobile (mobile tolerates absent field). Rollback: drop the column and revert schema field; old clients unaffected.
3. No data migration or user-facing consent needed.

## Open Questions

- Whether the live device scan confidence for a common household object lands above 0.5 in practice (verified during device test; if it sits below, the honesty callout — not a code change — is the correct surface).