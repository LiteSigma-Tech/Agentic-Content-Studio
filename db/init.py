"""Run database migrations via Alembic.

Called at service startup (and by the dedicated `migrate` docker-compose service).
Safe to call multiple times — Alembic tracks which revisions have been applied.

Usage:
    python -m db.init              # direct
    alembic upgrade head           # equivalent, with more output

Note: the local alembic/ migrations directory shadows the alembic Python package
when imported directly, so we call the alembic CLI binary via shutil.which instead
of using `from alembic import command`.
"""
from __future__ import annotations

import asyncio
import os
import shutil
import subprocess
from pathlib import Path


def run_migrations() -> None:
    """Invoke the alembic CLI binary to apply all pending migrations."""
    if not os.environ.get("DATABASE_URL"):
        print("DATABASE_URL not set — skipping migrations.")
        return

    alembic_bin = shutil.which("alembic")
    if not alembic_bin:
        raise RuntimeError(
            "alembic binary not found on PATH. "
            "Install it with: pip install alembic"
        )

    project_root = Path(__file__).resolve().parent.parent
    result = subprocess.run(
        [alembic_bin, "upgrade", "head"],
        cwd=project_root,
        env={**os.environ},
    )
    if result.returncode != 0:
        raise RuntimeError(f"alembic upgrade head failed (exit {result.returncode})")


async def main() -> None:
    """Async entry point for services that call this at startup."""
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, run_migrations)


if __name__ == "__main__":
    run_migrations()
