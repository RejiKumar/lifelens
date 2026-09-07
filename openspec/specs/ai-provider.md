# AI Provider Architecture Specification

**Module:** AI Provider
**Version:** 1.0.0
**Status:** Active
**Last Updated:** 2026-09-07

---

## 1. Overview

The AI Provider module abstracts all external AI service interactions behind a unified interface. It handles provider selection, authentication, request formatting, response parsing, error mapping, retry logic, and observability. The architecture is designed to support multiple providers with a clean switchover mechanism for future provider additions.

---

## 2. Provider Interface (AIProvider)

### 2.1 Abstract Base

All providers implement the `AIProvider` protocol/interface. This is the contract that the rest of the system depends on.

```python
from abc import ABC, abstractmethod
from typing import Optional
from pydantic import BaseModel


class AnalysisPrompt(BaseModel):
    image_data: bytes
    image_mime_type: str  # "image/jpeg" or "image/webp"
    system_prompt: str
    user_prompt: str
    response_schema: dict  # JSON Schema for structured output
    context: Optional[str] = None


class ProviderResponse(BaseModel):
    content: dict  # Parsed JSON matching the response schema
    model: str
    provider: str
    latency_ms: int
    token_usage: Optional[dict] = None


class AIProvider(ABC):

    @abstractmethod
    async def analyze_image(self, prompt: AnalysisPrompt) -> ProviderResponse:
        """Send an image + text prompt and return a structured response."""
        ...

    @abstractmethod
    async def generate_text(self, system_prompt: str, user_prompt: str) -> str:
        """Send a text-only prompt and return a text response."""
        ...

    @abstractmethod
    async def health_check(self) -> bool:
        """Check if the provider is reachable and credentials are valid."""
        ...
```

### 2.2 Input Contract

`AnalysisPrompt` fields:

| Field              | Type     | Required | Description                                      |
|-------------------|----------|----------|--------------------------------------------------|
| `image_data`      | bytes    | yes      | Raw image bytes (JPEG/WebP)                      |
| `image_mime_type` | string   | yes      | MIME type of the image                           |
| `system_prompt`   | string   | yes      | System-level instructions for the AI model       |
| `user_prompt`     | string   | yes      | User-level prompt containing the analysis task   |
| `response_schema` | dict     | yes      | JSON Schema the response must conform to         |
| `context`         | string   | no       | Optional prior context (e.g., previous analysis) |

### 2.3 Output Contract

`ProviderResponse` fields:

| Field         | Type     | Description                                    |
|--------------|----------|------------------------------------------------|
| `content`    | dict     | Parsed JSON matching the requested schema      |
| `model`      | string   | Model identifier used (e.g., "gemini-1.5-flash") |
| `provider`   | string   | Provider name (e.g., "gemini")                 |
| `latency_ms` | int      | Round-trip time in milliseconds                |
| `token_usage`| dict     | Optional token counts (input/output)           |

---

## 3. GeminiProvider (MVP)

### 3.1 Google Gemini API Integration

- Use the Google Generative AI SDK (`google-generativeai` for Python)
- Endpoint: `generativelanguage.googleapis.com`
- Authentication: API key via `GOOGLE_AI_API_KEY` environment variable

### 3.2 Model Configuration

| Parameter         | Default Value        |
|------------------|---------------------|
| Model             | `gemini-1.5-flash`  |
| Temperature       | 0.2                 |
| Max output tokens | 2048                |
| Top-P             | 0.95                |

- Model name is configurable via `AI_MODEL_GEMINI` environment variable
- Temperature is low (0.2) for factual, consistent analysis output

### 3.3 Multimodal Input

- Encode image as base64 and attach as `InlineData` in the Gemini request
- Set `mime_type` on the `InlineData` object to match the image format
- Precede the image with the system prompt as a `SystemInstruction`
- Follow with the user prompt as a `Content` role message
- Include the response schema in `generation_config.response_schema` with `response_mime_type: "application/json"`

### 3.4 Structured Output

- Use Gemini's native JSON mode with a response schema
- The schema is the `AnalysisResult` schema (see ai-analysis.md)
- If the model returns non-JSON despite the schema, catch the parse error and map to `MODEL_ERROR`
- Validate the parsed JSON against the schema before returning

### 3.5 Rate Limiting Awareness

- Gemini free tier: 15 RPM, 1 million tokens/day
- Gemini paid tier: 60 RPM, 2 million tokens/day
- Track request count per minute in a sliding window
- If approaching the limit, add artificial delay before sending
- Return `RATE_LIMITED` error if the limit is exceeded
- Monitor `429` responses from the Gemini API and map them

