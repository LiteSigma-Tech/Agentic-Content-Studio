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
                   store: ProjectStore | None = None,
                   review_mode: bool = False) -> Project:
    store = store or ProjectStore()
    pid = uuid.uuid4().hex[:12]
    project = Project(id=pid, title=title or concept[:48], concept=concept,
                      genre=genre, review_mode=review_mode)
    store.save(project)
    return project


def _clear_stage_output(project: Project, stage_name: str) -> None:
    """Clear the output fields a stage writes so it will re-run fully."""
    if stage_name == "design_characters":
        for ch in project.characters:
            ch.reference_uri = None
    elif stage_name == "generate_keyframes":
        for sh in project.all_shots():
            sh.keyframe_uri = None
    elif stage_name == "generate_clips":
        for sh in project.all_shots():
            sh.clip_uri = None
    elif stage_name == "assemble":
        project.manifest_uri = None
    elif stage_name == "render":
        project.final_uri = None
    elif stage_name == "cast_voices":
        project.voice_cast = {}
    elif stage_name == "generate_dialogue":
        for sh in project.all_shots():
            sh.dialogue_audio_uri = None
    elif stage_name == "generate_music":
        project.music_uri = None
    elif stage_name == "mix_audio":
        project.master_audio_uri = None
    elif stage_name == "mux":
        project.final_av_uri = None
    # write_script: always overwrites episode/characters, no per-field idempotency guard


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

        forcing = False  # becomes True once we reach the force_from stage (or stays False for normal resume)
        for name, fn in self.stages:
            rec = project.pipeline.record(name)
            if force_from and name == force_from:
                forcing = True

            # Pipeline is paused — a stage needs human review before we can continue
            if rec.status == StageStatus.awaiting_review:
                return project

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

            if project.review_mode:
                rec.status = StageStatus.awaiting_review
                self.store.save(project)
                return project  # pause — human must approve before next stage

            self.store.save(project)

        self.on_progress(project, "complete")
        return project

    def approve_stage(self, project_id: str, stage_name: str,
                      note: str = "") -> Project:
        """Mark a stage as done so the pipeline can continue past it."""
        project = self.store.load(project_id)
        rec = project.pipeline.record(stage_name)
        if rec.status != StageStatus.awaiting_review:
            raise ValueError(
                f"Stage {stage_name!r} is not awaiting review (status: {rec.status})")
        rec.status = StageStatus.done
        if note:
            rec.review_note = note
        self.store.save(project)
        return project

    def reject_stage(self, project_id: str, stage_name: str,
                     prompt_override: str = "", note: str = "") -> Project:
        """Reset a stage (and all downstream) so it re-runs with an optional stronger prompt."""
        project = self.store.load(project_id)
        rec = project.pipeline.record(stage_name)
        if rec.status != StageStatus.awaiting_review:
            raise ValueError(
                f"Stage {stage_name!r} is not awaiting review (status: {rec.status})")
        if prompt_override:
            project.prompt_overrides[stage_name] = prompt_override
            rec.prompt_override = prompt_override
        if note:
            rec.review_note = note
        stage_names = [n for n, _ in self.stages]
        idx = stage_names.index(stage_name)
        for i in range(idx, len(stage_names)):
            name = stage_names[i]
            _clear_stage_output(project, name)
            project.pipeline.record(name).status = StageStatus.pending
        self.store.save(project)
        return project

    def status(self, project_id: str) -> dict:
        p = self.store.load(project_id)
        awaiting = next(
            (s.name for s in p.pipeline.stages
             if s.status == StageStatus.awaiting_review), None)
        return {
            "id": p.id, "title": p.title, "genre": p.genre.value,
            "review_mode": p.review_mode,
            "awaiting_review_stage": awaiting,
            "total_cost_usd": p.pipeline.total_cost_usd,
            "final_uri": p.final_uri, "manifest_uri": p.manifest_uri,
            "final_av_uri": getattr(p, "final_av_uri", None),
            "master_audio_uri": getattr(p, "master_audio_uri", None),
            "episode": p.episode.model_dump() if p.episode.scenes else None,
            "characters": [c.model_dump() for c in p.characters],
            "voice_cast": p.voice_cast,
            "stages": [s.model_dump() for s in p.pipeline.stages],
        }
