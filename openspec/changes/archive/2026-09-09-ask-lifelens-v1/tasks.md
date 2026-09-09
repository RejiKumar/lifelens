# Tasks: ask-lifelens-v1

## 1. Backend: Migration & Persistence

- [x] 1.1 Add Alembic migration `0003` creating `analysis_message` (id, analysis_id FK -> analysis, role, content, seq, created_at; unique index on (analysis_id, seq)) and `usage` (id, subject, usage_date, used, unique index on (subject, usage_date)) tables
- [x] 1.2 Add SQLAlchemy models, Pydantic schemas, and repository methods for conversation messages (list by analysis in seq order, insert message pair) and usage (upsert/commit, read used)

## 2. Backend: Authoritative Daily Quota

- [x] 2.1 Implement `QuotaService` with check/commit semantics and atomic `INSERT ... ON CONFLICT DO UPDATE ... WHERE used < limit`; enforce GUEST=5 / FREE=20 / PRO=100 daily limits
- [x] 2.2 Replace `NoopQuota` in `deps.get_quota` with the real implementation; include quota state (used, limit, is_pro) in analyze and follow-up/chat-history responses
- [x] 2.3 Apply quota to the scan analyze path: check before provider call, commit only after validated success, no increment on failure; add regression tests proving consume-on-success / no-consume-on-failure

## 3. Backend: Storage Read & Provider Follow-Up

- [x] 3.1 Add `StorageRepository.read(storage_path) -> (bytes, media_type)` returning the stored normalized image, and map missing-path to not-found
- [x] 3.2 Extend `AIProvider` with `follow_up(...)`; implement `GeminiProvider.follow_up` re-sending the stored image as inline `inlineData` multi-part content combined with analysis payload, authoritative safety metadata, ordered history, and the question, returning structured JSON
- [x] 3.3 Implement `StubProvider.follow_up` producing deterministic, contextual, non-empty answers that pass the same server-side validation as Gemini output

## 4. Backend: Conversation Service & API

- [x] 4.1 Add `id` and `scan_id` to the wire `AnalysisResult` schema so clients can address a conversation by analysis id
- [x] 4.2 Implement `ConversationService`: owner/expiry scoping, 8-turn cap from persisted user-message count, quota check before AI, image+analysis reads, safety-metadata-bound prompt, structured validation, atomic persistence of user+assistant messages, quota commit after success, structured error codes (NOT_FOUND, QUOTA_EXCEEDED, LIMIT_EXCEEDED, ANALYSIS_FAILED)
- [x] 4.3 Implement `POST /analysis/{id}/follow-up` accepting `{question}` and returning the assistant message, remaining_capacity, and quota state
- [x] 4.4 Implement `GET /analysis/{id}/chat-history` returning paginated ordered messages, remaining_capacity, and quota state

## 5. Backend: Tests & Gates

- [x] 5.1 Tests: 8-turn cap enforced from persisted state, resets per scan, rejected 9th returns LIMIT_EXCEEDED without AI call
- [x] 5.2 Tests: quota consumed on valid success, not consumed on provider failure/validation failure, QUOTA_EXCEEDED blocks before AI call
- [x] 5.3 Tests: identity scoping (foreign analysis = NOT_FOUND), guest TTL expiry hides conversation, stable guest session across follow-ups
- [x] 5.4 Tests: fake provider asserts image bytes received each turn; safety binding (output contradicting stored HIGH/CRITICAL rejected); stub passes live validation; analysis.id/scan_id present in scan payload
- [x] 5.5 Run backend gates: ruff, mypy, pytest — all green

## 6. Mobile: Inline Conversations & Chrome Cleanup

- [x] 6.1 Extend scan feature domain types and API client: analysisId/scanId, conversation types, `followUp` + `chatHistory` calls (stable guest session header)
- [x] 6.2 Implement `useConversation` hook with loading/success/error/retry states and accessibility announcements for new answers
- [x] 6.3 Build Ask LifeLens entry card + contextual suggestion chips bound to follow_up_suggestions (tap = submit)
- [x] 6.4 Build inline ConversationThread + FollowUpComposer (KeyboardAvoidingView, reduced-motion-aware reveal, accessible touch targets, brand styling)
- [x] 6.5 Integrate inline conversation into `analysis/[id].tsx`; rebuild header to a single labeled back control with no route text; remove duplicate navigation
- [x] 6.6 RNTL/jest tests: chips submit the question, thread renders messages in order, error shows inline retry (no infinite loader), no route text rendered, reduced motion honored
- [x] 6.7 Run mobile gates: `npm run lint` (tsc) and `npm run test` — all green

## 7. Integration, Smoke & Ship

- [x] 7.1 Restart backend; API smoke with stub: scan -> follow-up (grounded answer) -> chat-history restore -> quota reflected -> cap reached
- [ ] 7.2 Device E2E on QA (stub provider): scan subject, ask follow-up inline, suggestions submit, reopen scan restores thread, single back control, no route text
- [ ] 7.3 Commit the uncommitted moment-v1 spec sync/archive on qa first, then run OpenSpec spec-sync for ask-lifelens-v1 (reconcile ai-analysis.md old Follow-Up Chat prose against new requirements) and archive this change
- [ ] 7.4 PROD Gemini smoke: user supplies GOOGLE_AI_API_KEY + AI_PROVIDER=gemini; verify real grounded follow-up answers in PROD (blocked until key provided)