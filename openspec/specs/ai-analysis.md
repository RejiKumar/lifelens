# AI Analysis Specification

**Module:** AI Analysis
**Version:** 1.1.0
**Status:** Active
**Last Updated:** 2026-09-08

---

## 1. Overview

The AI Analysis module takes an uploaded image, sends it to an AI provider with a structured prompt, validates and normalizes the response, applies safety policies, persists the result, and returns it to the client. It also manages follow-up chat conversations tied to a specific analysis.

### 1.1 MVP Execution Model (Locked)

Decision date: 2026-09-07. The MVP analysis pipeline is **synchronous request/response**.

```
capture → compress → upload → scan_id → analyze → FastAPI
      → Gemini → structured validation → safety policy → result
```

- The client receives the final result in the same HTTP response as the analysis call. No polling.
- **No queues, workers, background jobs, async tasks, or WebSocket result channels in the MVP.**
- AI calls use bounded timeout + bounded retry (see `ai-provider.md`). The request has a bounded total latency budget.
- Because analysis snapshots and results are already persisted server-side, migrating to an async pipeline later (if measured latency on a Pixel 6a-class device misses the cold-start target) is a separate OpenSpec change and non-breaking for clients.

---

## 2. Analysis Flow

### 2.1 End-to-End Pipeline

```
Image uploaded
  → Backend receives and validates image
  → AI provider selected and called with structured prompt
  → AI response received as JSON
  → JSON parsed and validated against AnalysisResult schema
  → Fields normalized (trim, lowercase categories, clamp confidence)
  → Safety policy applied (risk classification, warning injection)
  → Result persisted to database
  → Result returned to client
```

### 2.2 Step Details

| Step | Description | Failure Behavior |
|------|-------------|-----------------|
| Receive image | Validate file type, size, and integrity | Reject with 400 |
| Select provider | Load active provider from configuration | Fail with 500 |
| Call AI | Send image + prompt to provider with timeout | Retry per provider retry logic |
| Parse response | Parse JSON from AI response | Retry once with corrected prompt |
| Validate schema | Check against `AnalysisResult` Pydantic model | Retry once, then reject |
| Normalize | Trim whitespace, clamp confidence, standardize enums | Always succeeds |
| Apply safety | Classify risk, inject warnings for sensitive content | Always succeeds |
| Persist | Write to database with scan reference | Fail with 500 |
| Return | Serialize and send to client | Always succeeds |

---

## 3. Structured Output Schema

### 3.1 AnalysisResult

```python
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field
from datetime import datetime


class RiskLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class Moment(BaseModel):
    headline: str = Field(description="Why the identified item matters right now", max_length=140)
    action: str = Field(description="One safe next step for the user", max_length=280)


class AnalysisResult(BaseModel):
    id: str = Field(description="UUID of this analysis")
    scan_id: str = Field(description="Reference to the originating scan")
    title: str = Field(description="What was identified in the image", max_length=200)
    category: str = Field(description="Classification of the identified item", max_length=100)
    summary: str = Field(description="Plain language explanation of findings", max_length=2000)
    confidence: float = Field(description="Confidence score from 0.0 to 1.0", ge=0.0, le=1.0)
    risk_level: RiskLevel = Field(description="Risk assessment level")
    observations: list[str] = Field(description="Detailed observations from the image", max_length=20)
    actions: list[str] = Field(description="Suggested next steps or actions", max_length=10)
    warnings: list[str] = Field(description="Safety warnings if applicable", max_length=10)
    when_to_seek_help: Optional[str] = Field(description="When to consult a professional", default=None)
    follow_up_suggestions: list[str] = Field(description="Suggested follow-up questions", max_length=5)
    moment: Moment = Field(description="Image-grounded headline and action")
    created_at: datetime = Field(description="Timestamp of analysis creation")
```

### 3.2 Field Constraints

| Field                  | Type          | Constraints                                   |
|-----------------------|---------------|-----------------------------------------------|
| `id`                  | string        | UUID v4, generated server-side                |
| `scan_id`             | string        | Must reference an existing scan               |
| `title`               | string        | 1–200 chars, non-empty                        |
| `category`            | string        | 1–100 chars, lowercase alphanumeric + hyphens |
| `summary`             | string        | 1–2000 chars, plain language                  |
| `confidence`          | float         | Clamped to [0.0, 1.0]                         |
| `risk_level`          | enum          | One of: LOW, MEDIUM, HIGH, CRITICAL           |
| `observations`        | array[string] | 1–20 items, each 1–500 chars                  |
| `actions`             | array[string] | 0–10 items, each 1–500 chars                  |
| `warnings`            | array[string] | 0–10 items, each 1–500 chars                  |
| `when_to_seek_help`   | string\|null  | 0–1000 chars or null                          |
| `follow_up_suggestions`| array[string]| 0–5 items, each 1–200 chars                   |
| `moment`              | object (Moment) | `headline` 1–140 chars, `action` 1–280 chars, both non-empty |
| `created_at`          | datetime      | ISO 8601 UTC, server-generated                |

