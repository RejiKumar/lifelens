"""Typed project exceptions mapped to the sealed error envelope.

Handlers translate these into the canonical HTTP responses; the codes are
defined in :mod:`app.schemas.common`.
"""

from __future__ import annotations

from typing import Any


class LifeLensError(Exception):
    """Base class for project exceptions carrying an error code and status."""

    code: str = "INTERNAL_ERROR"
    status_code: int = 500

    def __init__(self, message: str, *, details: dict[str, Any] | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details


class ValidationError(LifeLensError):
    code = "VALIDATION_ERROR"
    status_code = 400


class PayloadSizeExceededError(LifeLensError):
    code = "PAYLOAD_SIZE_EXCEEDED"
    status_code = 413


class NotFoundError(LifeLensError):
    code = "NOT_FOUND"
    status_code = 404


class AnalysisFailedError(LifeLensError):
    code = "ANALYSIS_FAILED"
    status_code = 500


class QuotaExceededError(LifeLensError):
    code = "QUOTA_EXCEEDED"
    status_code = 429

    def __init__(
        self,
        message: str,
        *,
        details: dict[str, Any] | None = None,
        quota: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message, details=details)
        self.quota = quota


class LimitExceededError(LifeLensError):
    """A per-conversation cap was reached (distinct from a daily quota)."""

    code = "LIMIT_EXCEEDED"
    status_code = 429


class UnauthorizedError(LifeLensError):
    code = "UNAUTHORIZED"
    status_code = 401
