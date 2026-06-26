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
