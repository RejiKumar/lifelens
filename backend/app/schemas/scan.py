"""Scan API request/response schemas.

The AWS-shaped fields are bounded and validated server-side. The response is
the single source of truth returned synchronously from ``POST /scan/analyze``
and replayed by ``GET /scan/{id}``.
"""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, Field


class RiskLevel(StrEnum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class ScanSource(StrEnum):
    camera = "camera"
    gallery = "gallery"
    file = "file"


class SafetyMetadata(BaseModel):
    """Risk assessment and safety flags. Authoritative (server-derived)."""

    risk_level: RiskLevel = Field(description="Overall risk level of the analysis")
    is_medical: bool = False
    is_hazardous: bool = False
    is_electrical: bool = False
    is_structural: bool = False
    is_vehicle: bool = False
    is_chemical: bool = False
    is_gas: bool = False


class AnalysisResult(BaseModel):
    """Validated, clamped analysis output that is safe to present."""

    title: str = Field(min_length=1, max_length=200)
    category: str = Field(min_length=1, max_length=100)
    summary: str = Field(min_length=1, max_length=2000)
    confidence: float = Field(ge=0.0, le=1.0)
    risk_level: RiskLevel
    observations: list[str] = Field(min_length=1, max_length=20)
    actions: list[str] = Field(max_length=10)
    warnings: list[str] = Field(max_length=10)
    when_to_seek_help: str | None = Field(default=None, max_length=1000)
    follow_up_suggestions: list[str] = Field(default_factory=list, max_length=5)


class QuotaInfo(BaseModel):
    """Placeholder for quota state.

    shape only; enforced quota arrives in a later change. Kept here so the
    response envelope is stable and the client can display "quota nearly
    exhausted" without trusting any client-side entitlement.
    """

    remaining: int = Field(default=0, description="Scans remaining today")
    limit: int = Field(default=0, description="Daily scan limit")
    resets_at: datetime | None = Field(default=None, description="When the quota resets")


class ScanStatus(StrEnum):
    completed = "completed"
    failed = "failed"


class ScanResponse(BaseModel):
    """Full synchronous scan result returned to clients."""

    id: UUID
    status: ScanStatus = ScanStatus.completed
    created_at: datetime
    analysis: AnalysisResult | None = None
    safety: SafetyMetadata
    quota: QuotaInfo | None = Field(default=None, description="Present only when known")


class SignedUrlResponse(BaseModel):
    """Short-lived signed URL for a single stored object."""

    signed_url: str
    expires_at: datetime
