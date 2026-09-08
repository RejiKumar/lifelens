"""Schema clamp tests (task 6.2)."""

from __future__ import annotations

import pytest
from pydantic import ValidationError as PydanticValidationError

from app.schemas.scan import AnalysisResult, RiskLevel, SafetyMetadata, ScanResponse, ScanStatus


def _valid_analysis() -> dict[str, object]:
    return {
        "title": "A mug",
        "category": "houseware",
        "summary": "A ceramic mug used for drinking.",
        "confidence": 0.9,
        "risk_level": RiskLevel.LOW,
        "moment": {
            "headline": "It is intact and safe to drink from.",
            "action": "No action needed — reuse as normal.",
        },
        "observations": ["It is smooth and intact."],
        "actions": [],
        "warnings": [],
        "when_to_seek_help": None,
        "follow_up_suggestions": [],
    }


def test_analysis_result_accepts_bounded_values() -> None:
    result = AnalysisResult.model_validate(_valid_analysis())
    assert result.title == "A mug"
    assert result.confidence == 0.9
    assert result.risk_level == RiskLevel.LOW


def test_moment_present_and_bounded() -> None:
    result = AnalysisResult.model_validate(_valid_analysis())
    assert result.moment.headline == "It is intact and safe to drink from."
    assert result.moment.action == "No action needed — reuse as normal."
    assert len(result.moment.headline) <= 200
    assert len(result.moment.action) <= 300


def test_moment_requires_non_empty_headline() -> None:
    payload = _valid_analysis()
    payload["moment"] = {"headline": "", "action": "Do the safe thing."}
    with pytest.raises(PydanticValidationError):
        AnalysisResult.model_validate(payload)


def test_moment_requires_non_empty_action() -> None:
    payload = _valid_analysis()
    payload["moment"] = {"headline": "Why it matters", "action": ""}
    with pytest.raises(PydanticValidationError):
        AnalysisResult.model_validate(payload)


def test_oversized_moment_headline_rejected() -> None:
    payload = _valid_analysis()
    payload["moment"] = {"headline": "x" * 201, "action": "Do the safe thing."}
    with pytest.raises(PydanticValidationError):
        AnalysisResult.model_validate(payload)


def test_oversized_moment_action_rejected() -> None:
    payload = _valid_analysis()
    payload["moment"] = {"headline": "Why it matters", "action": "y" * 301}
    with pytest.raises(PydanticValidationError):
        AnalysisResult.model_validate(payload)


def test_oversized_observations_rejected() -> None:
    payload = _valid_analysis()
    payload["observations"] = [f"obs {i}" for i in range(21)]
    with pytest.raises(PydanticValidationError):
        AnalysisResult.model_validate(payload)


def test_confidence_out_of_range_rejected() -> None:
    payload = _valid_analysis()
    payload["confidence"] = 1.4
    with pytest.raises(PydanticValidationError):
        AnalysisResult.model_validate(payload)


def test_oversized_title_rejected() -> None:
    payload = _valid_analysis()
    payload["title"] = "x" * 201
    with pytest.raises(PydanticValidationError):
        AnalysisResult.model_validate(payload)


def test_bytes_size_of_bounded_strings() -> None:
    result = AnalysisResult.model_validate(_valid_analysis())
    assert len(result.title) <= 200
    assert len(result.category) <= 100
    assert len(result.summary) <= 2000


def test_scan_response_serializes_with_safety_and_quota() -> None:
    response = ScanResponse(
        id="123e4567-e89b-12d3-a456-426614174000",
        status=ScanStatus.completed,
        created_at="2026-09-07T12:00:00Z",
        analysis=AnalysisResult.model_validate(_valid_analysis()),
        safety=SafetyMetadata(risk_level=RiskLevel.LOW),
        quota=None,
    )
    data = response.model_dump(mode="json")
    assert data["id"] == "123e4567-e89b-12d3-a456-426614174000"
    assert data["status"] == "completed"
    assert data["safety"]["risk_level"] == "LOW"
    assert data["analysis"]["title"] == "A mug"
    assert data["quota"] is None
