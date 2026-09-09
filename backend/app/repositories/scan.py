"""Scan and analysis data access.

All scans are scoped to an owner (authenticated ``user_id`` or guest
session). Reads apply read-side TTL so an expired guest scan is never
served even before the deferred purge job exists.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.base import utcnow
from app.models.scan import Analysis, Scan


@dataclass
class AnalysisRecord:
    """In-memory representation of an analysis row before persistence.

    Carries the materialised fields from an :class:`AnalysisResult` plus the
    safety flag booleans that the :class:`Analysis` model persists as columns.
    """

    title: str
    category: str
    summary: str
    confidence: float
    risk_level: str
    moment_headline: str
    moment_action: str
    observations: list[str] = field(default_factory=list)
    actions: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    when_to_seek_help: str | None = None
    follow_up_suggestions: list[str] = field(default_factory=list)
    is_medical: bool = False
    is_hazardous: bool = False
    is_electrical: bool = False
    is_structural: bool = False
    is_vehicle: bool = False
    is_chemical: bool = False
    is_gas: bool = False



class ScanRepository:
    """Repository for :class:`Scan` rows."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(
        self,
        *,
        user_id: str | None,
        guest_session_id: str | None,
        idempotency_key: str,
        content_hash: str,
        storage_path: str,
        source: str | None,
        guest_ttl_days: int,
        status: str = "completed",
        completed_at: datetime | None = None,
    ) -> Scan:
        scan = Scan(
            user_id=user_id,
            guest_session_id=guest_session_id,
            status=status,
            idempotency_key=idempotency_key,
            content_hash=content_hash,
            storage_path=storage_path,
            source=source,
            completed_at=completed_at,
        )
        if guest_session_id is not None:
            scan.expires_at = utcnow() + timedelta(days=guest_ttl_days)
        self._session.add(scan)
        await self._session.flush()
        return scan

    async def get_by_id(self, scan_id: UUID, *, owner: str | None, is_guest: bool) -> Scan | None:
        """Fetch a scan by id, scoped to the requesting owner and not expired."""
        stmt = select(Scan).where(Scan.id == scan_id)
        if is_guest:
            stmt = stmt.where(Scan.guest_session_id == owner)
        else:
            stmt = stmt.where(Scan.user_id == owner)
        stmt = stmt.where((Scan.expires_at.is_(None)) | (Scan.expires_at >= utcnow()))
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def find_duplicate(
        self,
        *,
        owner: str | None,
        is_guest: bool,
        idempotency_key: str | None = None,
        content_hash: str | None = None,
    ) -> Scan | None:
        """Find an existing scan for the owner by idempotency key or content hash.

        Matches are session-scoped: a hit only ever reuses an analysis for the
        same owner, never across owners. Expired guest scans are excluded.
        """
        if idempotency_key is None and content_hash is None:
            return None
        stmt = select(Scan)
        if is_guest:
            stmt = stmt.where(Scan.guest_session_id == owner)
        else:
            stmt = stmt.where(Scan.user_id == owner)
        conditions = []
        if idempotency_key is not None:
            conditions.append(Scan.idempotency_key == idempotency_key)
        if content_hash is not None:
            conditions.append(Scan.content_hash == content_hash)
        stmt = stmt.where(or_(*conditions))
        stmt = stmt.where((Scan.expires_at.is_(None)) | (Scan.expires_at >= utcnow()))
        stmt = stmt.order_by(Scan.created_at.desc(), Scan.id.desc()).limit(1)
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_by_owner(
        self,
        *,
        owner: str | None,
        is_guest: bool,
        limit: int = 20,
        offset: int = 0,
    ) -> list[Scan]:
        """List scans for an owner, newest first, excluding expired."""
        stmt = select(Scan)
        if is_guest:
            stmt = stmt.where(Scan.guest_session_id == owner)
        else:
            stmt = stmt.where(Scan.user_id == owner)
        stmt = stmt.where((Scan.expires_at.is_(None)) | (Scan.expires_at >= utcnow()))
        stmt = stmt.where(Scan.status == "completed")
        stmt = stmt.order_by(Scan.created_at.desc(), Scan.id.desc())
        stmt = stmt.offset(offset).limit(limit)
        result = await self._session.execute(stmt)
        return list(result.scalars().all())


