"""AI provider abstraction.

LifeLens never calls an AI service from the mobile client; the backend routes
all AI through an :class:`AIProvider`. A real Gemini implementation is the
production default (``AI_PROVIDER=gemini``); the deterministic stub is only
for local QA and automated tests (``AI_PROVIDER=stub``). Providers return a
:class:`RawAnalysis` that the analysis service normalises, clamps, and
validates before it is ever persisted or shown.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from typing import Protocol


class ProviderCategory(StrEnum):
    """Stable categories for AI provider failures.

    Converted by the analysis service into user-facing messages. Never
    surfaced to the client in their raw form.
    """

    RATE_LIMITED = "rate_limited"
    AUTH_FAILED = "auth_failed"
    INVALID_REQUEST = "invalid_request"
    MODEL_ERROR = "model_error"
    TIMEOUT = "timeout"
    NETWORK_ERROR = "network_error"
    UNKNOWN = "unknown"


class ProviderError(Exception):
    """A structured AI provider failure with a stable category.

    ``retryable`` tells the analysis service whether a backoff retry is
    worthwhile (timeout, transient network, rate limit). Configuration,
    authentication, and model-content failures are never retried.
    """

    def __init__(
        self,
        category: ProviderCategory,
        message: str,
        *,
        retryable: bool = False,
        raw: Exception | None = None,
    ) -> None:
        super().__init__(message)
        self.category = category
        self.message = message
        self.retryable = retryable
        self.raw_error = raw


@dataclass
class RawAnalysis:
    """Unvalidated analysis returned by a provider.

    Field semantics mirror the final analysis result, but values have not yet
    been clamped or safety-checked by the analysis service normaliser.
    """

    title: str
    category: str
    summary: str
    confidence: float
    risk_level: str
    headline: str
    action: str
    observations: list[str]
    actions: list[str]
    warnings: list[str]
    when_to_seek_help: str | None
    follow_up_suggestions: list[str]


@dataclass
class RawFollowUp:
    """Unvalidated follow-up answer returned by a provider.

    ``risk_level`` carries the risk level the model believes applies so the
    conversation service can assert it against the stored authoritative risk
    metadata — an answer that downplays stored HIGH/CRITICAL risk is rejected.
    """

    answer: str
    risk_level: str
    follow_up_suggestions: list[str]


class AIProvider(Protocol):
    """Interface all AI providers implement."""

    async def analyze_image(
        self,
        image_bytes: bytes,
        mime: str,
        context: str | None = None,
    ) -> RawAnalysis:
        """Analyse normalized image bytes and return a raw analysis.

        Implementations MUST bound execution time and retries internally and
        MUST raise on failure so the caller can map to ``ANALYSIS_FAILED``.
        """
        ...

    async def follow_up(
        self,
        *,
        image_bytes: bytes,
        mime: str,
        analysis: dict[str, object],
        safety: dict[str, object],
        history: list[dict[str, str]],
        question: str,
    ) -> RawFollowUp:
        """Answer a grounded follow-up question about an analysed image.

        The stored normalized image is re-sent inline (never a text-only
        answer), combined with the validated analysis payload, the
        authoritative safety metadata, recent conversation history, and the
        user's question. Implementations MUST bound execution time and MUST
        raise a :class:`ProviderError` on failure.
        """
        ...
