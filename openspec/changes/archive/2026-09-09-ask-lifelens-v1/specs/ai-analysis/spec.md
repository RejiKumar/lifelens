# Deltas for ask-lifelens-v1 — capability `ai-analysis`

Existing specification: `openspec/specs/ai-analysis.md`

## ADDED Requirements

### Requirement: Follow-up conversation contract is authoritative

The follow-up interaction SHALL follow the endpoints and message formats defined by the `ai-conversation` capability. These requirements SHALL govern whenever they conflict with historical prose in the Follow-Up Chat section and the follow-up endpoint subsections of this specification.

#### Scenario: Conflict resolves to ai-conversation

- **WHEN** historical prose in this specification contradicts a requirement of the `ai-conversation` capability
- **THEN** the `ai-conversation` requirement governs the behavior

### Requirement: Follow-up request endpoints

The system SHALL expose the follow-up interaction through the existing endpoint shapes `POST /analysis/:id/follow-up` and `GET /analysis/:id/chat-history`, where `:id` is the stored analysis identifier returned to the client in scan payloads. Follow-up SHALL NOT invent competing endpoints for the same interaction. The follow-up request SHALL carry the user's question; the chat-history request SHALL be paginated.

#### Scenario: Follow-up question posted to the analysis

- **WHEN** a client posts a question to `POST /analysis/:id/follow-up` for a conversation it owns
- **THEN** the server validates quota and cap, grounds the answer in the stored image and analysis, and returns a structured answer with quota state

#### Scenario: Chat history fetched for an analysis

- **WHEN** a client requests `GET /analysis/:id/chat-history`
- **THEN** the server returns the persisted, ordered messages for that analysis with pagination metadata

#### Scenario: Unknown or foreign analysis

- **WHEN** a client posts a follow-up or fetches history for an analysis it does not own or that does not exist
- **THEN** the server returns not found and exposes no conversation content

### Requirement: Structurally stable error categories

Follow-up and chat-history responses SHALL return the same structured error categories as the analysis flow (invalid input, provider failure, quota exceeded, rate limited, limit exceeded) with stable machine-readable codes, so clients distinguish exhausted quota from a cap from a transient provider failure.

#### Scenario: Client distinguishes failure kinds

- **WHEN** a follow-up fails
- **THEN** the client can differentiate quota-exceeded, limit-exceeded, transient provider failure, and invalid input from the response metadata

### Requirement: Image is re-sent for grounded follow-up answers

Contrary to the historical design in the Follow-Up Chat section where follow-up context contained only analysis text, a follow-up answer SHALL be grounded in the stored normalized scan image, which the server re-sends to the AI provider together with the analysis, authoritative risk/safety metadata, and relevant history.

#### Scenario: Historical text-only design superseded

- **WHEN** the provider composes a follow-up request
- **THEN** the stored normalized image is included as inline content alongside the analysis and safety context, complying with the `ai-conversation` grounding requirement