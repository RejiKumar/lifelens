"""FastAPI dependency providers for the scan feature.

Bundles per-request session, identity resolution, and the analysis service
with its repositories, stub provider, and storage. Seams (identity verifier,
AI provider, quota) are injected here so later changes swap implementations
without touching the router or service.
"""

from __future__ import annotations

from collections.abc import AsyncGenerator

from fastapi import Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.database import get_session_factory
from app.core.identity import AuthVerifier, GuestVerifier, Identity
from app.providers.base import AIProvider
from app.providers.stub import StubProvider
from app.repositories.scan import AnalysisRepository, ScanRepository
from app.repositories.storage import StorageRepository, build_storage_repository
from app.services.analysis import AnalysisService, NoopQuota, QuotaContext


async def get_db_session() -> AsyncGenerator[AsyncSession]:
    session_factory = get_session_factory()
    async with session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


def get_verifier() -> AuthVerifier:
    return GuestVerifier()


async def get_identity(
    authorization: str | None = Header(default=None),
    x_guest_session: str | None = Header(default=None),
    verifier: AuthVerifier = Depends(get_verifier),
) -> Identity:
    return await verifier.verify(authorization, x_guest_session)


def get_provider(settings: Settings = Depends(get_settings)) -> AIProvider:
    if settings.ai_provider == "stub" or not settings.ai_provider:
        return StubProvider()
    raise RuntimeError(f"Unsupported AI provider: {settings.ai_provider!r}")


def get_quota(settings: Settings = Depends(get_settings)) -> QuotaContext:
    return NoopQuota()


def get_storage(settings: Settings = Depends(get_settings)) -> StorageRepository:
    return build_storage_repository(
        settings.supabase_url,
        settings.supabase_service_role_key,
        settings.storage_bucket,
    )


def get_analysis_service(
    session: AsyncSession = Depends(get_db_session),
    provider: AIProvider = Depends(get_provider),
    quota: QuotaContext = Depends(get_quota),
    storage: StorageRepository = Depends(get_storage),
    settings: Settings = Depends(get_settings),
) -> AnalysisService:
    return AnalysisService(
        scans=ScanRepository(session),
        analyses=AnalysisRepository(session),
        storage=storage,
        provider=provider,
        quota=quota,
        max_upload_bytes=settings.max_upload_bytes,
        max_input_dimension=settings.max_input_dimension,
        min_input_dimension=settings.min_input_dimension,
        output_dimension=settings.output_dimension,
        output_quality=settings.output_quality,
        guest_ttl_days=settings.guest_ttl_days,
        analysis_timeout_seconds=settings.analysis_timeout_seconds,
    )
