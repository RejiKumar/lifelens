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


class Moment(BaseModel):
    """Prioritized actionable insight: why it matters and what to do.

    Produced by the same single analysis call as the rest of the result and
    surfaced above the identification fields. Always present and non-empty on
    a completed analysis; invalid/empty moments reject the analysis.
    """

    headline: str = Field(min_length=1, max_length=200, description="Why it matters")
    action: str = Field(min_length=1, max_length=300, description="What to do")


class AnalysisResult(BaseModel):
    """Validated, clamped analysis output that is safe to present."""

    id: UUID | None = Field(
        default=None, description="Analysis id used to address follow-up conversations"
    )
    scan_id: UUID | None = Field(default=None, description="Owning scan id")
    title: str = Field(min_length=1, max_length=200)
    category: str = Field(min_length=1, max_length=100)
    summary: str = Field(min_length=1, max_length=2000)
    confidence: float = Field(ge=0.0, le=1.0)
    risk_level: RiskLevel
    moment: Moment
    observations: list[str] = Field(min_length=1, max_length=20)
    actions: list[str] = Field(max_length=10)
    warnings: list[str] = Field(max_length=10)
    when_to_seek_help: str | None = Field(default=None, max_length=1000)
    follow_up_suggestions: list[str] = Field(default_factory=list, max_length=5)


class QuotaInfo(BaseModel):
    """Authoritative daily AI usage state, checked server-side."""

    used: int = Field(default=0, description="AI units used today")
    limit: int = Field(default=0, description="Daily AI limit")
    remaining: int = Field(default=0, description="AI units remaining today")
    is_pro: bool = Field(default=False, description="Whether the identity is PRO")
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


class HistoryItem(BaseModel):
    """Compact scan history entry for the list view."""

    id: UUID
    created_at: datetime
    title: str
    category: str
    risk_level: RiskLevel
    moment_headline: str
    source: str | None = None


class HistoryResponse(BaseModel):
    """Paginated scan history."""

    items: list[HistoryItem]
    total: int
    has_more: bool
