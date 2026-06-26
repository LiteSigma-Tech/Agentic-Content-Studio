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
