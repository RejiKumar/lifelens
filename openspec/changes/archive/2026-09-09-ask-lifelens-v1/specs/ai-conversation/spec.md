# Deltas for ask-lifelens-v1 — capability `ai-conversation`

## Purpose

Defines Ask LifeLens, the signature contextual conversation that follows a completed scan: the user asks follow-up questions about the identified subject and receives grounded, safety-bound answers from the real AI provider without re-uploading the image.

## ADDED Requirements

### Requirement: Conversation is scoped to a completed analysis

Every completed scan analysis SHALL expose an associated conversation bound to the same identity (user or guest session) and the same subject. The conversation SHALL persist with the scan, SHALL inherit the scan's ownership and expiry rules, and SHALL NOT allow a user to ask about a different subject unless a new scan is created. Clients SHALL NOT be required to upload the image again to participate.

#### Scenario: Follow-up on an existing analysis

- **WHEN** a member requests a follow-up on their own completed analysis
- **THEN** the conversation continues within that analysis, and no new image upload is required

#### Scenario: Conversation is not shareable across identities

- **WHEN** a member requests the conversation of another identity's analysis
- **THEN** the server returns not found, and no conversation content is exposed

#### Scenario: Expired scan hides its conversation

- **WHEN** a scan's lifetime (guest TTL/expiry) has passed
- **THEN** its conversation and chat history are no longer accessible and follow-up is rejected

### Requirement: Follow-up answers are grounded in the stored image and analysis

Every follow-up answer SHALL be generated from the stored normalized scan image combined with the persisted analysis result, the authoritative risk/safety metadata, and the relevant conversation history. The answer SHALL be grounded in content visible in the image and the persisted analysis and SHALL NOT be produced from the user's text alone without that context.

#### Scenario: Answer references image detail

- **WHEN** a user asks about a visible detail of the subject
- **THEN** the answer reflects the stored image content, not only the original analysis summary

#### Scenario: Answer never contradicts stored risk

- **WHEN** the stored analysis and safety metadata state a risk level or warning
- **THEN** the answer SHALL never contradict, downplay, or override that stored risk information

### Requirement: Follow-up questions consume daily AI usage quota

Each follow-up question SHALL consume one authoritative daily AI usage unit from the identity's existing QUOTA bucket, shared with scan analyses. The server SHALL check quota before invoking the AI provider and SHALL decrement only after the answer is produced and validated successfully. When quota is exhausted, the request SHALL fail with a structured quota-exceeded error and no AI call SHALL be made.

#### Scenario: Successful answer consumes one unit

- **WHEN** a follow-up question produces a valid answer
- **THEN** the identity's daily usage increases by one and the response includes the updated quota state

#### Scenario: Quota exhausted blocks the question

- **WHEN** the identity has no remaining daily units
- **THEN** the server rejects the request with a structured QUOTA_EXCEEDED error, no AI call occurs, and the response carries quota details

### Requirement: Per-scan conversation is capped

A single scan conversation SHALL allow at most eight answered follow-up questions. The cap SHALL be enforced server-side from persisted state, persists across sessions, and SHALL NOT be circumventable by the client. When the cap is reached, further follow-up requests SHALL be rejected with a structured limit error that explains the cap.

#### Scenario: Cap reached after eight answers

- **WHEN** an eighth follow-up question has already been answered in a scan conversation and a ninth is requested
- **THEN** the server rejects the request with a structured limit error and does not invoke the AI provider

#### Scenario: Cap resets per scan

- **WHEN** a user starts a new scan
- **THEN** its conversation begins with a fresh eight-question allowance

### Requirement: Follow-up responses are structured and validated

Follow-up responses SHALL be structured (machine-readable answer content), validated and normalized server-side, non-empty, and bounded in length. An invalid, empty, or out-of-bounds provider response SHALL be rejected with a structured analysis-failed error and SHALL NOT be persisted or returned to the client.

#### Scenario: Valid answer is persisted and returned

- **WHEN** the provider returns a valid structured answer
- **THEN** the server persists the user question and the answer, and returns the answer with quota and safety context

#### Scenario: Invalid provider answer is rejected

- **WHEN** the provider returns an empty or malformed answer
- **THEN** the server rejects it with a structured error, persists nothing, and does not present it to the user

### Requirement: Suggested questions stay contextual

Suggested follow-up questions SHALL be derived from the scan's Gemini-generated `follow_up_suggestions` and, where available, recommended continuations from the current answer. Production SHALL NOT substitute generic hardcoded question sets. Suggestions SHALL concern the scanned subject.

#### Scenario: Suggestions reflect the scan subject

- **WHEN** the result screen offers suggested questions
- **THEN** they are drawn from the scan's contextual suggestions rather than a fixed production list

### Requirement: Unsafe or out-of-scope questions are handled conservatively

Questions that would elicit dangerous instructions, contradict stored safety metadata, or drift to unrelated subjects SHALL be handled conservatively: the answer SHALL decline the unsafe request and direct the user to professional help where applicable, and the server SHALL never produce step-by-step instructions for electrical, gas, chemical, medical, structural, or other high-risk procedures.

#### Scenario: Refusal on dangerous instruction request

- **WHEN** a user asks how to perform a high-risk procedure on the subject
- **THEN** the answer declines, defers to a professional, and does not provide step-by-step instructions

#### Scenario: Off-topic question redirected

- **WHEN** a question is unrelated to the scanned subject
- **THEN** the answer redirects the user to the scanned subject or declines without answering the unrelated topic in depth

### Requirement: Chat history is retrievable

The server SHALL persist conversation messages in order and SHALL return them, scoped to the identity and paginated, through the chat-history contract. The client SHALL use this to restore the thread when the same scan is reopened.

#### Scenario: Reopening a scan restores its conversation

- **WHEN** a result screen for a previously scanned subject is reopened
- **THEN** the previously persisted messages render in order and the conversation continues

#### Scenario: Paginated history

- **WHEN** a member requests chat history
- **THEN** the server returns messages ordered by creation time with pagination metadata