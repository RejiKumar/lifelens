"""Scan endpoints.

Implements the single synchronous scan flow plus read and signed-url access.
Failures are raised as :class:`LifeLensError` subclasses and mapped to the
sealed error envelope by the global exception handler in :mod:`app.main`.
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, UploadFile

from app.api.deps import get_analysis_service, get_identity
from app.core.errors import ValidationError
from app.core.identity import Identity
from app.schemas.scan import HistoryResponse, ScanResponse, ScanSource, SignedUrlResponse
from app.services.analysis import AnalysisService

router = APIRouter(prefix="/scan", tags=["scan"])


@router.post(
    "/analyze",
    response_model=ScanResponse,
    responses={
        400: {"description": "Validation error"},
        413: {"description": "Payload too large"},
    },
)
async def analyze_scan(
    image: UploadFile | None = File(default=None),
    idempotency_key: str = Form(...),
    source: ScanSource = Form(default=ScanSource.camera),
    identity: Identity = Depends(get_identity),
    service: AnalysisService = Depends(get_analysis_service),
) -> ScanResponse:
    if image is None:
        raise ValidationError("Image is required.")
    raw = await image.read()
    if not raw:
        raise ValidationError("Image payload is empty.")
    return await service.analyze(
        identity,
        raw,
        idempotency_key=idempotency_key,
        source=source,
    )


@router.get("/{scan_id}", response_model=ScanResponse)
async def get_scan(
    scan_id: UUID,
    identity: Identity = Depends(get_identity),
    service: AnalysisService = Depends(get_analysis_service),
) -> ScanResponse:
    if scan_id is None:
        raise ValidationError("Scan id is required.")
    return await service.get(identity, scan_id)


@router.get("/{scan_id}/signed-url", response_model=SignedUrlResponse)
async def get_signed_url(
    scan_id: UUID,
    identity: Identity = Depends(get_identity),
    service: AnalysisService = Depends(get_analysis_service),
) -> SignedUrlResponse:
    result = await service.signed_url(identity, scan_id)
    return SignedUrlResponse(signed_url=result.signed_url, expires_at=result.expires_at)


@router.get("/history", response_model=HistoryResponse)
async def get_history(
    identity: Identity = Depends(get_identity),
    service: AnalysisService = Depends(get_analysis_service),
    limit: int = 20,
    offset: int = 0,
) -> HistoryResponse:
    return await service.history(identity, limit=limit, offset=offset)