### 3.6 Error Mapping

| Gemini Error Code    | Internal Category |
|---------------------|-------------------|
| `429`               | RATE_LIMITED      |
| `401`, `403`        | AUTH_FAILED       |
| `400`               | INVALID_REQUEST   |
| `500`, `502`, `503` | MODEL_ERROR       |
| `DEADLINE_EXCEEDED` | TIMEOUT           |
| Connection error    | NETWORK_ERROR     |
| Unexpected error    | UNKNOWN           |

---

## 4. OpenAIProvider (Future)

### 4.1 Prepared Interface

- Implements the same `AIProvider` interface as `GeminiProvider`
- Marked as `FutureProvider` — available for import but not wired into the default provider chain
- Enable via `AI_PROVIDER=openai` environment variable

### 4.2 Model Configuration

| Parameter         | Default Value           |
|------------------|------------------------|
| Model             | `gpt-4o`               |
| Temperature       | 0.2                     |
| Max tokens        | 2048                    |

- Model name configurable via `AI_MODEL_OPENAI` environment variable

### 4.3 Vision Integration

- Use OpenAI's vision-capable models (GPT-4o or equivalent)
- Send image as base64 in the `image_url` content part with `data:image/jpeg;base64,...` format
- System prompt goes in the `system` role message
- User prompt + image go in the `user` role message

### 4.4 Structured Output

- Use OpenAI's JSON mode: `response_format: { "type": "json_object" }`
- Include the schema description in the system prompt
- Validate the response against the schema using Pydantic
- If validation fails, retry once with a more explicit prompt

### 4.5 Authentication

- API key via `OPENAI_API_KEY` environment variable
- Same credential handling rules as GeminiProvider (see Section 7)

---

## 5. Error Handling

### 5.1 Internal Error Categories

```python
from enum import Enum


class ProviderErrorCategory(Enum):
    RATE_LIMITED = "rate_limited"
    AUTH_FAILED = "auth_failed"
    INVALID_REQUEST = "invalid_request"
    MODEL_ERROR = "model_error"
    TIMEOUT = "timeout"
    NETWORK_ERROR = "network_error"
    UNKNOWN = "unknown"
```

### 5.2 Error Propagation

- Provider-specific errors are caught and mapped to `ProviderErrorCategory`
- The calling code receives a typed error, not a raw provider exception
- Error includes: category, message (user-friendly), raw error (for logging), retryable flag

```python
class ProviderError(Exception):
    category: ProviderErrorCategory
    message: str  # User-friendly
    raw_error: Optional[Exception]
    retryable: bool
```

### 5.3 Client-Facing Messages

| Category        | User-Facing Message                                                  |
|----------------|----------------------------------------------------------------------|
| RATE_LIMITED   | "Our AI service is busy right now. Please try again in a moment."   |
| AUTH_FAILED    | "Service configuration error. Please contact support."              |
| INVALID_REQUEST| "The image could not be processed. Please try a different image."   |
| MODEL_ERROR    | "Analysis failed due to an internal error. Please try again."       |
| TIMEOUT        | "Analysis took too long. Please try again with a simpler image."    |
| NETWORK_ERROR  | "Network error. Please check your connection and try again."        |
| UNKNOWN        | "Something went wrong. Please try again."                           |

### 5.4 Retry Logic

- Retry only on errors marked `retryable: true` (TIMEOUT, NETWORK_ERROR, RATE_LIMITED)
- Exponential backoff: 1s, 2s, 4s
- Maximum retries: 3 (configurable via `AI_MAX_RETRIES`, default 3)
- Do not retry AUTH_FAILED or INVALID_REQUEST
- Do not retry MODEL_ERROR (it likely indicates a prompt or schema issue)

---

## 6. Timeouts

### 6.1 Per-Request Timeout

| Parameter              | Default | Configurable Via        |
|-----------------------|---------|------------------------|
| AI call timeout        | 30s     | `AI_TIMEOUT_SECONDS`   |
| Upload timeout         | 60s     | `UPLOAD_TIMEOUT_SECONDS`|
| Total analysis timeout | 45s     | Derived (upload + AI)   |

### 6.2 Timeout Behavior

- If the AI call exceeds the timeout, the request is cancelled
- Cancelled request triggers the retry logic (TIMEOUT is retryable)
- After all retries are exhausted, return a TIMEOUT error to the client
- Never let a single request hang indefinitely

---

## 7. Security

### 7.1 Credential Management