### 3.3 JSON Schema for AI Provider

The schema sent to the AI provider is derived from the Pydantic model and formatted as a JSON Schema object. This schema is included in the API call's `response_schema` field (Gemini) or described in the system prompt (OpenAI).

```json
{
  "type": "object",
  "properties": {
    "title": { "type": "string", "maxLength": 200 },
    "category": { "type": "string", "maxLength": 100 },
    "summary": { "type": "string", "maxLength": 2000 },
    "confidence": { "type": "number", "minimum": 0.0, "maximum": 1.0 },
    "risk_level": { "type": "string", "enum": ["LOW", "MEDIUM", "HIGH", "CRITICAL"] },
    "observations": {
      "type": "array",
      "items": { "type": "string" },
      "minItems": 1,
      "maxItems": 20
    },
    "actions": {
      "type": "array",
      "items": { "type": "string" },
      "maxItems": 10
    },
    "warnings": {
      "type": "array",
      "items": { "type": "string" },
      "maxItems": 10
    },
    "when_to_seek_help": { "type": ["string", "null"], "maxLength": 1000 },
    "follow_up_suggestions": {
      "type": "array",
      "items": { "type": "string" },
      "maxItems": 5
    },
    "moment": {
      "type": "object",
      "properties": {
        "headline": { "type": "string", "minLength": 1, "maxLength": 140 },
        "action": { "type": "string", "minLength": 1, "maxLength": 280 }
      },
      "required": ["headline", "action"]
    }
  },
  "required": [
    "title", "category", "summary", "confidence",
    "risk_level", "observations", "actions", "warnings",
    "when_to_seek_help", "follow_up_suggestions", "moment"
  ]
}
```

---

## 4. Prompt Engineering

### 4.1 System Prompt

```
You are LifeLens, an AI visual analysis assistant. Your role is to analyze images
provided by the user and return structured, factual observations.

Rules:
- Respond ONLY with valid JSON matching the provided schema.
- Do not include any text outside the JSON object.
- Base all observations strictly on what is visible in the image.
- If you cannot identify the subject with confidence, set confidence below 0.5
  and include a note in observations explaining the uncertainty.
- For health-related images, always err on the side of caution with risk_level.
- When in doubt about risk, elevate the risk_level by one level.
- Always include at least one follow-up suggestion.
- Keep summaries in plain, non-technical language.
- Never provide definitive medical, legal, or financial advice.
- When professional consultation is appropriate, set when_to_seek_help with
  a clear recommendation.
- Always include a moment with a headline (why it matters) and one safe,
  image-grounded action (what to do).
- Never invent causes, risks, or procedures the image does not support; when
  no safe direct action can be verified, the moment's action must defer to
  professional help.
```

### 4.2 User Prompt

```
Analyze this image and provide your structured response.

Image type: {mime_type}
User context: {context or "None provided"}

Identify the primary subject, classify it, assess any risks, and provide
actionable observations and suggestions.
```

### 4.3 Prompt Variations by Category

When the user provides an `analysis_type`, the user prompt is augmented:

| analysis_type | Additional prompt text |
|--------------|----------------------|
| `food`       | "Focus on identification, freshness, nutritional highlights, and food safety." |
| `product`    | "Focus on product identification, condition assessment, and usage safety." |
| `document`   | "Focus on text extraction, document type identification, and content summary." |
| `general`    | No additional text (default) |

### 4.4 Few-Shot Examples

Include one example in the system prompt for output consistency:

```
Example output for an image of a banana:
{
  "title": "Fresh Banana",
  "category": "food",
  "summary": "A ripe yellow banana, approximately 7 inches long, with minor brown
  spotting on the peel indicating ripeness.",
  "confidence": 0.95,
  "risk_level": "LOW",
  "observations": [
    "Yellow peel with light brown spots indicating ripe stage",
    "No visible mold, bruising, or damage",
    "Appears to be a Cavendish variety"
  ],
  "actions": [
    "Safe to consume raw",
    "Can be stored at room temperature for 1-2 days"
  ],
  "warnings": [],
  "when_to_seek_help": null,
  "follow_up_suggestions": [
    "How long will this banana stay fresh?",
    "What are the nutritional values?",
    "What recipes can I make with ripe bananas?"
  ],
  "moment": {
    "headline": "This ripe banana is ready to eat now",
    "action": "Peel and enjoy, or store at room temperature for 1-2 days"
  }
}
```

