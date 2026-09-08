"""Deterministic stub AI provider for scan-v1.

Lets the full pipeline run and be tested without any Gemini credentials or
network access. Selected via ``AI_PROVIDER=stub``. Returns a plausible,
schema-shaped analysis for whatever image is presented.
"""

from __future__ import annotations

from app.providers.base import RawAnalysis


class StubProvider:
    """AIProvider implementation returning a fixed, valid analysis."""

    async def analyze_image(
        self,
        image_bytes: bytes,
        mime: str,
        context: str | None = None,
    ) -> RawAnalysis:
        return RawAnalysis(
            title="A common household object",
            category="other",
            summary=(
                "This appears to be a common everyday object. It does not show "
                "any indication of damage or hazard, and no safety concern was "
                "identified in the image."
            ),
            confidence=0.72,
            risk_level="LOW",
            observations=[
                "The object appears intact and in normal condition.",
                "No visible damage or unusual markings were detected.",
            ],
            actions=[
                "No immediate action is required.",
            ],
            warnings=[],
            when_to_seek_help=None,
            follow_up_suggestions=[
                "What are common uses for this item?",
                "How should I care for or maintain it?",
            ],
        )
