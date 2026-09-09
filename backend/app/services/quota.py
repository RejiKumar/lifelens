"""Authoritative daily AI usage quota.

The backend is the single authority for entitlement budgets: each scan analysis
and each follow-up question consumes exactly one AI usage unit from the
identity's daily bucket. ``QUOTA`` is checked before an AI call and committed
only after a validated success, so a failed provider call never spends a unit.
Guest, FREE, and PRO budgets are fixed here (5 / 20 / 100); PRO entitlement is
reserved until auth-v1 lands.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta

from app.core.identity import Identity
from app.repositories.conversation import UsageRepository
from app.schemas.scan import QuotaInfo

GUEST_DAILY_LIMIT = 5
FREE_DAILY_LIMIT = 20
PRO_DAILY_LIMIT = 100


@dataclass(frozen=True)
class QuotaState:
    """Snapshot of the identity's daily AI usage bucket."""

    used: int
    limit: int
    is_pro: bool
    resets_at: datetime

    @property
    def remaining(self) -> int:
        return max(0, self.limit - self.used)

    @property
    def is_exhausted(self) -> bool:
        return self.used >= self.limit

    def to_info(self) -> QuotaInfo:
        return QuotaInfo(
            used=self.used,
            limit=self.limit,
            remaining=self.remaining,
            is_pro=self.is_pro,
            resets_at=self.resets_at,
        )


class QuotaService:
    """Check and commit daily AI usage against the persisted usage bucket."""

    def __init__(
        self,
        *,
        usage: UsageRepository,
        guest_limit: int = GUEST_DAILY_LIMIT,
        free_limit: int = FREE_DAILY_LIMIT,
        pro_limit: int = PRO_DAILY_LIMIT,
    ) -> None:
        self._usage = usage
        self._guest_limit = guest_limit
        self._free_limit = free_limit
        self._pro_limit = pro_limit

    def _limit_for(self, identity: Identity) -> tuple[int, bool]:
        if identity.is_guest:
            return self._guest_limit, False
        return self._free_limit, False

    @staticmethod
    def _today() -> date:
        return datetime.now(UTC).date()

    @staticmethod
    def _resets_at(today: date) -> datetime:
        return datetime.combine(today + timedelta(days=1), datetime.min.time(), tzinfo=UTC)

    async def check(self, identity: Identity) -> QuotaState:
        today = self._today()
        used = await self._usage.get_used(identity.owner, today)
        limit, is_pro = self._limit_for(identity)
        return QuotaState(
            used=used,
            limit=limit,
            is_pro=is_pro,
            resets_at=self._resets_at(today),
        )

    async def commit(self, identity: Identity) -> bool:
        limit, _ = self._limit_for(identity)
        return await self._usage.commit_one(identity.owner, self._today(), limit=limit)