---

## 5. Validation Pipeline

### 5.1 Parse AI Response

- Receive raw response string from the AI provider
- Strip any markdown code fences (```json ... ```) if present
- Parse as JSON using `json.loads()`
- If parsing fails, raise `InvalidResponseError` with the raw response for logging

### 5.2 Schema Validation

- Feed parsed JSON into `AnalysisResult.model_validate()`
- Pydantic validates types, constraints, and required fields
- If validation fails, collect all validation errors
- Raise `SchemaValidationError` with the list of errors

### 5.3 Normalization

Apply these transforms after successful validation:

| Field          | Normalization Rule                                            |
|---------------|---------------------------------------------------------------|
| `title`       | Trim whitespace, capitalize first letter                      |
| `category`    | Trim whitespace, lowercase, replace spaces with hyphens       |
| `summary`     | Trim whitespace, collapse multiple spaces                     |
| `confidence`  | Clamp to [0.0, 1.0] (floor 0.0, ceiling 1.0)                |
| `risk_level`  | Ensure uppercase, validate against enum                       |
| `observations`| Trim each item, remove empty strings                          |
| `actions`     | Trim each item, remove empty strings                          |
| `warnings`    | Trim each item, remove empty strings                          |
| `when_to_seek_help`| Trim if not null                                        |
| `follow_up_suggestions`| Trim each item, remove empty strings                  |
| `moment`      | Trim `headline` and `action`; if either becomes empty, reject as `analysis_failed` |

### 5.4 Safety Policy

Apply safety rules after normalization:

#### Risk Level Override
- If `confidence < 0.3`, set `risk_level = MEDIUM` minimum (uncertain identification is inherently risky)
- If the image contains text related to medical symptoms and `risk_level = LOW`, elevate to `MEDIUM`
- If the image appears to contain hazardous materials, elevate `risk_level` to `HIGH` minimum

#### Warning Injection
- If `category == "food"` and `risk_level` is `MEDIUM` or above, inject warning: "This is AI-generated advice. Always verify with official sources before consuming."
- If `category == "health"` and `when_to_seek_help` is null, inject `when_to_seek_help`: "Consult a healthcare professional for definitive advice."
- If `confidence < 0.5`, inject warning: "Low confidence identification. Results may be inaccurate."

### 5.5 Persistence

- Generate UUID for `id` (server-side)
- Set `created_at` to current UTC timestamp
- Write the full `AnalysisResult` to the database
- Persist the validated `moment` with the analysis row; later fetches by id return the same persisted moment
- Associate with the originating `scan_id`
- Index on `scan_id`, `created_at`, and `category` for query performance

---

## 6. Invalid Response Handling

### 6.1 Parse Failure

- If JSON parsing fails, log the raw response at ERROR level
- Retry once: re-send the prompt with an additional instruction:
  "Your previous response was not valid JSON. Respond ONLY with a JSON object matching the schema. No markdown, no explanation."
- If the retry also fails, return error to client

### 6.2 Schema Validation Failure

- If Pydantic validation fails, log the validation errors at ERROR level
- If the provider response's `moment` violates schema or normalization bounds, reject the analysis as `analysis_failed` and do not persist or return it
- Retry once: re-send the prompt with the validation error details appended:
  "Your response failed validation: {errors}. Correct these issues and respond with valid JSON."
- If the retry also fails, return error to client

### 6.3 Retry Failure Response

```json
{
  "error": "analysis_failed",
  "message": "Unable to generate a valid analysis for this image. Please try a different image or try again later.",
  "scan_id": "uuid"
}
```

### 6.4 Logging for Improvement

- All invalid responses are logged with:
  - The raw AI response
  - The validation errors
  - The prompt that was sent
  - The provider and model used
  - A timestamp
- These logs are reviewed periodically to improve prompt engineering
- Logs are rotated and purged after 30 days

---

## 7. Follow-Up Chat

### 7.1 Context Management

- Each analysis has an associated chat thread
- The chat thread includes:
  - The original analysis result (as the first "message")
  - The original image (stored reference)
  - A conversation history of follow-up exchanges
- Chat threads are scoped to the scan ID

### 7.2 Chat Message Structure

```python
class ChatMessage(BaseModel):
    id: str  # UUID
    role: str  # "user" | "assistant"
    content: str
    created_at: datetime
    analysis_id: str  # Reference to the analysis
```

### 7.3 Follow-Up Prompt Construction

When a user asks a follow-up question:

