# Design: Ask LifeLens - Contextual Conversation After Every Scan

## Context

See proposal.md - Why/What Changes. Key current-state constraints that shape this design (verified during exploration):

- The backend persists only `Scan` + `Analysis` (migrations `0001`, `0002`). `Analysis.payload` holds the validated result; a new `Moment` step reads it. `Scan.storage_path` persists the normalized image path, but the image bytes are NOT retained in memory after analysis.
- `StorageRepository` can upload and sign URLs but has no method to read image bytes back — needed to re-send the image to Gemini per turn.
- `AIProvider` has a single `analyze_image()` call; `GeminiProvider` sends base64 `inlineData` every request (never retains bytes). The provider spec's ideal contract mentions a `generate_text` abstract, unimplemented.
- Quota is a `NoopQuota` that always allows; no rate limiting; `RATE_LIMITED` exists only as a code. The usage-quota spec already claims backend-authoritative daily quotas (5/20/100) — this change makes that true for the first time.
- Identity today is guest-only: `GuestVerifier` mints a `uuid4` per request only if the `x-guest-session` header is absent. The mobile client already persists `guest_session` in SecureStore, so a stable identity key exists. Guest scans expire after 7 days (`Scan.expires_at`).
- The mobile result screen (`mobile/src/app/analysis/[id].tsx`) renders a native modal header showing the raw route text plus a custom "← Back" control (duplicate/unnavigable on-device). Result flows scan-data → MomentCard → RiskBadge → sections. `follow_up_suggestions` flows end-to-end through the stack but is never rendered.
- The follow-up contract (`POST /analysis/:id/follow-up`, `GET /analysis/:id/chat-history`) exists only in the old ai-analysis prose; its historical design keys by analysis id, a field currently missing from the wire schema.

## Goals / Non-Goals

**Goals:**
- Grounded, persisted, capped, quota-metered follow-up conversation per scan, produced by the real provider in production.
- Minimum new moving parts: one messages table, one usage table, one provider method, one service; amend existing endpoints rather than new ones.
- Mobile renders an inline, signature, polished conversation on the existing result screen; chrome cleanup removes route text and duplicate navigation.
- All follow-up behavior testable with the deterministic stub (production path uses Gemini).

**Non-Goals:**
- Streaming/SSE follow-up responses; history-wide or cross-scan chat; `generate_text`-style freeform provider abstraction; new subscription/entitlement models or rewarded-ad implementation; rate-limit engine (quota-aware `QUOTA_EXCEEDED` only); any change to scan analysis cost semantics beyond "one unit" per established usage-quota spec.

## Decisions

### 1. Persistence: one messages table, count-based cap (no separate conversation row)

Create a single `analysis_message` table (`id`, `analysis_id` FK, `role` (`user`|`assistant`), `content`, `created_at`, `seq`), indexed by `(analysis_id, seq)`. A dedicated conversation table is unnecessary because the conversation is 1:1 with an analysis (one subject, one scan). The eight-question cap is derived by counting stored `user` messages for the analysis — no separate counter to drift out of sync. Messages inherit scan ownership/expiry by joining `analysis -> scan`.

**Alternative considered:** a `conversation` table with a `remaining_units` counter. Rejected: redundant state, and the count must match messages anyway.

### 2. Quota: real PostgreSQL-backed daily metering, one unit per AI call

Introduce a `usage` table keyed by `(subject, usage_date)` where `subject` is the identity key (guest session id today; user id after auth-v1). Implement `QuotaService` with three operations: `check(subject)` (used < limit), `commit(subject)` (increment after success), and `reset`-on-new-day semantics. Replace `NoopQuota` wiring in `deps.get_quota` with the real implementation; keep the existing GUEST=5 / FREE=20 / PRO=100 limits from usage-quota spec. Decrement-after-success: analyze and follow-up both call `check` before the provider and `commit` only after validation. Bonus/rewarded units share the same bucket. The AI call is the unit — one scan analysis = one unit, one follow-up answer = one unit.

**Alternative considered:** keep `NoopQuota` and only guard follow-ups. Rejected: the product decision requires authoritative enforcement now, and shipping metered follow-ups on top of unlimited scans would undermine the whole budget.

### 3. Grounding: `StorageRepository.read` + provider multi-part follow-up

Add `StorageRepository.read(storage_path) -> (bytes, media_type)` to fetch the stored normalized image. Extend `AIProvider` with `follow_up(...)` accepting (image bytes+mime, normalized analysis payload, authoritative safety metadata, ordered history, question) and returning a structured answer. `GeminiProvider.follow_up` composes the same kind of multi-part `inlineData` request used by `analyze_image` (image first, then system/analysis/safety/history/instruction) and asks for structured JSON. `StubProvider.follow_up` returns a deterministic, contextual, non-empty answer from the supplied payload so tests exercise the same validation path.

**Alternatives considered:** send a signed URL reference instead of base64. Rejected: providers may not accept external URLs and a signed URL reintroduces transient access; inlineData matches the existing pattern and keeps provider calls self-contained.

### 4. Wire contract amendments

