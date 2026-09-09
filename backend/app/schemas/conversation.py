"""Conversation API request/response schemas.

The follow-up interaction lives on the analysis surface: ``POST
/analysis/:id/follow-up`` and ``GET /analysis/:id/chat-history``. Responses
carry the assistant message plus the server-authoritative capacity and quota
state so the client can render remaining budget without trusting any
client-side entitlement data.
"""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.scan import QuotaInfo

QUESTION_MAX_LENGTH = 500
ANSWER_MAX_LENGTH = 3000
HISTORY_DEFAULT_LIMIT = 50
HISTORY_MAX_LIMIT = 100


class ChatRole(StrEnum):
    user = "user"
    assistant = "assistant"


class ChatMessage(BaseModel):
    """A single persisted conversation message."""

    id: UUID = Field(description="Message id")
    role: ChatRole = Field(description="user or assistant")
    content: str = Field(min_length=1, max_length=ANSWER_MAX_LENGTH)
    created_at: datetime = Field(description="When the message was created")


class FollowUpRequest(BaseModel):
    """Body of a follow-up question request."""

    question: str = Field(description="User question")


class FollowUpResponse(BaseModel):
    """Result of answering one follow-up question."""

    message: ChatMessage = Field(description="The assistant answer message")
    remaining_capacity: int = Field(description="Follow-up questions left for this scan")
    quota: QuotaInfo = Field(description="Remaining daily AI usage state")


class ChatHistoryResponse(BaseModel):
    """Paginated conversation messages for an analysis."""

    messages: list[ChatMessage] = Field(description="Messages in chronological order")
    next_cursor: str | None = Field(default=None, description="Opaque cursor for the next page")
    remaining_capacity: int = Field(description="Follow-up questions left for this scan")
    quota: QuotaInfo = Field(description="Remaining daily AI usage state")
