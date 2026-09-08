"""Analysis orchestration.

Runs the scan pipeline: normalise the image, de-dup against existing scans for
the same owner, call the AI provider within a bounded timeout, clamp and
validate the output, then persist the scan, analysis, and image object before
returning the synchronous result.
"""

from __future__ import annotations

import asyncio
import hashlib
from datetime import UTC, datetime
from typing import Protocol
from uuid import UUID

from app.core.errors import AnalysisFailedError, NotFoundError, QuotaExceededError
from app.core.identity import Identity
from app.repositories.scan import AnalysisRecord, AnalysisRepository, ScanRepository
from app.repositories.storage import SignedUrlResult, StorageRepository
from app.schemas.scan import (
    AnalysisResult,
    QuotaInfo,
    RiskLevel,
    SafetyMetadata,
    ScanResponse,
    ScanSource,
    ScanStatus,
)
from app.services.image_utils import NormalizedImage, normalize_image

_RETRY_BACKOFF = [1.0, 2.0, 4.0]


class AI(Protocol):
    async def analyze_image(
        self, image_bytes: bytes, mime: str, context: str | None = None
    ) -> object:
        ...


class QuotaContext(Protocol):
    def is_exhausted(self, identity: Identity) -> bool:
        ...


class NoopQuota:
    """MVP quota is never exhausted. Enforcement lands in a later change."""

    def is_exhausted(self, identity: Identity) -> bool:
        return False


