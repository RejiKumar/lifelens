"""AI provider abstraction.

LifeLens never calls an AI service from the mobile client; the backend routes
all AI through an :class:`AIProvider`. scan-v1 ships a deterministic stub; a
Gemini (or OpenAI) implementation arrives in a later change without touching
the API contract, business logic, or mobile UI. Providers return a
:class:`RawAnalysis` that the analysis service normalises, clamps, and
validates before it is ever persisted or shown.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


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
    observations: list[str]
    actions: list[str]
    warnings: list[str]
    when_to_seek_help: str | None
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
