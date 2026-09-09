"""Deterministic stub AI provider for scan-v1 and ask-lifelens-v1.

Lets the full pipeline run and be tested without any Gemini credentials or
network access. Selected via ``AI_PROVIDER=stub``. Returns a plausible,
schema-shaped analysis for whatever image is presented and contextual,
non-empty follow-up answers that reference the stored analysis. The stub is
only for local QA and automated tests — production always uses a real
provider.
"""

from __future__ import annotations

from app.providers.base import RawAnalysis, RawFollowUp


class StubProvider:
    """AIProvider implementation returning deterministic, valid responses."""

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
            headline="It looks intact, so it's safe to handle right now.",
            action=(
                "No action needed immediately — keep it as is and rescan "
                "if it changes or worries you."
            ),
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
        title = str(analysis.get("title") or "").strip() or "the scanned item"
        risk_level = str(safety.get("risk_level") or "LOW").upper()
        answer = (
            f"Your scan shows {title}. Based on what's visible and the "
            f"analysis I recorded, the subject stays at {risk_level} risk. "
            "I'm only able to comment on what is in this image — please "
            "contact a professional for anything beyond that."
        )
        return RawFollowUp(
            answer=answer,
            risk_level=risk_level,
            follow_up_suggestions=[],
        )
