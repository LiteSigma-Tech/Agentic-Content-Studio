"""Durable store for projects. Each project is a JSON document on disk; the
pipeline saves a checkpoint after every stage so a crashed or interrupted run
resumes from the last completed stage.

In production this maps onto Temporal (workflow state) + Postgres; the on-disk
JSON here is the same idea with zero infra so it runs anywhere.
"""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

from .models import Project


class ProjectStore:
    def __init__(self, root: str | Path = "/tmp/video_studio"):
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, project_id: str) -> Path:
        return self.root / f"{project_id}.json"

    def media_dir(self, project_id: str) -> Path:
        d = self.root / project_id / "media"
        d.mkdir(parents=True, exist_ok=True)
        return d

    def save(self, project: Project) -> None:
        project.updated_at = datetime.now(timezone.utc).isoformat()
        self._path(project.id).write_text(project.model_dump_json(indent=2))

    def load(self, project_id: str) -> Project:
        return Project.model_validate_json(self._path(project_id).read_text())

    def exists(self, project_id: str) -> bool:
        return self._path(project_id).exists()

    async def asave(self, project: Project) -> None:
        """Write to disk (always) + Postgres (when available)."""
        from datetime import datetime, timezone
        project.updated_at = datetime.now(timezone.utc).isoformat()
        self._path(project.id).write_text(project.model_dump_json(indent=2))
        try:
            from shared.database import get_pool, is_available
            if await is_available():
                pool = await get_pool()
                async with pool.acquire() as conn:
                    await conn.execute(
                        """INSERT INTO projects(id, project_json, updated_at)
                           VALUES($1, $2, now())
                           ON CONFLICT(id) DO UPDATE SET project_json=$2, updated_at=now()""",
                        project.id, project.model_dump_json()
                    )
        except Exception:
            pass

    async def aload(self, project_id: str) -> Project:
        """Load from Postgres if available, fall back to disk."""
        from .models import Project
        try:
            from shared.database import get_pool, is_available
            if await is_available():
                pool = await get_pool()
                async with pool.acquire() as conn:
                    row = await conn.fetchrow("SELECT project_json FROM projects WHERE id=$1", project_id)
                    if row:
                        return Project.model_validate_json(row['project_json'])
        except Exception:
            pass
        return Project.model_validate_json(self._path(project_id).read_text())

    async def aexists(self, project_id: str) -> bool:
        try:
            from shared.database import get_pool, is_available
            if await is_available():
                pool = await get_pool()
                async with pool.acquire() as conn:
                    row = await conn.fetchrow("SELECT id FROM projects WHERE id=$1", project_id)
                    return row is not None
        except Exception:
            pass
        return self._path(project_id).exists()

    async def alist_projects(self, limit: int = 50, offset: int = 0) -> list:
        """List project summaries. Uses DB when available and non-empty, falls back to disk.

        The sync save() path only writes to disk, so DB may be empty even when
        projects exist. Always fall through to disk when DB returns zero rows.
        """
        try:
            from shared.database import get_pool, is_available
            if await is_available():
                pool = await get_pool()
                async with pool.acquire() as conn:
                    rows = await conn.fetch(
                        "SELECT id, updated_at FROM projects ORDER BY updated_at DESC LIMIT $1 OFFSET $2",
                        limit, offset
                    )
                    if rows:  # only trust DB if it actually has data
                        return [{"id": r['id'], "updated_at": r['updated_at'].isoformat() if r['updated_at'] else None}
                                for r in rows]
        except Exception:
            pass
        files = sorted(self.root.glob("*.json"), key=lambda f: f.stat().st_mtime, reverse=True)
        return [{"id": f.stem, "updated_at": None} for f in files[offset:offset + limit]]