- `AnalysisResult` payloads gain `id` and `scan_id` so clients can address follow-up and history by analysis id (additive; existing clients ignore unknown fields).
- `POST /analysis/:id/follow-up` body: `{ "question": string }`. Response embeds the assistant message (`role`, `content`, `created_at`), `remaining_capacity` (8 - user turns), and the quota block (`used`, `limit`, `is_pro`).
- `GET /analysis/:id/chat-history?limit&cursor` returns `{ messages: [...], next_cursor, remaining_capacity, quota }`.
- Structured error codes reused from the analysis flow: `ANALYSIS_FAILED` (provider/validation), `QUOTA_EXCEEDED`, `LIMIT_EXCEEDED` (cap), `NOT_FOUND`, `VALIDATION_ERROR`.

### 5. Service: `ConversationService`

New `ConversationService` orchestrates follow-up and history:
1. Resolve analysis by id (owner-scoped, expiry-aware); reject if missing/foreign/expired.
2. Count existing user turns; if >= 8 reject with `LIMIT_EXCEEDED` before any quota or AI work.
3. `QuotaService.check`; reject with `QUOTA_EXCEEDED` (no AI call).
4. Read normalized image bytes; compose context (payload + safety metadata + last N messages); call `provider.follow_up`.
5. Validate structured output; persist the user message + assistant message atomically; `QuotaService.commit`.
6. On provider/validation failure: persist neither message, do NOT commit quota, return `ANALYSIS_FAILED` (retryable) — consistent with the analysis flow's bounded-retry stance.

### 6. Mobile: inline thread on the result screen

Extend the scan feature's domain types with `analysisId`/`scanId` and the conversation types. Result screen additions: a branded `AskLifeLensCard` entry (matches `MomentCard`/`GlassCard` visual language), contextual suggestion chips bound to `follow_up_suggestions` (tap = submit), an inline `ConversationThread` (flat-list of message rows), and a `FollowUpComposer` (input + send) pinned above the keyboard via `KeyboardAvoidingView`. Use `ScanProvider`-style context or a local `useConversation` hook with loading/success/error/retry states and `accessibilityInfo.announceForAccessibility` on new answers. Because the conversation is 1:1 inline, no navigation changes are needed; the screen's header is rebuilt as a single labeled back control with no route text.

**Alternative considered:** context from a separate chat screen. Rejected by product decision #3 (inline contextual conversation; no standalone chat).

### 7. Backend top-to-bottom order preserved

Follow-up reuses the same layered flow as scan analysis: `api/routes -> service -> provider -> repository -> models`. No new external libraries; PostgreSQL stays the source of truth; `AnalysisRepository` gains message/usage queries (or dedicated repositories) following existing patterns.

## Risks / Trade-offs

- **Guest identity instability** — if the client ever drops `x-guest-session`, a new identity mints and quota/history appears lost. → Mobile already persists the session in SecureStore; follow-up/history calls MUST send it; backend keeps the "mint when absent" fallback. Backend tests assert a stable identity.
- **Quota concurrency races** — two simultaneous calls could overshoot the daily limit slightly. → Unique index on `(subject, usage_date)` with atomic upsert (`INSERT ... ON CONFLICT DO UPDATE ... WHERE used < limit`); a bounded overshoot by one is acceptable for v1 (documented).
- **Stored image may be missing** — TTL/cleanup or storage outage → `StorageRepository.read` returns not-found; follow-up returns `ANALYSIS_FAILED`/`NOT_FOUND`, never a text-only answer.
- **Gemini cost from re-sending the image each turn** — mitigated by hard 8-turn cap + daily quota (both enforced server-side before any AI call).
- **Generated advice liability at HIGH/CRITICAL** — mitigated by safety-bound generation: stored metadata is injected into the prompt, and the server rejects output that contradicts stored risk (assertion + conservative system prompt shaping per safety delta).
- **Wire schema addition (`id`/`scan_id`)** — additive; older clients ignore it, but the mobile app must be deployed alongside the backend to address follow-ups (both ship in this change).
- **Uncommitted spec noise** — the moment-v1 sync/archive (ai-moment.md + ai-analysis.md v1.1.0 + archive dir) is currently uncommitted on `qa`; the follow-up delta edits the same ai-analysis.md. → Commit the prior sync before this change's sync work to keep diffs clean.

## Migration Plan

1. New Alembic migration `0003`: create `analysis_message` and `usage` tables + unique indexes.
2. Deploy backend (new schema + read method + provider method + service + endpoints wiring).
3. Deploy mobile bundle (inline conversation UI + header cleanup).
4. Rollback: schema migration is additive and reversible (drop tables); provider/service rollout is behavior-gated by error codes, so an older app still gets coherent failures. Real quota enforcement is default-on: if a quota bug emerges, flipping `deps.get_quota` back to the graceful path is a one-line config change (documented), not a data migration.

## Open Questions

None — decisions required by the specs/approach are resolved above. Product-level unknowns (bot tone, exact Micro-interactions for the signature moment card) are cosmetic and safe to tune post-ship.