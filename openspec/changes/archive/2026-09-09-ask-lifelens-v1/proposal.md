# Proposal: Ask LifeLens — Contextual Conversation After Every Scan

## Why

LifeLens identifies a subject, surfaces a proactive Moment, and currently stops. The next signature interaction is a contextual follow-up conversation about the same subject — "Ask LifeLens" — where the user keeps discovering without a second image upload. The scanned subject remains the anchor and the experience must feel AI-native, not like a generic chatbot. Conversations also multiply AI cost, so usage metering must become real and backend-authoritative for the first time.

## What Changes

- **Backend: contextual conversation.** New persisted conversation tied to a scan/analysis: user turns + assistant turns, scoped to the identity, inheriting guest TTL and ownership rules. New encrypted-free text storage for `analysis_id`, `role`, `content`, `created_at`.
- **Real Gemini every turn, grounded in the image.** Follow-up answers are produced by the real provider (Gemini in production; deterministic stub only in automated tests). The provider request **re-sends the stored normalized image** combined with the persisted `AnalysisResult`, authoritative risk/safety metadata, and relevant conversation history. Ask LifeLens is never a text-only chatbot.
- **Amended follow-up contract (existing path).** `POST /analysis/{id}/follow-up` and `GET /analysis/{id}/chat-history` per the existing OpenSpec contract; contract amended for image re-send, structured response, quota consumption, and safety binding — no competing endpoints.
- **Authoritative daily usage metering (first real enforcement).** Quota becomes backend-authoritative rather than a no-op: **each** scan analysis and **each** follow-up question consumes one daily AI usage unit within the existing GUEST/FREE/PRO limits; quota is checked before the AI call and decremented only after success. **BREAKING**: unauthenticated/guest requests now count against device-session quota instead of being unlimited.
- **Per-scan conversation cap.** A single scan conversation allows at most 8 follow-up questions for cost protection; crossing the cap returns a structured quota/limit error.
- **Safety-bound answers.** Follow-up responses are generated under the stored authoritative risk/safety metadata and existing safety rules: never contradict, downplay, or override stored risk; conservative language at HIGH/CRITICAL; dangerous instructions deferred to professionals; disclaimers applied to medical/legal/financial subjects.
- **Mobile: inline premium conversation.** The analysis/result screen becomes the anchor — scanned image → Moment → safety → Ask LifeLens → contextual suggestion chips → inline conversation thread → follow-up input. No navigation to a standalone chat screen. Remove the visible `analysis/[id]` route text and duplicate back/navigation UI.
- **Contextual suggestions.** Suggested questions come from the scan's Gemini-generated `follow_up_suggestions` (plus optionally the previous answer); never replaced by generic hardcoded production suggestions.
- **No** history-wide chat, no streaming, no new subscription/entitlement model, no unrelated features.

## Capabilities

### New Capabilities
- `ai-conversation`: the Ask LifeLens conversation — message persistence and retrieval, context assembly (stored image + analysis + authoritative safety metadata + history), structured follow-up response validation, per-scan 8-question cap, quota-equated usage enforcement, and the inline mobile interaction contract.

### Modified Capabilities
- `ai-analysis`: the existing Follow-Up Chat section (§7) and follow-up/chat-history endpoint contracts (§8.3/§8.4) are amended — image re-sent each turn, structured (JSON) answer instead of plain text, per-question quota consumption, 8-question cap, safety binding — and superseded by `ai-conversation` as the authoritative source.
- `ai-provider`: the provider contract gains a follow-up/conversation method with multi-turn payload composition; Gemini must re-send image inlineData, the deterministic stub must produce contextual replies with non-empty answer content under the same validation rules.
- `usage-quota`: the daily quota moves from a no-op to backend-authoritative enforcement covering scan analysis **and** follow-up questions; per-question consumption, check-before-call, decrement-after-success, and rewarded-ad bonus consistency are specified.
- `safety`: follow-up answers are bound to stored authoritative risk/safety metadata and the sentence filter/deferral/disclaimer rules apply to conversation answers.
- `mobile-ui`: the Analysis Result / Follow-up Chat screen sections are replaced by the inline Ask LifeLens interaction; chrome cleanup removes the route-name header and duplicate navigation.

## Impact

- **Backend:** new `conversations`/`messages` (or equivalent) tables + Alembic migration(s); a real quota table/row + migration; `StorageRepository` gains a read/download method for the stored normalized image; new `follow_up` method on `AIProvider` + `GeminiProvider` + `StubProvider`; new `ConversationService`; amended endpoints under `/analysis/{analysis_id}/follow-up` and `/analysis/{analysis_id}/chat-history`; `AnalysisResponse` gains conversation/answer payloads; `QuotaContext` replaced with an authoritative implementation wired through `deps.get_quota`.
- **Mobile:** result screen redesign (`analysis/[id].tsx`), new Ask LifeLens components (CTA, suggestion chips, inline thread, composer, states), conversation API client + hook, header/back cleanup, theme token usage, tests.
- **API:** follow-up request/response and chat-history contracts amended (structured response, quota payload, cap errors).
- **Specs/docs:** `ai-conversation` (new), amendments to `ai-analysis`, `ai-provider`, `usage-quota`, `safety`, `mobile-ui`.
- **Operations risk:** real AI usage metering ships for the first time; device/guest identities are the quota key until auth-v1.