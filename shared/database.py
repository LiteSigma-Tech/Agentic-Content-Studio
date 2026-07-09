"""Database connection utilities.

Two connection surfaces are provided:

  get_pool()   — raw asyncpg pool, used by runtime store methods for fast
                 parameterised queries.

  get_engine() — SQLAlchemy async engine backed by asyncpg, used by Alembic
                 (via alembic/env.py) and available for ORM-style queries if
                 stores are migrated to SQLAlchemy later.

Both are lazily initialised and share the same DATABASE_URL env var.
"""
from __future__ import annotations

import os
import asyncpg

_pool: asyncpg.Pool | None = None


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        url = os.environ.get("DATABASE_URL")
        if not url:
            raise RuntimeError("DATABASE_URL is not set")
        _pool = await asyncpg.create_pool(url, min_size=2, max_size=10)
    return _pool


async def close_pool() -> None:
    global _pool
    if _pool:
        await _pool.close()
        _pool = None


async def is_available() -> bool:
    return bool(os.environ.get("DATABASE_URL"))


# ── SQLAlchemy async engine (used by Alembic + optional ORM queries) ──────────

try:
    from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

    _engine: AsyncEngine | None = None

    def get_engine() -> AsyncEngine:
        global _engine
        if _engine is None:
            url = os.environ.get("DATABASE_URL", "")
            if not url:
                raise RuntimeError("DATABASE_URL is not set")
            # asyncpg driver requires the postgresql+asyncpg:// scheme
            if url.startswith("postgresql://"):
                url = "postgresql+asyncpg://" + url[len("postgresql://"):]
            _engine = create_async_engine(url, pool_size=5, max_overflow=10)
        return _engine

    async def close_engine() -> None:
        global _engine
        if _engine:
            await _engine.dispose()
            _engine = None

except ImportError:
    # SQLAlchemy not installed — Alembic won't work but raw asyncpg still will
    def get_engine():  # type: ignore[misc]
        raise ImportError("sqlalchemy[asyncio] is required for get_engine()")

    async def close_engine() -> None:  # type: ignore[misc]
        pass
