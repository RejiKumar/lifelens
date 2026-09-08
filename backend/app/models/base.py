"""SQLAlchemy declarative base shared by all ORM models."""

from datetime import UTC, datetime

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Base class for all LifeLens ORM models."""


def utcnow() -> datetime:
    """Timezone-aware UTC now for timestamptz columns."""
    return datetime.now(UTC)
