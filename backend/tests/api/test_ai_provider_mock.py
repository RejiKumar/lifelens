"""AI provider seam tests (task 6.5)."""

from __future__ import annotations

import pytest

from app.core.errors import AnalysisFailedError
from app.providers.base import RawAnalysis
from app.providers.stub import StubProvider
from app.schemas.scan import AnalysisResult, RiskLevel
from app.services.analysis import AnalysisService


class _BrokenProvider:
    async def analyze_image(
        self, image_bytes: bytes, mime: str, context: str | None = None
    ) -> object:
        return object()


async def test_stub_provider_returns_schema_shaped_analysis() -> None:
    stub = StubProvider()
    raw = await stub.analyze_image(b"fake-bytes", "image/jpeg")
    assert isinstance(raw, RawAnalysis)
    assert raw.title
    assert 0.0 <= raw.confidence <= 1.0
    assert raw.risk_level == "LOW"
    assert len(raw.observations) >= 1
    analysis = AnalysisResult(
        title=raw.title,
        category=raw.category,
        summary=raw.summary,
        confidence=raw.confidence,
        risk_level=RiskLevel(raw.risk_level),
        observations=raw.observations,
        actions=raw.actions,
        warnings=raw.warnings,
        when_to_seek_help=raw.when_to_seek_help,
        follow_up_suggestions=raw.follow_up_suggestions,
    )
    assert analysis.title == raw.title


async def test_normalizer_rejects_invalid_provider_output() -> None:
    broken = await _BrokenProvider().analyze_image(b"x", "image/jpeg")
    with pytest.raises(AnalysisFailedError):
        AnalysisService._coerce(broken)


async def test_invalid_risk_level_coerces_to_low() -> None:
    wrong_risk = RawAnalysis(
        title="t",
        category="c",
        summary="s",
        confidence=0.5,
        risk_level="NOT-A-LEVEL",
        observations=["o"],
        actions=[],
        warnings=[],
        when_to_seek_help=None,
        follow_up_suggestions=[],
    )
    record, result, safety = AnalysisService._coerce(wrong_risk)
    assert record.risk_level == "LOW"
    assert result.risk_level == RiskLevel.LOW
    assert safety.risk_level == RiskLevel.LOW
