"""Durable store for agent runs. The runtime checkpoints after every step, so a
run that pauses for human approval (or crashes) resumes from exactly where it
left off. On-disk JSON here; Postgres in production."""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

from .models import AgentRun


class RunStore:
    def __init__(self, root: str | Path = "/tmp/agent_runs"):
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, run_id: str) -> Path:
        return self.root / f"{run_id}.json"

    def save(self, run: AgentRun) -> None:
        run.updated_at = datetime.now(timezone.utc).isoformat()
        self._path(run.id).write_text(run.model_dump_json(indent=2))

    def load(self, run_id: str) -> AgentRun:
        return AgentRun.model_validate_json(self._path(run_id).read_text())

    def exists(self, run_id: str) -> bool:
        return self._path(run_id).exists()

    async def asave(self, run: "AgentRun") -> None:
        """Write to disk (always) + Postgres (when available)."""
        from datetime import datetime, timezone
        run.updated_at = datetime.now(timezone.utc).isoformat()
        self._path(run.id).write_text(run.model_dump_json(indent=2))
        try:
            from shared.database import get_pool, is_available
            if await is_available():
                pool = await get_pool()
                async with pool.acquire() as conn:
                    await conn.execute(
                        """INSERT INTO agent_runs(id, run_json, updated_at)
                           VALUES($1, $2, now())
                           ON CONFLICT(id) DO UPDATE SET run_json=$2, updated_at=now()""",
                        run.id, run.model_dump_json()
                    )
        except Exception:
            pass

    async def aload(self, run_id: str) -> "AgentRun":
        """Load from Postgres if available, fall back to disk."""
        from .models import AgentRun
        try:
            from shared.database import get_pool, is_available
            if await is_available():
                pool = await get_pool()
                async with pool.acquire() as conn:
                    row = await conn.fetchrow("SELECT run_json FROM agent_runs WHERE id=$1", run_id)
                    if row:
                        return AgentRun.model_validate_json(row['run_json'])
        except Exception:
            pass
        return AgentRun.model_validate_json(self._path(run_id).read_text())

    async def aexists(self, run_id: str) -> bool:
        try:
            from shared.database import get_pool, is_available
            if await is_available():
                pool = await get_pool()
                async with pool.acquire() as conn:
                    row = await conn.fetchrow("SELECT id FROM agent_runs WHERE id=$1", run_id)
                    return row is not None
        except Exception:
            pass
        return self._path(run_id).exists()

    async def alist_runs(self, limit: int = 50, offset: int = 0) -> list:
        """List run summaries [{id, updated_at}]. Requires DB; falls back to disk listing."""
        try:
            from shared.database import get_pool, is_available
            if await is_available():
                pool = await get_pool()
                async with pool.acquire() as conn:
                    rows = await conn.fetch(
                        "SELECT id, updated_at FROM agent_runs ORDER BY updated_at DESC LIMIT $1 OFFSET $2",
                        limit, offset
                    )
                    return [{"id": r['id'], "updated_at": r['updated_at'].isoformat() if r['updated_at'] else None}
                            for r in rows]
        except Exception:
            pass
        files = sorted(self.root.glob("*.json"), key=lambda f: f.stat().st_mtime, reverse=True)
        return [{"id": f.stem, "updated_at": None} for f in files[offset:offset+limit]]
