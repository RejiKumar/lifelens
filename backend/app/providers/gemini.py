"""Production Gemini AI provider.

Calls the generative language REST API with structured output
(``responseMimeType: application/json`` + ``responseSchema``) so a single
request returns the whole analysis: identification, confidence, safety
metadata, and the LifeLens Moment (headline + action). The model's JSON is
adapted into a :class:`RawAnalysis`; the analysis service remains the single
authority that clamps, validates, and rejects malformed content.

Security rules honoured here:
- the API key travels only in the request header, never into any log or error
  message, and is never exposed to the mobile client;
- the original image never leaves this provider's request payload nor lands
  in logs/analytics;
- prompts encode the ai-moment safety rules so the Moment is grounded and
  conservative, while the server rejects it whenever it is missing/blank.

This module never fabricates a fallback analysis while serving requests; the
deterministic stub (``StubProvider``) is available only for local QA and tests.
"""

from __future__ import annotations

import base64
import json
from collections.abc import Mapping
from typing import Any

import httpx

from app.providers.base import (
    ProviderCategory,
    ProviderError,
    RawAnalysis,
)

_GENERATE_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

_MAX_IMAGE_B64 = 4 * 1024 * 1024

_SYSTEM_INSTRUCTION = (
    "You are LifeLens, an AI visual understanding assistant. Analyse the image and "
    "return only JSON matching the requested schema. Follow these rules strictly.\n\n"
    "IDENTIFICATION\n"
    "- Identify what is shown in simple, non-technical language.\n"
    "- If you are not confident, say so in the summary and keep risk_level at or above "
    "MEDIUM rather than guessing LOW.\n\n"
    "SAFETY\n"
    "- risk_level must be one of LOW, MEDIUM, HIGH, CRITICAL and must be conservative: "
    "when in doubt, choose the higher level.\n"
    "- warnings must include anything the person should not touch, switch on, or "
    "approach; for electrical, fire, gas, chemical, medical, structural, vehicle, or "
    "hazardous-substance situations, state the danger plainly.\n"
    "- when_to_seek_help must be set whenever professional help is advisable.\n\n"
    "MOMENT (most important)\n"
    "- headline: the ONE thing the user needs to understand right now - why this item "
    "matters for their safety or their next decision. Ground it ONLY in what is "
    "visible in the image. One short sentence, plain language.\n"
    "- action: the single safest next step the person can take. Base it ONLY on what "
    "is visible. Match the risk level: for LOW/MEDIUM give a direct, safe next step; "
    "for HIGH/CRITICAL the action must be to move away, call emergency services, or "
    "contact a professional - never a dangerous procedure.\n"
    "- Never invent causes, disassembly steps, repairs, or anything not visible.\n"
    "- Never contradict the risk_level. Never produce an empty headline or action."
)

_USER_INSTRUCTION = (
    'Analyse this image and return the response as the JSON object described by the '
    'schema. You MUST include non-empty "headline" and "action". Do not include any '
    'text outside the JSON object.'
)


