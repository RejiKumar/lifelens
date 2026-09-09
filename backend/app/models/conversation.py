"""Conversation and usage ORM models.

``AnalysisMessage`` stores one turn of an Ask LifeLens conversation, keyed to
an analysis (1:1 conversation per scan). ``Usage`` records the authoritative
daily AI usage units for an identity key (guest session id today, user id
after auth-v1) so quota is enforced server-side.
"""

from __future__ import annotations

from datetime import date, datetime
from uuid import UUID, uuid4

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, utcnow

MESSAGE_ROLE_USER = "user"
MESSAGE_ROLE_ASSISTANT = "assistant"


class AnalysisMessage(Base):
    """A single persisted message in an analysis conversation."""

    __tablename__ = "analysis_message"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    analysis_id: Mapped[UUID] = mapped_column(
        ForeignKey("analyses.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[str] = mapped_column(String(16), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    seq: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Usage(Base):
    """Authoritative daily AI usage bucket for an identity key."""

    __tablename__ = "usage"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    subject: Mapped[str] = mapped_column(String(64), nullable=False)
    usage_date: Mapped[date] = mapped_column(Date, nullable=False)
    used: Mapped[int] = mapped_column(Integer, nullable=False)