**System prompt** (same as analysis, with addition):
```
You are continuing a conversation about a previous image analysis.
The original analysis was:
{analysis_result_json}

Respond in plain text. Do not use JSON. Be concise and helpful.
Do not repeat information already provided in the original analysis.
```

**User prompt:**
```
{user_question}
```

- The image is NOT re-sent for follow-ups (the model has context from the original analysis)
- If the user wants a new analysis of the same image, they should use the re-analyze endpoint

### 7.4 Conversation History

- Store all messages in the database, ordered by `created_at`
- Limit context window to the last 20 messages (including the original analysis)
- If the conversation exceeds 20 messages, summarize older messages into a single context message

### 7.5 Validation

- Follow-up responses from the AI are validated as plain text (no JSON schema)
- Ensure responses are non-empty and within 2000 characters
- If the response is empty or exceeds limits, retry once
- After retry failure, return a generic error message

### 7.6 Streaming (Future)

- Streaming responses are deferred to post-MVP
- When implemented, use Server-Sent Events (SSE) for real-time token delivery
- The client renders tokens as they arrive for improved perceived performance
- Complete response is validated and persisted after streaming finishes

---

## 8. API Endpoints

### 8.1 POST /analysis/analyze

Trigger a new analysis on an existing scan.

**Request:**
```json
{
  "scan_id": "uuid",
  "analysis_type": "general",
  "context": "optional user context"
}
```

**Response 202:**
```json
{
  "analysis_id": "uuid",
  "scan_id": "uuid",
  "status": "processing",
  "estimated_duration_ms": 8000
}
```

**Response 200 (if already analyzed):**
```json
{
  "analysis_id": "uuid",
  "scan_id": "uuid",
  "status": "completed",
  "result": { ... }
}
```

**Errors:**
- `400` — Invalid scan_id or analysis_type
- `401` — Authentication required
- `404` — Scan not found
- `409` — Analysis already in progress for this scan
- `429` — Rate limit exceeded
- `500` — Server error

### 8.2 GET /analysis/:id

Retrieve an analysis result by ID.

**Request:**
```
GET /analysis/{id}
```

**Response 200:**
```json
{
  "id": "uuid",
  "scan_id": "uuid",
  "status": "completed",
  "result": {
    "title": "Fresh Banana",
    "category": "food",
    "summary": "A ripe banana, approximately 7 inches long.",
    "confidence": 0.95,
    "risk_level": "LOW",
    "observations": ["Yellow peel with slight brown spotting"],
    "actions": ["Safe to eat"],
    "warnings": [],
    "when_to_seek_help": null,
    "follow_up_suggestions": ["How long will it stay fresh?"],
    "moment": {
      "headline": "This ripe banana is ready to eat now",
      "action": "Peel and enjoy, or store at room temperature for 1-2 days"
    },
    "created_at": "2026-09-07T12:00:08Z"
  },
  "created_at": "2026-09-07T12:00:08Z"
}
```

**Response 200 (processing):**
```json
{
  "id": "uuid",
  "scan_id": "uuid",
  "status": "processing",
  "result": null,
  "created_at": "2026-09-07T12:00:08Z"
}
```

**Errors:**
- `404` — Analysis not found
- `401` — Authentication required

### 8.3 POST /analysis/:id/follow-up

Ask a follow-up question about an existing analysis.

**Request:**
```json
{
  "question": "Is this safe for a 2-year-old?"
}
```

**Response 200:**
```json
{
  "message": {
    "id": "uuid",
    "role": "assistant",
    "content": "Bananas are generally safe for toddlers over 12 months...",
    "created_at": "2026-09-07T12:05:00Z"
  }
}
```

**Response 202 (streaming, future):**
```json
{
  "message_id": "uuid",
  "status": "streaming",
  "stream_url": "wss://api.lifelens.app/analysis/{id}/stream"
}
```

**Errors:**
- `400` — Missing or empty question
- `401` — Authentication required
- `404` — Analysis not found
- `429` — Rate limit exceeded
- `500` — Server error

### 8.4 GET /analysis/:id/chat-history

Retrieve the conversation history for an analysis.

**Request:**
```
GET /analysis/{id}/chat-history?page=1&limit=50
```

**Response 200:**
```json
{
  "messages": [
    {
      "id": "uuid",
      "role": "user",
      "content": "Is this safe for a 2-year-old?",
      "created_at": "2026-09-07T12:05:00Z"
    },
    {
      "id": "uuid",
      "role": "assistant",
      "content": "Bananas are generally safe for toddlers...",
      "created_at": "2026-09-07T12:05:02Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 2,
    "total_pages": 1
  }
}
```

**Errors:**
- `401` — Authentication required
- `404` — Analysis not found
