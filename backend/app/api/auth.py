"""Auth endpoints.

Auth-v1 exposes one identity-aware read helper on the backend; the mobile
client performs sign-up/login/OAuth against Supabase Auth directly. This
router never proxies credentials or issues tokens.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import get_identity
from app.core.identity import Identity
from app.schemas.auth import MeResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/me", response_model=MeResponse)
async def auth_me(identity: Identity = Depends(get_identity)) -> MeResponse:
    return MeResponse.from_identity(identity)
