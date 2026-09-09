"""Ask LifeLens analysis conversation endpoints.

Enables contextual follow-up questions against an analysed subject
(``POST /analysis/{analysis_id}/follow-up``) and reading the persisted
conversation history (``GET /analysis/{analysis_id}/chat-history``). Both are
owner-scoped by the authenticated identity and quota-bound server-side.
Failures are raised as :class:`LifeLensError` subclasses and mapped to the
sealed error envelope by the global exception handler in :mod:`app.main`.
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_conversation_service, get_identity
from app.core.identity import Identity
from app.schemas.conversation import (
    ChatHistoryResponse,
    FollowUpRequest,
    FollowUpResponse,
)
from app.services.conversation import ConversationService

router = APIRouter(prefix="/analysis", tags=["analysis"])


@router.post(
    "/{analysis_id}/follow-up",
    response_model=FollowUpResponse,
    responses={
        400: {"description": "Validation error"},
        404: {"description": "Analysis not found"},
        429: {"description": "Daily quota or per-scan limit exceeded"},
        502: {"description": "AI provider failure"},
    },
)
async def follow_up(
    analysis_id: UUID,
    body: FollowUpRequest,
    identity: Identity = Depends(get_identity),
    service: ConversationService = Depends(get_conversation_service),
) -> FollowUpResponse:
    return await service.follow_up(identity, analysis_id, body.question)


@router.get(
    "/{analysis_id}/chat-history",
    response_model=ChatHistoryResponse,
    responses={
        400: {"description": "Validation error"},
        404: {"description": "Analysis not found"},
    },
)
async def chat_history(
    analysis_id: UUID,
    limit: int | None = Query(default=None, ge=1),
    cursor: str | None = Query(default=None),
    identity: Identity = Depends(get_identity),
    service: ConversationService = Depends(get_conversation_service),
) -> ChatHistoryResponse:
    return await service.chat_history(
        identity, analysis_id, limit=limit, cursor=cursor
    )
