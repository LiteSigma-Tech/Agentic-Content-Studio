"""Composes the full studio pipeline: the six video stages (B4) followed by the
five audio stages (B5), run by the same durable, resumable orchestrator. The
final deliverable is `final_av_uri` — video with synced, mixed audio.

  write_script → design_characters → generate_keyframes → generate_clips →
  assemble → render → cast_voices → generate_dialogue → generate_music →
  mix_audio → mux
"""
from __future__ import annotations

from video_studio.gateway_client import Gateway
from video_studio.pipeline import Pipeline
from video_studio.stages import STAGES as VIDEO_STAGES
from video_studio.store import ProjectStore

from .stages import AUDIO_STAGES

FULL_STAGES = [*VIDEO_STAGES, *AUDIO_STAGES]


def full_pipeline(gw: Gateway, store: ProjectStore, on_progress=None) -> Pipeline:
    return Pipeline(gw, store, on_progress=on_progress, stages=FULL_STAGES)
