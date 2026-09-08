"""Safety metadata passthrough tests (task 6.4)."""

from __future__ import annotations

from app.providers.base import RawAnalysis
from app.schemas.scan import RiskLevel
from app.services.analysis import AnalysisService


def _raw_with(risk: str) -> RawAnalysis:
    return RawAnalysis(
        title="A cable",
        category="electronics",
        summary="A power cable with exposed wiring.",
        confidence=0.81,
        risk_level=risk,
        headline="Exposed wiring means do not use it until it's repaired.",
        action="Unplug it now and do not power it on until a professional fixes it.",
        observations=["Exposed copper wiring is visible."],
        actions=[],
        warnings=["Do not touch with wet hands."],
        when_to_seek_help="Turn off power and call an electrician if sparks occur.",
        follow_up_suggestions=[],
    )


def test_high_risk_level_and_flags_preserved() -> None:
    record, result, safety = AnalysisService._coerce(_raw_with("HIGH"))
    assert record.risk_level == "HIGH"
    assert result.risk_level == RiskLevel.HIGH
    assert safety.risk_level == RiskLevel.HIGH


def test_critical_risk_preserved() -> None:
    record, result, safety = AnalysisService._coerce(_raw_with("CRITICAL"))
    assert record.risk_level == "CRITICAL"
    assert result.risk_level == RiskLevel.CRITICAL
    assert safety.risk_level == RiskLevel.CRITICAL


def test_low_risk_default_flags_false() -> None:
    record, result, safety = AnalysisService._coerce(_raw_with("LOW"))
    assert record.risk_level == "LOW"
    assert safety.risk_level == RiskLevel.LOW
    assert safety.is_medical is False
    assert safety.is_electrical is False


def test_when_to_seek_help_preserved() -> None:
    record, result, safety = AnalysisService._coerce(_raw_with("HIGH"))
    assert record.when_to_seek_help == "Turn off power and call an electrician if sparks occur."
    assert result.when_to_seek_help is not None
