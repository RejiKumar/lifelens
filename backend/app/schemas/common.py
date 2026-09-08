"""Shared API response schemas.

Contains the sealed error envelope used by every non-2xx response and the
canonical machine-readable error codes.
"""

from typing import Any

from pydantic import BaseModel, Field


class ErrorBody(BaseModel):
    """Machine-readable error code understood by clients."""

    code: str = Field(description="Stable machine-readable error code")
    message: str = Field(description="User-friendly error message")
    details: dict[str, Any] | None = Field(default=None, description="Optional structured details")


class ErrorResponse(BaseModel):
    """Sealed envelope wrapping all non-2xx request failures."""

    error: ErrorBody


class ErrorCode:
    """Canonical error codes.

    Codes are deliberately a superset of what scan-v1 emits; several are
    reserved for later changes (auth, quota) so the envelope stays closed.
    """

    VALIDATION_ERROR = "VALIDATION_ERROR"
    UNAUTHORIZED = "UNAUTHORIZED"
    EXPIRED_SESSION = "EXPIRED_SESSION"
    NOT_FOUND = "NOT_FOUND"
    PAYLOAD_SIZE_EXCEEDED = "PAYLOAD_SIZE_EXCEEDED"
    QUOTA_EXCEEDED = "QUOTA_EXCEEDED"
    RATE_LIMITED = "RATE_LIMITED"
    ANALYSIS_FAILED = "ANALYSIS_FAILED"
    INTERNAL_ERROR = "INTERNAL_ERROR"
