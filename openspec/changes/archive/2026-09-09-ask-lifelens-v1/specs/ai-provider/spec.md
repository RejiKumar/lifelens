# Deltas for ask-lifelens-v1 — capability `ai-provider`

Existing specification: `openspec/specs/ai-provider.md`

## ADDED Requirements

### Requirement: Providers support grounded follow-up answers

The provider contract SHALL expose a follow-up interaction method that accepts the stored normalized image bytes and media type, the persisted analysis result, the authoritative risk/safety metadata, the relevant conversation history, and the user's question, and SHALL return a structured answer. The single-image `analyze` interaction remains unchanged and both interactions coexist on the same provider. Provider-specific errors SHALL be converted to the same internal error categories as the analysis flow.

#### Scenario: Gemini composes a multi-part follow-up request

- **WHEN** the Gemini provider serves a follow-up question
- **THEN** it SHALL include the stored image as inline content in the request together with the analysis, safety metadata, and history, and SHALL return a validated structured answer

#### Scenario: Provider timeout maps to retryable error

- **WHEN** the provider exceeds the bounded timeout during a follow-up call
- **THEN** the call fails with the retryable internal error category, consistent with the analysis flow

### Requirement: Production uses the real provider; tests use deterministic stubs

Production follow-up answers SHALL come from the real configured provider (Gemini in production). The deterministic stub SHALL, in automated tests only, produce contextual non-empty answers with content that references the supplied analysis, a plausible sentiment/intent structure, empty suggestion lists by default, and no sensitive echoes, passing the same server-side validation as Gemini output. Test code SHALL NOT appear behind production configuration.

#### Scenario: Stub answers remain valid under production validation rules

- **WHEN** an automated test exercises the stub follow-up method
- **THEN** the returned answer passes the same validation the server applies to Gemini answers

#### Scenario: Production configuration prefers the real provider

- **WHEN** the production environment is configured for AI
- **THEN** follow-up questions are served by the real provider, never by stubs