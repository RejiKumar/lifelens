"""Scan and analysis ORM models.

A ``scan`` owns an image object plus an analysis. Guest scans carry
``expires_at`` (TTL metadata); authenticated scans leave it NULL. The
:attr:`Analysis` row materialises the analysis result fields as typed
columns so safety queries can index ``risk_level`` directly.
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, String, Text, Uuid
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, utcnow


class Scan(Base):
    __tablename__ = "scans"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    user_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    guest_session_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(16), default="completed")
    idempotency_key: Mapped[str] = mapped_column(String(36), nullable=False)
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    storage_path: Mapped[str] = mapped_column(String(512), nullable=False)
    source: Mapped[str | None] = mapped_column(String(16), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )

    analysis: Mapped[Analysis | None] = relationship(
        back_populates="scan", uselist=False, cascade="all, delete-orphan"
    )


class Analysis(Base):
    __tablename__ = "analyses"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    scan_id: Mapped[UUID] = mapped_column(
        ForeignKey("scans.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    risk_level: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    moment_headline: Mapped[str] = mapped_column(
        Text, nullable=False, server_default=""
    )
    moment_action: Mapped[str] = mapped_column(Text, nullable=False, server_default="")
    observations: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False, default=list)
    actions: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False, default=list)
    warnings: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False, default=list)
    when_to_seek_help: Mapped[str | None] = mapped_column(Text, nullable=True)
    follow_up_suggestions: Mapped[list[str]] = mapped_column(
        ARRAY(String), nullable=False, default=list
    )

    is_medical: Mapped[bool] = mapped_column(Boolean, default=False)
    is_hazardous: Mapped[bool] = mapped_column(Boolean, default=False)
    is_electrical: Mapped[bool] = mapped_column(Boolean, default=False)
    is_structural: Mapped[bool] = mapped_column(Boolean, default=False)
    is_vehicle: Mapped[bool] = mapped_column(Boolean, default=False)
    is_chemical: Mapped[bool] = mapped_column(Boolean, default=False)
    is_gas: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    scan: Mapped[Scan] = relationship(back_populates="analysis")
