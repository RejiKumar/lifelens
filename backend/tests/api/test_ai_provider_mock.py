"""AI provider seam tests (task 6.5, extended for lifelens-moment-v1)."""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from app.core.errors import AnalysisFailedError
from app.providers.base import RawAnalysis
from app.providers.stub import StubProvider
from app.schemas.scan import AnalysisResult, Moment, RiskLevel
from app.services.analysis import AnalysisService


class _BrokenProvider:
    async def analyze_image(
        self, image_bytes: bytes, mime: str, context: str | None = None
    ) -> object:
        return object()


def _raw() -> RawAnalysis:
    return RawAnalysis(
        title="t",
        category="c",
        summary="s",
        confidence=0.5,
        risk_level="LOW",
        headline="Why it matters",
        action="Do this",
        observations=["o"],
        actions=[],
        warnings=[],
        when_to_seek_help=None,
        follow_up_suggestions=[],
    )


async def test_stub_provider_returns_schema_shaped_analysis() -> None:
    stub = StubProvider()
    raw = await stub.analyze_image(b"fake-bytes", "image/jpeg")
    assert isinstance(raw, RawAnalysis)
    assert raw.title
    assert 0.0 <= raw.confidence <= 1.0
    assert raw.risk_level == "LOW"
    assert raw.headline
    assert raw.action
    assert len(raw.observations) >= 1
    analysis = AnalysisResult(
        title=raw.title,
        category=raw.category,
        summary=raw.summary,
        confidence=raw.confidence,
        risk_level=RiskLevel(raw.risk_level),
        moment=Moment(headline=raw.headline, action=raw.action),
        observations=raw.observations,
        actions=raw.actions,
        warnings=raw.warnings,
        when_to_seek_help=raw.when_to_seek_help,
        follow_up_suggestions=raw.follow_up_suggestions,
    )
    assert analysis.title == raw.title
    assert analysis.moment.headline == raw.headline
    assert analysis.moment.action == raw.action


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
        headline="Why it matters",
        action="Do this",
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


def test_coerce_passes_moment_through() -> None:
    record, result, _ = AnalysisService._coerce(_raw())
    assert record.moment_headline == "Why it matters"
    assert record.moment_action == "Do this"
    assert result.moment.headline == "Why it matters"
    assert result.moment.action == "Do this"


@pytest.mark.parametrize("field", ["headline", "action"])
def test_coerce_rejects_empty_moment_field(field: str) -> None:
    raw = _raw()
    setattr(raw, field, "   ")
    with pytest.raises(AnalysisFailedError):
        AnalysisService._coerce(raw)


def test_coerce_rejects_absent_moment_attribute() -> None:
    raw = SimpleNamespace(
        title="t",
        category="c",
        summary="s",
        confidence=0.5,
        risk_level="LOW",
        observations=["o"],
        actions=[],
        warnings=[],
        when_to_seek_help=None,
        follow_up_suggestions=[],
    )
    with pytest.raises(AnalysisFailedError):
        AnalysisService._coerce(raw)
