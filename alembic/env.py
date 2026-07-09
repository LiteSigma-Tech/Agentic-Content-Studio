"""Alembic environment — connects via libpq env vars (PGHOST/PGPASSWORD/etc.).

Uses psycopg2 keyword arguments built from the standard libpq environment
variables rather than parsing DATABASE_URL.  This is more reliable than URL
parsing: the exact same PGPASSWORD value that postgres used to initialize is
passed directly to psycopg2 without any string splitting, URL encoding, or
intermediate representation.

Fallback: if PGHOST is not set, parses DATABASE_URL with urlparse so the
module works for local development without the PG* vars.

DATABASE_URL is read from the environment variable at runtime, so no
credentials are stored in this file or alembic.ini.

Common commands (run from the project root):
    alembic upgrade head                        # apply all pending migrations
    alembic downgrade -1                        # roll back the last migration
    alembic revision --autogenerate -m "msg"    # generate a new migration
    alembic history                             # show migration history
    alembic current                             # show applied revision
"""
from __future__ import annotations

import os
from logging.config import fileConfig
from urllib.parse import urlparse

import psycopg2
from alembic import context

# Import all models so their metadata is visible to Alembic's autogenerate.
from db.models import Base  # noqa: F401

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def _connect_args() -> dict:
    """Return psycopg2 keyword args from libpq env vars or DATABASE_URL."""
    # Prefer explicit PG* vars (set by docker-compose migrate service).
    if os.environ.get("PGHOST"):
        return {
            "host": os.environ["PGHOST"],
            "port": int(os.environ.get("PGPORT", "5432")),
            "dbname": os.environ.get("PGDATABASE", "agentic"),
            "user": os.environ.get("PGUSER", "agentic"),
            "password": os.environ.get("PGPASSWORD", ""),
        }

    # Fallback: parse DATABASE_URL with urlparse (always splits on last @).
    raw = os.environ.get("DATABASE_URL", "").strip()
    if not raw:
        raise RuntimeError(
            "Neither PGHOST nor DATABASE_URL is set.\n"
            "  export DATABASE_URL=postgresql://user:pass@host:5432/db"
        )
    for prefix in ("postgresql+asyncpg://", "postgresql+psycopg2://"):
        if raw.startswith(prefix):
            raw = "postgresql://" + raw[len(prefix):]
            break
    parsed = urlparse(raw)
    return {
        "host": parsed.hostname,
        "port": parsed.port or 5432,
        "dbname": (parsed.path or "/").lstrip("/"),
        "user": parsed.username,
        "password": parsed.password or "",
    }


def run_migrations_offline() -> None:
    raw = os.environ.get("DATABASE_URL", "").strip()
    for prefix in ("postgresql+asyncpg://", "postgresql+psycopg2://"):
        if raw.startswith(prefix):
            raw = "postgresql://" + raw[len(prefix):]
            break
    context.configure(
        url=raw,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    from sqlalchemy import create_engine, pool

    args = _connect_args()

    # Use SQLAlchemy's `creator` to supply a raw psycopg2 connection without
    # any URL string — bypasses all URL parsing and encoding issues entirely.
    def _creator():
        return psycopg2.connect(**args)

    engine = create_engine(
        "postgresql+psycopg2://",
        creator=_creator,
        poolclass=pool.NullPool,
    )
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()
    engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
