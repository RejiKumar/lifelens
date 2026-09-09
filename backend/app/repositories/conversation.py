"""Conversation message and AI usage data access.

``MessageRepository`` persists Ask LifeLens turns keyed to an analysis; ``seq``
keeps chronological order and is unique per analysis. ``UsageRepository`` reads
the authoritative daily AI usage bucket and performs the atomic increment that
backs the quota service.
"""

from __future__ import annotations

from datetime import date
from uuid import UUID, uuid4

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.conversation import (
    MESSAGE_ROLE_ASSISTANT,
    MESSAGE_ROLE_USER,
    AnalysisMessage,
    Usage,
)


class MessageRepository:
    """Repository for :class:`AnalysisMessage` rows."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def count_user_messages(self, analysis_id: UUID) -> int:
        stmt = (
            select(func.count())
            .select_from(AnalysisMessage)
            .where(
                AnalysisMessage.analysis_id == analysis_id,
                AnalysisMessage.role == MESSAGE_ROLE_USER,
            )
        )
        result = await self._session.execute(stmt)
        return int(result.scalar_one())

    async def next_seq(self, analysis_id: UUID) -> int:
        stmt = (
            select(func.coalesce(func.max(AnalysisMessage.seq), 0))
            .where(AnalysisMessage.analysis_id == analysis_id)
        )
        result = await self._session.execute(stmt)
        return int(result.scalar_one()) + 1

    async def add_pair(
        self,
        analysis_id: UUID,
        user_content: str,
        assistant_content: str,
    ) -> tuple[AnalysisMessage, AnalysisMessage]:
        """Persist a user message plus its assistant answer atomically.

        Seq numbers are allocated from a single read of the current maximum so
        the pair is contiguous and the conversation count reflects answered
        turns exactly.
        """
        base_seq = await self.next_seq(analysis_id) - 1
        user_row = AnalysisMessage(
            analysis_id=analysis_id,
            role=MESSAGE_ROLE_USER,
            content=user_content,
            seq=base_seq + 1,
        )
        assistant_row = AnalysisMessage(
            analysis_id=analysis_id,
            role=MESSAGE_ROLE_ASSISTANT,
            content=assistant_content,
            seq=base_seq + 2,
        )
        self._session.add_all([user_row, assistant_row])
        await self._session.flush()
        return user_row, assistant_row

    async def last_messages(self, analysis_id: UUID, limit: int) -> list[AnalysisMessage]:
        """Return the most recent messages in chronological order."""
        stmt = (
            select(AnalysisMessage)
            .where(AnalysisMessage.analysis_id == analysis_id)
            .order_by(AnalysisMessage.seq.desc())
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        rows = list(result.scalars().all())
        return list(reversed(rows))

    async def messages_after(
        self, analysis_id: UUID, after_seq: int, limit: int
    ) -> list[AnalysisMessage]:
        stmt = (
            select(AnalysisMessage)
            .where(
                AnalysisMessage.analysis_id == analysis_id,
                AnalysisMessage.seq > after_seq,
            )
            .order_by(AnalysisMessage.seq.asc())
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())


class UsageRepository:
    """Repository for the authoritative daily :class:`Usage` bucket."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_used(self, subject: str, usage_date: date) -> int:
        stmt = select(Usage.used).where(
            Usage.subject == subject,
            Usage.usage_date == usage_date,
        )
        result = await self._session.execute(stmt)
        return int(result.scalar_one_or_none() or 0)

    async def commit_one(self, subject: str, usage_date: date, limit: int) -> bool:
        """Increment the bucket by one, guarded by the daily limit.

        Returns True when the increment succeeded. When the bucket is already
        at the limit the guarded update matches no row and the call returns
        False, bounding any concurrency overshoot to a single unit.
        """
        stmt = (
            pg_insert(Usage)
            .values(id=uuid4(), subject=subject, usage_date=usage_date, used=1)
            .on_conflict_do_update(
                index_elements=[Usage.subject, Usage.usage_date],
                set_={"used": Usage.used + 1},
                where=Usage.used < limit,
            )
            .returning(Usage.used)
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none() is not None
