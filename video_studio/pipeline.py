"""Orchestrates the staged pipeline with durable checkpointing.

Runs stages in order; after each stage it saves the full project to the store,
so an interrupted run resumes from the first stage that isn't `done`. Stages
are idempotent, so resuming is safe and cheap. A stage failure is recorded
(status=failed + error) and the run stops; calling run() again retries from
that stage.

In production this is a Temporal workflow (each stage an activity); the logic
here is identical, just without the infra.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Callable

from .gateway_client import Gateway
from .models import Genre, Project, StageStatus
from .stages import STAGES, StageContext
from .store import ProjectStore


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def create_project(concept: str, genre: Genre, title: str = "",
                   store: ProjectStore | None = None) -> Project:
    store = store or ProjectStore()
    pid = uuid.uuid4().hex[:12]
    project = Project(id=pid, title=title or concept[:48], concept=concept, genre=genre)
    store.save(project)
    return project


class Pipeline:
    def __init__(self, gw: Gateway, store: ProjectStore,
                 on_progress: Callable[[Project, str], None] | None = None,
                 stages: list | None = None):
        self.gw = gw
        self.store = store
        self.on_progress = on_progress or (lambda p, s: None)
        self.stages = stages if stages is not None else STAGES

    def run(self, project_id: str, *, force_from: str | None = None) -> Project:
        project = self.store.load(project_id)
        ctx = StageContext(gw=self.gw, store=self.store,
                           media_dir=self.store.media_dir(project_id))

        forcing = force_from is None  # if no force point, never force; else start forcing at match
        for name, fn in self.stages:
            rec = project.pipeline.record(name)
            if force_from and name == force_from:
                forcing = True
            if rec.status == StageStatus.done and not forcing:
                continue  # already complete -> skip (resume)

            rec.status = StageStatus.running
            rec.started_at = _now()
            rec.error = None
            self.on_progress(project, name)
            self.store.save(project)

            try:
                model_used, cost = fn(project, ctx)
            except Exception as e:  # noqa: BLE001 — checkpoint the failure, then surface
                rec.status = StageStatus.failed
                rec.error = f"{type(e).__name__}: {e}"
                rec.finished_at = _now()
                self.store.save(project)
                raise

            rec.status = StageStatus.done
            rec.model_used = model_used
            rec.cost_usd = round(cost, 6)
            rec.finished_at = _now()
            self.store.save(project)

        self.on_progress(project, "complete")
        return project

    def status(self, project_id: str) -> dict:
        p = self.store.load(project_id)
        return {
            "id": p.id, "title": p.title, "genre": p.genre.value,
            "total_cost_usd": p.pipeline.total_cost_usd,
            "final_uri": p.final_uri, "manifest_uri": p.manifest_uri,
            "final_av_uri": getattr(p, "final_av_uri", None),
            "master_audio_uri": getattr(p, "master_audio_uri", None),
            "stages": [s.model_dump() for s in p.pipeline.stages],
        }
