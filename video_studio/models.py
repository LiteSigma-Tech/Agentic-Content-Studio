"""Domain model for an episodic video project.

Project ─ Episode ─ Scene ─ Shot, plus a cast of Characters whose reference
images are generated once and reused across shots for visual consistency
(the hard part of serialized AI video). PipelineState tracks per-stage status
so a run is durable and resumable.
"""
from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class Genre(str, Enum):
    drama = "drama"
    romance = "romance"
    comedy = "comedy"
    kids_cartoon = "kids_cartoon"


class StageStatus(str, Enum):
    pending = "pending"
    running = "running"
    done = "done"
    failed = "failed"
    awaiting_review = "awaiting_review"


class Line(BaseModel):
    character: str
    text: str


class Shot(BaseModel):
    id: str
    description: str                       # visual action for image/video models
    dialogue: list[Line] = Field(default_factory=list)
    seconds: float = 5.0
    characters: list[str] = Field(default_factory=list)
    keyframe_uri: Optional[str] = None     # filled by generate_keyframes
    clip_uri: Optional[str] = None         # filled by generate_clips
    # --- Audio Studio (B5) ---
    dialogue_audio_uri: Optional[str] = None   # synthesized dialogue for this shot


class Scene(BaseModel):
    id: str
    setting: str
    shots: list[Shot] = Field(default_factory=list)


class Character(BaseModel):
    name: str
    description: str = ""
    reference_uri: Optional[str] = None    # generated once, reused everywhere


class Episode(BaseModel):
    number: int = 1
    title: str = ""
    logline: str = ""
    scenes: list[Scene] = Field(default_factory=list)


class StageRecord(BaseModel):
    name: str
    status: StageStatus = StageStatus.pending
    model_used: Optional[str] = None
    cost_usd: float = 0.0
    error: Optional[str] = None
    started_at: Optional[str] = None
    finished_at: Optional[str] = None
    review_note: Optional[str] = None      # human comment on approve/reject
    prompt_override: Optional[str] = None  # stronger prompt hint for retry


class PipelineState(BaseModel):
    stages: list[StageRecord] = Field(default_factory=list)

    def record(self, name: str) -> StageRecord:
        for s in self.stages:
            if s.name == name:
                return s
        rec = StageRecord(name=name)
        self.stages.append(rec)
        return rec

    @property
    def total_cost_usd(self) -> float:
        return round(sum(s.cost_usd for s in self.stages), 6)


class Project(BaseModel):
    id: str
    title: str
    concept: str                           # one-line premise from the user
    genre: Genre
    style_prompt: str = ""                 # global visual style (set in design stage)
    characters: list[Character] = Field(default_factory=list)
    episode: Episode = Field(default_factory=Episode)
    manifest_uri: Optional[str] = None     # assembly output (timeline / EDL)
    final_uri: Optional[str] = None        # rendered mp4 (silent video)
    # --- review mode ---
    review_mode: bool = False              # pause after each stage for human review
    prompt_overrides: dict[str, str] = Field(default_factory=dict)  # per-stage prompt hints
    # --- Audio Studio (B5) ---
    voice_cast: dict[str, str] = Field(default_factory=dict)  # character -> voice_id
    music_uri: Optional[str] = None        # generated/selected music bed
    master_audio_uri: Optional[str] = None # mixed dialogue + music (ducked)
    final_av_uri: Optional[str] = None     # video + audio muxed (final deliverable)
    pipeline: PipelineState = Field(default_factory=PipelineState)
    created_at: str = Field(default_factory=_now)
    updated_at: str = Field(default_factory=_now)

    def all_shots(self) -> list[Shot]:
        return [sh for sc in self.episode.scenes for sh in sc.shots]
