"""Async database bootstrap.

Uses SQLAlchemy async engine against Supabase Postgres in session mode
(port 5432). The Supavisor transaction pool (port 6543) is supported by
setting ``statement_cache_size`` and ``prepared_statement_cache_size`` to 0
and using ``NullPool``.
"""

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool

_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker[AsyncSession] | None = None


def _engine_kwargs(url: str) -> dict[str, object]:
    if "6543" in url or "pooler.supabase" in url:
        connect_args = {
            "statement_cache_size": 0,
            "prepared_statement_cache_size": 0,
        }
        return {"poolclass": NullPool, "connect_args": connect_args}
    return {}


async def init_db(database_url: str) -> None:
    """Create the async engine and session factory. Call once at startup.

    A missing or empty DATABASE_URL disables persistence: all repository
    calls then fail fast with a clear error instead of a crash at import.
    """
    global _engine, _session_factory
    if not database_url:
        _engine = None
        _session_factory = None
        return
    kwargs = _engine_kwargs(database_url)
    _engine = create_async_engine(database_url, **kwargs)
    _session_factory = async_sessionmaker(_engine, expire_on_commit=False)


def get_engine() -> AsyncEngine:
    if _engine is None:
        raise RuntimeError("Database not initialized; call init_db first.")
    return _engine


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    if _session_factory is None:
        raise RuntimeError("Database not initialized; call init_db first.")
    return _session_factory


async def dispose_db() -> None:
    """Dispose the async engine and clear the singleton. Safe to call anytime."""
    global _engine, _session_factory
    if _engine is not None:
        await _engine.dispose()
    _engine = None
    _session_factory = None