class AnalysisService:
    def __init__(
        self,
        *,
        scans: ScanRepository,
        analyses: AnalysisRepository,
        storage: StorageRepository,
        provider: AI,
        quota: QuotaContext,
        max_upload_bytes: int,
        max_input_dimension: int,
        min_input_dimension: int,
        output_dimension: int,
        output_quality: int,
        guest_ttl_days: int,
        analysis_timeout_seconds: float,
    ) -> None:
        self._scans = scans
        self._analyses = analyses
        self._storage = storage
        self._provider = provider
        self._quota = quota
        self._max_upload_bytes = max_upload_bytes
        self._max_input_dimension = max_input_dimension
        self._min_input_dimension = min_input_dimension
        self._output_dimension = output_dimension
        self._output_quality = output_quality
        self._guest_ttl_days = guest_ttl_days
        self._analysis_timeout_seconds = analysis_timeout_seconds

    async def analyze(
        self,
        identity: Identity,
        raw_image: bytes,
        *,
        idempotency_key: str,
        source: ScanSource,
    ) -> ScanResponse:
        if self._quota.is_exhausted(identity):
            raise QuotaExceededError(
                "Your daily scan limit has been reached. Please try again tomorrow.",
                quota={"remaining": 0, "limit": 0},
            )

        normalized = normalize_image(
            raw_image,
            max_upload_bytes=self._max_upload_bytes,
            max_input_dimension=self._max_input_dimension,
            min_input_dimension=self._min_input_dimension,
            output_dimension=self._output_dimension,
            output_quality=self._output_quality,
        )

        content_hash = hashlib.sha256(normalized.data).hexdigest()

        existing = await self._scans.find_duplicate(
            owner=identity.owner,
            is_guest=identity.is_guest,
            idempotency_key=idempotency_key or None,
            content_hash=content_hash,
        )
        if existing is not None:
            return await self._build_response(identity, existing.id)

        raw = await self._analyze_with_timeout(normalized)

        record, analysis_result, safety = self._coerce(raw)

        scan = await self._scans.create(
            user_id=None if identity.is_guest else identity.user_id,
            guest_session_id=identity.guest_session_id if identity.is_guest else None,
            idempotency_key=idempotency_key,
            content_hash=content_hash,
            storage_path="pending",
            source=source.value,
            guest_ttl_days=self._guest_ttl_days,
            completed_at=datetime.now(UTC),
        )
        storage_path = await self._storage.upload(
            identity.owner, scan.id, normalized.filename, normalized.data
        )
        scan.storage_path = storage_path

        await self._analyses.create(scan.id, record)

        return ScanResponse(
            id=scan.id,
            status=ScanStatus.completed,
            created_at=_as_utc(scan.created_at),
            analysis=analysis_result,
            safety=safety,
            quota=QuotaInfo(),
        )

    async def get(self, identity: Identity, scan_id: UUID) -> ScanResponse:
        return await self._build_response(identity, scan_id)

    async def signed_url(self, identity: Identity, scan_id: UUID) -> SignedUrlResult:
        scan = await self._scans.get_by_id(
            scan_id, owner=identity.owner, is_guest=identity.is_guest
        )
        if scan is None:
            raise NotFoundError("Scan not found.")
        return await self._storage.create_signed_url(scan.storage_path, ttl_seconds=300)

    async def _analyze_with_timeout(self, normalized: NormalizedImage) -> object:
        last_error: Exception | None = None
        for delay in _RETRY_BACKOFF:
            try:
                return await asyncio.wait_for(
                    self._provider.analyze_image(normalized.data, normalized.mime),
                    timeout=self._analysis_timeout_seconds,
                )
            except Exception as exc:  # noqa: BLE001 - map any provider failure
                last_error = exc
                await asyncio.sleep(delay)
        raise AnalysisFailedError(
            "Analysis could not be completed. Please try again."
        ) from last_error

    @staticmethod
    def _coerce(raw: object) -> tuple[AnalysisRecord, AnalysisResult, SafetyMetadata]:
        if not hasattr(raw, "title"):
            raise AnalysisFailedError("Analysis returned an invalid result.")
        title = str(getattr(raw, "title", ""))[:200]
        category = _normalize_category(getattr(raw, "category", ""))
        summary = str(getattr(raw, "summary", ""))[:2000]
        confidence = max(0.0, min(1.0, float(getattr(raw, "confidence", 0.0))))
        risk = _coerce_risk(getattr(raw, "risk_level", "LOW"))
        observations = _strings(getattr(raw, "observations", []), limit=20, minimum=1)
        actions = _strings(getattr(raw, "actions", []), limit=10, minimum=0)
        warnings = _strings(getattr(raw, "warnings", []), limit=10, minimum=0)
        when = str(getattr(raw, "when_to_seek_help", "") or "")[:1000] or None
        follow_ups = _strings(getattr(raw, "follow_up_suggestions", []), limit=5, minimum=0)

        record = AnalysisRecord(
            title=title,
            category=category,
            summary=summary,
            confidence=confidence,
            risk_level=risk.value,
            observations=observations,
            actions=actions,
            warnings=warnings,
            when_to_seek_help=when,
            follow_up_suggestions=follow_ups,
        )
        analysis_result = AnalysisResult(
            title=title,
            category=category,
            summary=summary,
            confidence=confidence,
            risk_level=risk,
            observations=observations,
            actions=actions,
            warnings=warnings,
            when_to_seek_help=when,
            follow_up_suggestions=follow_ups,
        )
        safety = SafetyMetadata(risk_level=risk)
        return record, analysis_result, safety

    async def _build_response(self, identity: Identity, scan_id: UUID) -> ScanResponse:
        scan = await self._scans.get_by_id(
            scan_id, owner=identity.owner, is_guest=identity.is_guest
        )
        if scan is None:
            raise NotFoundError("Scan not found.")
        analysis = await self._analyses.get_by_scan(scan_id)
        if analysis is None:
            raise NotFoundError("Scan has no analysis result.")

        analysis_result = AnalysisResult(
            title=analysis.title,
            category=analysis.category,
            summary=analysis.summary,
            confidence=analysis.confidence,
            risk_level=RiskLevel(analysis.risk_level),
            observations=analysis.observations,
            actions=analysis.actions,
            warnings=analysis.warnings,
            when_to_seek_help=analysis.when_to_seek_help,
            follow_up_suggestions=analysis.follow_up_suggestions,
        )
        safety = SafetyMetadata(
            risk_level=RiskLevel(analysis.risk_level),
            is_medical=analysis.is_medical,
            is_hazardous=analysis.is_hazardous,
            is_electrical=analysis.is_electrical,
            is_structural=analysis.is_structural,
            is_vehicle=analysis.is_vehicle,
            is_chemical=analysis.is_chemical,
            is_gas=analysis.is_gas,
        )
        return ScanResponse(
            id=scan.id,
            status=ScanStatus(scan.status),
            created_at=_as_utc(scan.created_at),
            analysis=analysis_result,
            safety=safety,
            quota=QuotaInfo(),
        )


def _normalize_category(value: object) -> str:
    text = str(value or "").strip().lower().replace(" ", "-")
    cleaned = "".join(ch for ch in text if ch.isalnum() or ch == "-")
    return cleaned[:100] or "other"


def _coerce_risk(value: object) -> RiskLevel:
    try:
        return RiskLevel(str(value).upper())
    except ValueError:
        return RiskLevel.LOW


def _strings(values: object, *, limit: int, minimum: int) -> list[str]:
    if not isinstance(values, list):
        values = []
    out = [str(v).strip()[:500] for v in values[:limit]]
    out = [v for v in out if v]
    if len(out) < minimum:
        out = out[:0] + ["Details are not available for this item."] * (minimum - len(out))
    return out[:limit]


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)
