"""Ask LifeLens conversation orchestration.

A follow-up question about an already analysed subject is re-grounded in the
stored normalized image (never a text-only answer), the persisted analysis,
the authoritative safety metadata, and recent history. The backend enforces
the per-scan question cap and the daily AI usage quota before any AI call and
persists the question/answer pair only after a validated, safety-bound answer.

On provider failure or an invalid answer nothing is persisted and no quota
unit is spent, so the user can retry without losing budget.
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from typing import Protocol
from uuid import UUID

from app.core.errors import (
    AnalysisFailedError,
    LimitExceededError,
    NotFoundError,
    QuotaExceededError,
    ValidationError,
)
from app.core.identity import Identity
from app.models.scan import Analysis
from app.providers.base import ProviderCategory, ProviderError
from app.repositories.conversation import MessageRepository
from app.repositories.scan import AnalysisRepository
from app.repositories.storage import StorageRepository
from app.schemas.conversation import (
    ANSWER_MAX_LENGTH,
    HISTORY_DEFAULT_LIMIT,
    HISTORY_MAX_LIMIT,
    QUESTION_MAX_LENGTH,
    ChatHistoryResponse,
    ChatMessage,
    ChatRole,
    FollowUpResponse,
)
from app.schemas.scan import RiskLevel
from app.services.quota import QuotaState

_RETRY_BACKOFF = [1.0, 2.0, 4.0]

_PROVIDER_MESSAGES: dict[ProviderCategory, str] = {
    ProviderCategory.RATE_LIMITED: (
        "Our AI service is busy right now. Please try again in a moment."
    ),
    ProviderCategory.AUTH_FAILED: (
        "Service configuration error. Please contact support."
    ),
    ProviderCategory.INVALID_REQUEST: (
        "The question could not be processed. Please try again."
    ),
    ProviderCategory.MODEL_ERROR: (
        "Analysis failed due to an internal error. Please try again."
    ),
    ProviderCategory.TIMEOUT: (
        "The answer took too long. Please try again."
    ),
    ProviderCategory.NETWORK_ERROR: (
        "Network error. Please check your connection and try again."
    ),
    ProviderCategory.UNKNOWN: "Something went wrong. Please try again.",
}

_SAFETY_BOOL_FIELDS = (
    "is_medical",
    "is_hazardous",
    "is_electrical",
    "is_structural",
    "is_vehicle",
    "is_chemical",
    "is_gas",
)


class FollowUpAI(Protocol):
    async def follow_up(
        self,
        *,
        image_bytes: bytes,
        mime: str,
        analysis: dict[str, object],
        safety: dict[str, object],
        history: list[dict[str, str]],
        question: str,
    ) -> object:
        ...


class QuotaContext(Protocol):
    async def check(self, identity: Identity) -> QuotaState:
        ...

    async def commit(self, identity: Identity) -> bool:
        ...


class ConversationService:
    """Service for Ask LifeLens follow-up questions and chat history."""

    def __init__(
        self,
        *,
        analyses: AnalysisRepository,
        messages: MessageRepository,
        storage: StorageRepository,
        provider: FollowUpAI,
        quota: QuotaContext,
        conversational_cap: int,
        context_window_messages: int,
        follow_up_timeout_seconds: float,
    ) -> None:
        self._analyses = analyses
        self._messages = messages
        self._storage = storage
        self._provider = provider
        self._quota = quota
        self._conversational_cap = conversational_cap
        self._context_window_messages = context_window_messages
        self._follow_up_timeout_seconds = follow_up_timeout_seconds

    async def follow_up(
        self, identity: Identity, analysis_id: UUID, question: str
    ) -> FollowUpResponse:
        question = question.strip()
        if not question:
            raise ValidationError("Question is required.")
        if len(question) > QUESTION_MAX_LENGTH:
            raise ValidationError("Question is too long.")

        resolved = await self._analyses.get_with_scan(
            analysis_id, owner=identity.owner, is_guest=identity.is_guest
        )
        if resolved is None:
            raise NotFoundError("Analysis not found.")
        analysis_row, scan = resolved

        used_turns = await self._messages.count_user_messages(analysis_id)
        if used_turns >= self._conversational_cap:
            raise LimitExceededError(
                "You've used all follow-up questions for this scan. Start a new scan to ask more.",
            )

        quota_state = await self._quota.check(identity)
        if quota_state.is_exhausted:
            raise QuotaExceededError(
                "Your daily AI limit has been reached. Please try again tomorrow.",
                quota={
                    "remaining": 0,
                    "limit": quota_state.limit,
                    "resets_at": quota_state.resets_at.isoformat(),
                },
            )

        image = await self._storage.read(scan.storage_path)
        if image is None:
            raise AnalysisFailedError(
                "The scan image is no longer available. Please try again."
            )
        image_bytes, mime = image

        analysis_payload = _analysis_payload(analysis_row)
        safety_payload = _safety_payload(analysis_row)
        history = [
            {"role": msg.role, "content": msg.content}
            for msg in await self._messages.last_messages(
                analysis_id, self._context_window_messages
            )
        ]

        raw = await self._call_follow_up(
            image_bytes=image_bytes,
            mime=mime,
            analysis=analysis_payload,
            safety=safety_payload,
            history=history,
            question=question,
        )

        answer = _normalize_answer(raw, stored_risk=analysis_row.risk_level)

        user_row, assistant_row = await self._messages.add_pair(
            analysis_id, question, answer
        )
        await self._quota.commit(identity)

        quota_state = await self._quota.check(identity)
        remaining_capacity = max(
            0, self._conversational_cap - used_turns - 1
        )
        return FollowUpResponse(
            message=ChatMessage(
                id=assistant_row.id,
                role=ChatRole.assistant,
                content=assistant_row.content,
                created_at=_as_utc(assistant_row.created_at),
            ),
            remaining_capacity=remaining_capacity,
            quota=quota_state.to_info(),
        )

    async def chat_history(
        self,
        identity: Identity,
        analysis_id: UUID,
        *,
        limit: int | None,
        cursor: str | None,
    ) -> ChatHistoryResponse:
        resolved = await self._analyses.get_with_scan(
            analysis_id, owner=identity.owner, is_guest=identity.is_guest
        )
        if resolved is None:
            raise NotFoundError("Analysis not found.")

        limit = limit or HISTORY_DEFAULT_LIMIT
        limit = min(max(1, limit), HISTORY_MAX_LIMIT)
        after_seq = _parse_cursor(cursor)

        messages = await self._messages.messages_after(analysis_id, after_seq, limit + 1)
        has_more = len(messages) > limit
        messages = messages[:limit]

        used_turns = await self._messages.count_user_messages(analysis_id)
        quota_state = await self._quota.check(identity)
        return ChatHistoryResponse(
            messages=[
                ChatMessage(
                    id=row.id,
                    role=ChatRole(row.role),
                    content=row.content,
                    created_at=_as_utc(row.created_at),
                )
                for row in messages
            ],
            next_cursor=str(messages[-1].seq) if has_more and messages else None,
            remaining_capacity=max(0, self._conversational_cap - used_turns),
            quota=quota_state.to_info(),
        )

    async def _call_follow_up(
        self,
        *,
        image_bytes: bytes,
        mime: str,
        analysis: dict[str, object],
        safety: dict[str, object],
        history: list[dict[str, str]],
        question: str,
    ) -> object:
        last_error: Exception | None = None
        for delay in _RETRY_BACKOFF:
            try:
                return await asyncio.wait_for(
                    self._provider.follow_up(
                        image_bytes=image_bytes,
                        mime=mime,
                        analysis=analysis,
                        safety=safety,
                        history=history,
                        question=question,
                    ),
                    timeout=self._follow_up_timeout_seconds,
                )
            except ProviderError as exc:
                last_error = exc
                if not exc.retryable:
                    break
                await asyncio.sleep(delay)
            except Exception as exc:  # noqa: BLE001 - map any provider failure
                last_error = exc
                await asyncio.sleep(delay)
        raise AnalysisFailedError(_follow_up_failure_message(last_error)) from last_error


def _analysis_payload(analysis: Analysis) -> dict[str, object]:
    return {
        "title": analysis.title,
        "category": analysis.category,
        "summary": analysis.summary,
        "risk_level": analysis.risk_level,
        "observations": analysis.observations,
        "actions": analysis.actions,
        "warnings": analysis.warnings,
        "when_to_seek_help": analysis.when_to_seek_help or "",
        "follow_up_suggestions": analysis.follow_up_suggestions,
    }


def _safety_payload(analysis: Analysis) -> dict[str, object]:
    payload: dict[str, object] = {
        "risk_level": analysis.risk_level,
    }
    for field in _SAFETY_BOOL_FIELDS:
        payload[field] = bool(getattr(analysis, field, False))
    return payload


def _normalize_answer(raw: object, *, stored_risk: str) -> str:
    if not hasattr(raw, "answer"):
        raise AnalysisFailedError("Follow-up returned an invalid answer.")
    answer = str(getattr(raw, "answer", "") or "").strip()[:ANSWER_MAX_LENGTH]
    if not answer:
        raise AnalysisFailedError("Follow-up returned an empty answer.")

    stated = str(getattr(raw, "risk_level", "") or "").upper()
    try:
        stated_risk = RiskLevel(stated)
    except ValueError:
        raise AnalysisFailedError("Follow-up returned an invalid safety level.") from None
    if stated_risk.value != stored_risk:
        raise AnalysisFailedError(
            "This answer conflicts with the recorded safety information."
        )
    return answer


def _parse_cursor(cursor: str | None) -> int:
    if cursor is None or not cursor.strip():
        return 0
    try:
        return max(0, int(cursor))
    except ValueError:
        raise ValidationError("Invalid pagination cursor.") from None


def _follow_up_failure_message(error: Exception | None) -> str:
    if isinstance(error, ProviderError):
        return _PROVIDER_MESSAGES.get(
            error.category, "The answer could not be generated. Please try again."
        )
    return "The answer could not be generated. Please try again."


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)
