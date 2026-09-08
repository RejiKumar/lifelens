"""Health and liveness endpoints. The only unauthenticated endpoints."""

from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/healthz")
async def healthz() -> dict[str, str]:
    return {"status": "ok", "environment": "configured"}