class AnalysisRepository:
    """Repository for :class:`Analysis` rows."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(self, scan_id: UUID, analysis: AnalysisRecord) -> Analysis:
        row = Analysis(
            scan_id=scan_id,
            title=analysis.title,
            category=analysis.category,
            summary=analysis.summary,
            confidence=analysis.confidence,
            risk_level=analysis.risk_level,
            moment_headline=analysis.moment_headline,
            moment_action=analysis.moment_action,
            observations=analysis.observations,
            actions=analysis.actions,
            warnings=analysis.warnings,
            when_to_seek_help=analysis.when_to_seek_help,
            follow_up_suggestions=analysis.follow_up_suggestions,
            is_medical=analysis.is_medical,
            is_hazardous=analysis.is_hazardous,
            is_electrical=analysis.is_electrical,
            is_structural=analysis.is_structural,
            is_vehicle=analysis.is_vehicle,
            is_chemical=analysis.is_chemical,
            is_gas=analysis.is_gas,
        )
        self._session.add(row)
        await self._session.flush()
        return row

    async def get_by_scan(self, scan_id: UUID) -> Analysis | None:
        result = await self._session.execute(select(Analysis).where(Analysis.scan_id == scan_id))
        return result.scalar_one_or_none()

    async def get_with_scan(
        self, analysis_id: UUID, *, owner: str | None, is_guest: bool
    ) -> tuple[Analysis, Scan] | None:
        """Fetch an analysis joined with its scan, scoped to owner and not expired."""
        stmt = (
            select(Analysis, Scan)
            .join(Scan, Analysis.scan_id == Scan.id)
            .where(Analysis.id == analysis_id)
        )
        if is_guest:
            stmt = stmt.where(Scan.guest_session_id == owner)
        else:
            stmt = stmt.where(Scan.user_id == owner)
        stmt = stmt.where((Scan.expires_at.is_(None)) | (Scan.expires_at >= utcnow()))
        result = await self._session.execute(stmt)
        row = result.one_or_none()
        if row is None:
            return None
        return row[0], row[1]

    async def update_by_scan(self, scan_id: UUID, analysis: AnalysisRecord) -> None:
        """Overwrite the analysis row for a scan in place (legacy row refresh)."""
        row = await self.get_by_scan(scan_id)
        if row is None:
            return
        row.title = analysis.title
        row.category = analysis.category
        row.summary = analysis.summary
        row.confidence = analysis.confidence
        row.risk_level = analysis.risk_level
        row.moment_headline = analysis.moment_headline
        row.moment_action = analysis.moment_action
        row.observations = analysis.observations
        row.actions = analysis.actions
        row.warnings = analysis.warnings
        row.when_to_seek_help = analysis.when_to_seek_help
        row.follow_up_suggestions = analysis.follow_up_suggestions
        row.is_medical = analysis.is_medical
        row.is_hazardous = analysis.is_hazardous
        row.is_electrical = analysis.is_electrical
        row.is_structural = analysis.is_structural
        row.is_vehicle = analysis.is_vehicle
        row.is_chemical = analysis.is_chemical
        row.is_gas = analysis.is_gas

    async def list_by_owner(
        self,
        *,
        owner: str | None,
        is_guest: bool,
        limit: int = 20,
        offset: int = 0,
    ) -> list[tuple[Analysis, Scan]]:
        """List analyses for an owner, newest first, excluding expired scans."""
        stmt = (
            select(Analysis, Scan)
            .join(Scan, Analysis.scan_id == Scan.id)
        )
        if is_guest:
            stmt = stmt.where(Scan.guest_session_id == owner)
        else:
            stmt = stmt.where(Scan.user_id == owner)
        stmt = stmt.where((Scan.expires_at.is_(None)) | (Scan.expires_at >= utcnow()))
        stmt = stmt.where(Scan.status == "completed")
        stmt = stmt.order_by(Scan.created_at.desc(), Scan.id.desc())
        stmt = stmt.offset(offset).limit(limit)
        result = await self._session.execute(stmt)
        return [tuple(row) for row in result.all()]
