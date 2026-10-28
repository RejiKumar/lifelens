"""Trust-layer analysis tests: evidence normalization, honesty policy, grounded severity."""

from __future__ import annotations

import pytest
from pydantic import ValidationError as PydanticValidationError

from app.core.errors import AnalysisFailedError
from app.providers.base import RawAnalysis
from app.schemas.scan import AnalysisResult, RiskLevel
from app.services.analysis import _LOW_CONFIDENCE_WARNING, AnalysisService


def _raw(**overrides: object) -> RawAnalysis:
    base = {
        "title": "A cable",
        "category": "electronics",
        "summary": "A power cable with exposed wiring.",
        "confidence": 0.9,
        "risk_level": "LOW",
        "headline": "Handle with care.",
        "action": "No immediate action.",
        "observations": ["Copper wire is visible."],
        "evidence": ["Copper wire is visible at the end."],
        "actions": [],
        "warnings": [],
        "when_to_seek_help": None,
        "follow_up_suggestions": [],
    }
    base.update(overrides)
    return RawAnalysis(**base)


def test_coerce_normalizes_evidence_items() -> None:
    raw = _raw(
        evidence=["  Visible copper wire  ", "", "x" * 400],
        confidence=0.8,
        risk_level="LOW",
    )
    record, result, _ = AnalysisService._coerce(raw)
    assert record.evidence == ["Visible copper wire", "x" * 300]
    assert result.evidence == ["Visible copper wire", "x" * 300]


def test_coerce_caps_evidence_at_ten_items() -> None:
    raw = _raw(
        evidence=[f"clue {i}" for i in range(12)],
        confidence=0.8,
        risk_level="LOW",
    )
    record, _, _ = AnalysisService._coerce(raw)
    assert len(record.evidence) == 10
    assert record.evidence[0] == "clue 0"
    assert record.evidence[-1] == "clue 9"


def test_missing_evidence_defaults_to_empty() -> None:
    raw = _raw(confidence=0.9, risk_level="LOW")
    del raw.evidence  # type: ignore[attr-defined]
    record, result, _ = AnalysisService._coerce(raw)
    assert record.evidence == []
    assert result.evidence == []


def test_low_confidence_floors_risk_at_medium() -> None:
    record, result, safety = AnalysisService._coerce(
        _raw(confidence=0.2, risk_level="LOW")
    )
    assert record.risk_level == "MEDIUM"
    assert result.risk_level == RiskLevel.MEDIUM
    assert safety.risk_level == RiskLevel.MEDIUM


def test_low_confidence_does_not_downgrade_severe_risk() -> None:
    record, result, _ = AnalysisService._coerce(
        _raw(confidence=0.2, risk_level="HIGH")
    )
    assert record.risk_level == "HIGH"
    assert result.risk_level == RiskLevel.HIGH


def test_subhalf_confidence_injects_low_confidence_warning() -> None:
    record, _, _ = AnalysisService._coerce(
        _raw(confidence=0.4, evidence=[], risk_level="MEDIUM")
    )
    assert _LOW_CONFIDENCE_WARNING in record.warnings


def test_half_confidence_does_not_inject_warning() -> None:
    record, _, _ = AnalysisService._coerce(
        _raw(confidence=0.5, evidence=[], risk_level="MEDIUM")
    )
    assert _LOW_CONFIDENCE_WARNING not in record.warnings


def test_low_confidence_warning_is_deduplicated() -> None:
    record, _, _ = AnalysisService._coerce(
        _raw(
            confidence=0.3,
            evidence=[],
            risk_level="MEDIUM",
            warnings=[_LOW_CONFIDENCE_WARNING],
        )
    )
    assert record.warnings.count(_LOW_CONFIDENCE_WARNING) == 1


def test_high_risk_without_evidence_is_rejected() -> None:
    with pytest.raises(AnalysisFailedError):
        AnalysisService._coerce(_raw(confidence=0.9, risk_level="HIGH", evidence=[]))


def test_critical_risk_without_evidence_is_rejected() -> None:
    with pytest.raises(AnalysisFailedError):
        AnalysisService._coerce(
            _raw(confidence=0.9, risk_level="CRITICAL", evidence=[])
        )


def test_high_risk_with_evidence_is_accepted() -> None:
    record, result, _ = AnalysisService._coerce(
        _raw(confidence=0.9, risk_level="HIGH")
    )
    assert record.risk_level == "HIGH"
    assert result.risk_level == RiskLevel.HIGH


def test_stub_provider_returns_grounded_evidence() -> None:
    import asyncio

    from app.providers.stub import StubProvider

    raw = asyncio.run(
        StubProvider().analyze_image(b"fake-bytes", "image/jpeg")
    )
    assert isinstance(raw.evidence, list)
    assert len(raw.evidence) >= 1


def test_analysis_schema_rejects_oversized_evidence_item() -> None:
    payload = {
        "title": "A mug",
        "category": "houseware",
        "summary": "A ceramic mug.",
        "confidence": 0.9,
        "risk_level": RiskLevel.LOW,
        "moment": {"headline": "It is intact.", "action": "Reuse as normal."},
        "observations": ["Smooth and intact."],
        "evidence": ["x" * 301],
        "actions": [],
        "warnings": [],
        "when_to_seek_help": None,
        "follow_up_suggestions": [],
    }
    with pytest.raises(PydanticValidationError):
        AnalysisResult.model_validate(payload)