- AI API keys are stored **only** on the backend
- Keys are loaded from environment variables at startup
- Keys are never included in client responses, logs, or error messages
- Keys are never hardcoded in source files

### 7.2 Environment Variables

| Variable              | Provider | Description                    |
|----------------------|----------|--------------------------------|
| `GOOGLE_AI_API_KEY` | Gemini   | Google Generative AI API key   |
| `OPENAI_API_KEY`    | OpenAI   | OpenAI API key                 |

### 7.3 Data Handling

- Never log prompts containing sensitive content in production
- Never log raw image data at any log level
- Never log full API responses that may contain user data
- Strip image data from error reports before logging
- Image data is held in memory only during processing and released immediately after

### 7.4 Key Rotation

- API keys should be rotated every 90 days
- The system supports key rotation without downtime by reading environment variables at request time (not caching at startup)
- If a key becomes invalid, the system returns `AUTH_FAILED` and the operator is expected to update the key

---

## 8. Logging

### 8.1 Structured Logging

All provider interactions are logged with a structured format:

```json
{
  "timestamp": "2026-09-07T12:00:00Z",
  "level": "info",
  "event": "ai_provider_call",
  "provider": "gemini",
  "model": "gemini-1.5-flash",
  "latency_ms": 3200,
  "success": true,
  "category": null,
  "retry_count": 0,
  "scan_id": "uuid",
  "analysis_id": "uuid"
}
```

### 8.2 What to Log

| Field         | Always | Notes                                          |
|--------------|--------|-------------------------------------------------|
| provider     | yes    | Provider name                                   |
| model        | yes    | Model identifier                                |
| latency_ms   | yes    | Round-trip duration                             |
| success      | yes    | Whether the call succeeded                      |
| category     | no     | Error category if failed                        |
| retry_count  | no     | Number of retries attempted                     |
| scan_id      | yes    | Reference to the scan                           |
| analysis_id  | no     | Reference to the analysis if created            |
| error_type   | no     | Exception class name if failed                  |

### 8.3 What NOT to Log

- Prompt content (system or user)
- AI response content
- Raw image data or image metadata
- Full API request/response bodies
- API keys or tokens
- User-identifiable information beyond the scan/analysis ID

### 8.4 Log Levels

| Level   | Usage                                                    |
|--------|----------------------------------------------------------|
| DEBUG   | Request/response details in non-production only          |
| INFO    | Successful calls, retries, health checks                 |
| WARN    | Retries in progress, rate limit approaching              |
| ERROR   | Failed calls after all retries, auth failures            |
| CRITICAL| Provider completely unreachable, all providers failing   |

---

## 9. Configuration

### 9.1 Provider Selection

| Variable          | Default   | Values                    | Description                    |
|------------------|-----------|---------------------------|--------------------------------|
| `AI_PROVIDER`   | `gemini`  | `gemini`, `openai`        | Active AI provider             |
| `AI_MODEL_GEMINI`| `gemini-1.5-flash` | Any Gemini model   | Gemini model override          |
| `AI_MODEL_OPENAI`| `gpt-4o`  | Any OpenAI vision model   | OpenAI model override          |

### 9.2 Performance Tuning

| Variable              | Default | Description                          |
|----------------------|---------|--------------------------------------|
| `AI_TIMEOUT_SECONDS` | 30      | Per-request timeout for AI calls     |
| `AI_MAX_RETRIES`     | 3       | Maximum retry attempts               |
| `AI_TEMPERATURE`     | 0.2     | Model temperature                    |
| `AI_MAX_TOKENS`      | 2048    | Maximum output tokens                |

### 9.3 Fallback Provider Chain (Future)

- Configure a ordered list of providers: `AI_PROVIDER_CHAIN=gemini,openai`
- If the primary provider fails with a non-retryable error, fall back to the next provider
- Fallback is NOT triggered by RATE_LIMITED (respect rate limits, don't cascade)
- Fallback IS triggered by: AUTH_FAILED, MODEL_ERROR, TIMEOUT (after retries exhausted)
- This feature is deferred to post-MVP

---

## 10. Health Monitoring

### 10.1 Health Check Endpoint

- `GET /health/ai` — checks the active provider's health
- Calls `provider.health_check()` which pings the provider API
- Returns `200` if healthy, `503` if unhealthy
- Used by load balancers and uptime monitoring

### 10.2 Metrics Collection

- Track success rate per provider per hour
- Track average latency per provider per hour
- Track error rate per error category per hour
- Expose via Prometheus-compatible metrics endpoint (future)