class GeminiProvider:
    """AIProvider backed by the Gemini ``generateContent`` REST endpoint."""

    _client: httpx.AsyncClient | None = None

    def __init__(
        self,
        *,
        api_key: str,
        model: str,
        timeout_seconds: float = 30.0,
        temperature: float = 0.2,
        max_tokens: int = 2048,
        top_p: float = 0.95,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self._api_key = api_key
        self._model = model
        self._timeout_seconds = timeout_seconds
        self._temperature = temperature
        self._max_tokens = max_tokens
        self._top_p = top_p
        self._client_override = client

    @property
    def _http(self) -> httpx.AsyncClient:
        if GeminiProvider._client is None:
            GeminiProvider._client = httpx.AsyncClient(
                timeout=httpx.Timeout(self._timeout_seconds)
            )
        return GeminiProvider._client

    async def analyze_image(
        self,
        image_bytes: bytes,
        mime: str,
        context: str | None = None,
    ) -> RawAnalysis:
        if not self._api_key:
            raise ProviderError(
                ProviderCategory.AUTH_FAILED,
                "Gemini provider is not configured with an API key.",
            )
        payload = self._build_payload(image_bytes, mime, context)
        client = self._client_override or self._http
        try:
            response = await client.post(
                _GENERATE_URL.format(model=self._model),
                headers={"x-goog-api-key": self._api_key},
                json=payload,
                timeout=self._timeout_seconds,
            )
        except httpx.TimeoutException as exc:
            raise ProviderError(
                ProviderCategory.TIMEOUT,
                "The AI service took too long to respond.",
                retryable=True,
                raw=exc,
            ) from exc
        except httpx.HTTPError as exc:
            raise ProviderError(
                ProviderCategory.NETWORK_ERROR,
                "Could not reach the AI service.",
                retryable=True,
                raw=exc,
            ) from exc

        if response.status_code == 429:
            raise ProviderError(
                ProviderCategory.RATE_LIMITED,
                "The AI service is busy. Please try again shortly.",
                retryable=True,
            )
        if response.status_code in (401, 403):
            raise ProviderError(
                ProviderCategory.AUTH_FAILED,
                "The AI service rejected the request credentials.",
            )
        if response.status_code == 400:
            raise ProviderError(
                ProviderCategory.INVALID_REQUEST,
                "The AI service rejected the analysis request.",
            )
        if response.status_code >= 500:
            raise ProviderError(
                ProviderCategory.MODEL_ERROR,
                "The AI service reported an internal error.",
            )
        if response.status_code != 200:
            raise ProviderError(
                ProviderCategory.UNKNOWN,
                f"Unexpected AI service status {response.status_code}.",
            )

        try:
            data = response.json()
        except (ValueError, json.JSONDecodeError) as exc:
            raise ProviderError(
                ProviderCategory.MODEL_ERROR,
                "The AI service returned a malformed response.",
                raw=exc,
            ) from exc
        return self._to_raw_analysis(data)

    def _build_payload(
        self, image_bytes: bytes, mime: str, context: str | None
    ) -> dict[str, Any]:
        image_b64 = base64.b64encode(image_bytes).decode("ascii")
        if len(image_b64) > _MAX_IMAGE_B64:
            raise ProviderError(
                ProviderCategory.INVALID_REQUEST,
                "The image is too large for the AI service.",
            )
        parts: list[dict[str, Any]] = [
            {
                "inlineData": {
                    "mimeType": mime,
                    "data": image_b64,
                }
            },
            {"text": _USER_INSTRUCTION},
        ]
        if context:
            parts.append({"text": f"User context to consider: {context[:2000]}"})
        return {
            "systemInstruction": {"parts": [{"text": _SYSTEM_INSTRUCTION}]},
            "contents": [
                {
                    "role": "user",
                    "parts": parts,
                }
            ],
            "generationConfig": {
                "temperature": self._temperature,
                "topP": self._top_p,
                "maxOutputTokens": self._max_tokens,
                "responseMimeType": "application/json",
                "responseSchema": _RESPONSE_SCHEMA,
            },
        }

    @staticmethod
    def _to_raw_analysis(data: Mapping[str, Any]) -> RawAnalysis:
        text = _extract_text(data)
        if text is None:
            raise ProviderError(
                ProviderCategory.MODEL_ERROR,
                "The AI service returned no analysis content.",
            )
        try:
            parsed = json.loads(text)
        except (ValueError, json.JSONDecodeError) as exc:
            raise ProviderError(
                ProviderCategory.MODEL_ERROR,
                "The AI service returned unparsable structured output.",
                raw=exc,
            ) from exc
        if not isinstance(parsed, dict):
            raise ProviderError(
                ProviderCategory.MODEL_ERROR,
                "The AI service returned an invalid analysis object.",
            )
        return RawAnalysis(
            title=_as_text(parsed.get("title")),
            category=_as_text(parsed.get("category")),
            summary=_as_text(parsed.get("summary")),
            confidence=_as_float(parsed.get("confidence")),
            risk_level=_as_text(parsed.get("risk_level")),
            headline=_as_text(parsed.get("headline")),
            action=_as_text(parsed.get("action")),
            observations=_as_text_list(parsed.get("observations")),
            actions=_as_text_list(parsed.get("actions")),
            warnings=_as_text_list(parsed.get("warnings")),
            when_to_seek_help=_as_optional_text(parsed.get("when_to_seek_help")),
            follow_up_suggestions=_as_text_list(parsed.get("follow_up_suggestions")),
        )


def _extract_text(data: Mapping[str, Any]) -> str | None:
    candidates = data.get("candidates")
    if not isinstance(candidates, list) or not candidates:
        return None
    content = candidates[0].get("content")
    if not isinstance(content, Mapping):
        return None
    parts = content.get("parts")
    if not isinstance(parts, list):
        return None
    texts = [
        p["text"]
        for p in parts
        if isinstance(p, Mapping) and isinstance(p.get("text"), str)
    ]
    return texts[0] if texts else None


def _as_text(value: object) -> str:
    return str(value or "")


def _as_optional_text(value: object) -> str | None:
    text = str(value or "")
    return text or None


def _as_text_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(v) for v in value if v is not None]


def _as_float(value: object) -> float:
    if isinstance(value, (int, float, str)):
        try:
            return float(value)
        except ValueError:
            return 0.0
    return 0.0


_RESPONSE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "title": {"type": "string", "description": "Short identifier of what is shown"},
        "category": {"type": "string", "description": "Coarse category slug"},
        "summary": {"type": "string", "description": "Plain-language explanation"},
        "confidence": {"type": "number", "description": "Model's confidence 0..1"},
        "risk_level": {
            "type": "string",
            "enum": ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
        },
        "headline": {
            "type": "string",
            "description": (
                "Why this matters to the user right now. MUST be non-empty and "
                "grounded in the visible content."
            ),
        },
        "action": {
            "type": "string",
            "description": (
                "The single safest next step. MUST be non-empty, match the "
                "risk_level, and never be a dangerous procedure."
            ),
        },
        "observations": {"type": "array", "items": {"type": "string"}},
        "actions": {"type": "array", "items": {"type": "string"}},
        "warnings": {"type": "array", "items": {"type": "string"}},
        "when_to_seek_help": {"type": ["string", "null"]},
        "follow_up_suggestions": {"type": "array", "items": {"type": "string"}},
    },
    "required": [
        "title",
        "category",
        "summary",
        "confidence",
        "risk_level",
        "headline",
        "action",
        "observations",
        "actions",
        "warnings",
        "when_to_seek_help",
        "follow_up_suggestions",
    ],
    "additionalProperties": False,
}
