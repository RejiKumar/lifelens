"""Gemini provider tests.

Exercises the provider in isolation using ``httpx.MockTransport``; no network
calls, no real API key, no real image. Also verifies provider selection wiring.
"""

from __future__ import annotations

import base64
import json
from typing import Any

import httpx
import pytest

from app.api import deps
from app.core.config import Settings
from app.providers.base import ProviderCategory, ProviderError, RawAnalysis
from app.providers.gemini import GeminiProvider
from app.providers.stub import StubProvider


def _analysis_json() -> str:
    return json.dumps(
        {
            "title": "Smashed phone screen",
            "category": "Consumer-electronics",
            "summary": "A phone with a cracked display.",
            "confidence": 0.9,
            "risk_level": "LOW",
            "headline": "The glass is shattered, so take care not to press on the cracks.",
            "action": "Put it in a case and have the screen replaced when convenient.",
            "observations": ["Cracked glass"],
            "actions": ["Use a case"],
            "warnings": ["Sharp edges"],
            "when_to_seek_help": None,
            "follow_up_suggestions": ["Visit a repair shop"],
        }
    )


def _gemini_response(text: str) -> dict[str, Any]:
    return {
        "candidates": [
            {
                "content": {"role": "model", "parts": [{"text": text}]},
                "finishReason": "STOP",
            }
        ]
    }


def _provider(transport: httpx.MockTransport) -> GeminiProvider:
    return GeminiProvider(
        api_key="test-key",
        model="gemini-2.5-flash",
        client=httpx.AsyncClient(transport=transport),
    )


async def test_happy_path_maps_raw_analysis_with_moment() -> None:
    captured: dict[str, Any] = {}

    async def handler(request: httpx.Request) -> httpx.Response:
        captured["json"] = json.loads(request.content)
        captured["key"] = request.headers.get("x-goog-api-key")
        captured["url"] = str(request.url)
        return httpx.Response(200, json=_gemini_response(_analysis_json()))

    provider = _provider(httpx.MockTransport(handler))
    raw = await provider.analyze_image(b"\xff\xd8fake", "image/jpeg")

    assert isinstance(raw, RawAnalysis)
    assert raw.headline == "The glass is shattered, so take care not to press on the cracks."
    assert raw.action.startswith("Put it in a case")
    assert captured["key"] == "test-key" and "generateContent" in captured["url"]

    body = captured["json"]
    schema = body["generationConfig"]["responseSchema"]
    assert body["generationConfig"]["responseMimeType"] == "application/json"
    assert set(schema["required"]) >= {"title", "risk_level", "headline", "action"}
    system = body["systemInstruction"]["parts"][0]["text"]
    assert "MOMENT" in system and "Never" in system and "risk_level" in system
    part = body["contents"][0]["parts"][0]["inlineData"]
    assert part["mimeType"] == "image/jpeg"
    assert part["data"] == base64.b64encode(b"\xff\xd8fake").decode("ascii")


async def test_validates_malformed_response_body() -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"unexpected": {}})

    with pytest.raises(ProviderError) as exc_info:
        await _provider(httpx.MockTransport(handler)).analyze_image(b"data", "image/png")
    assert exc_info.value.category == ProviderCategory.MODEL_ERROR
    assert not exc_info.value.retryable


async def test_rejects_unparsable_structured_text() -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=_gemini_response("not json at all"))

    with pytest.raises(ProviderError) as exc_info:
        await _provider(httpx.MockTransport(handler)).analyze_image(b"data", "image/png")
    assert exc_info.value.category == ProviderCategory.MODEL_ERROR


async def test_maps_status_codes() -> None:
    cases = [
        (429, ProviderCategory.RATE_LIMITED, True),
        (403, ProviderCategory.AUTH_FAILED, False),
        (400, ProviderCategory.INVALID_REQUEST, False),
        (500, ProviderCategory.MODEL_ERROR, False),
    ]
    for status, category, retryable in cases:
        async def handler(request: httpx.Request, _status=status) -> httpx.Response:
            return httpx.Response(_status, json={"error": {"message": "nope"}})

        with pytest.raises(ProviderError) as exc_info:
            await _provider(httpx.MockTransport(handler)).analyze_image(b"data", "image/png")
        assert exc_info.value.category == category
        assert exc_info.value.retryable == retryable


async def test_maps_timeout_to_retryable_timeout() -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("timed out")

    with pytest.raises(ProviderError) as exc_info:
        await _provider(httpx.MockTransport(handler)).analyze_image(b"data", "image/png")
    assert exc_info.value.category == ProviderCategory.TIMEOUT
    assert exc_info.value.retryable


async def test_maps_network_error_to_retryable_network() -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("connection refused")

    with pytest.raises(ProviderError) as exc_info:
        await _provider(httpx.MockTransport(handler)).analyze_image(b"data", "image/png")
    assert exc_info.value.category == ProviderCategory.NETWORK_ERROR
    assert exc_info.value.retryable


async def test_missing_api_key_fails_fast() -> None:
    provider = GeminiProvider(
        api_key="",
        model="gemini-2.5-flash",
        client=httpx.AsyncClient(),
    )
    with pytest.raises(ProviderError) as exc_info:
        await provider.analyze_image(b"data", "image/png")
    assert exc_info.value.category == ProviderCategory.AUTH_FAILED
    assert not exc_info.value.retryable


def test_provider_selection_stub() -> None:
    settings = Settings(_env_file=None, ai_provider="stub")
    assert isinstance(deps.get_provider(settings), StubProvider)


def test_provider_selection_gemini() -> None:
    settings = Settings(
        _env_file=None, ai_provider="gemini", google_ai_api_key="k"
    )
    provider = deps.get_provider(settings)
    assert isinstance(provider, GeminiProvider)
    assert provider._api_key == "k"


def test_provider_selection_gemini_without_key_fails_fast() -> None:
    settings = Settings(_env_file=None, ai_provider="gemini")
    with pytest.raises(RuntimeError, match="GOOGLE_AI_API_KEY"):
        deps.get_provider(settings)
