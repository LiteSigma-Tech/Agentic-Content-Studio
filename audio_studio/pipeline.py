"""Composes the full studio pipeline with audio generation moved before the
expensive video clip generation. This ensures TTS and music calls hit Replicate
while the rate-limit budget is fresh, rather than after 5+ video clip calls.

  write_script → design_characters → generate_keyframes →
  cast_voices → generate_dialogue → generate_music →   ← audio first
  generate_clips → assemble → render →                 ← video clips last
  mix_audio → mux
"""
from __future__ import annotations

from video_studio.gateway_client import Gateway
from video_studio.pipeline import Pipeline
from video_studio.stages import STAGES as VIDEO_STAGES
from video_studio.store import ProjectStore

from .stages import AUDIO_STAGES

# Split video stages: pre-clip (script + images) and post-clip (assemble + render)
_PRE_CLIP  = VIDEO_STAGES[:3]   # write_script, design_characters, generate_keyframes
_CLIP      = VIDEO_STAGES[3:4]  # generate_clips
_POST_CLIP = VIDEO_STAGES[4:]   # assemble, render

# Audio middle stages (need script + voices; don't need clips yet)
_AUDIO_MID = AUDIO_STAGES[:3]   # cast_voices, generate_dialogue, generate_music

# Final audio stages (need rendered video)
_AUDIO_END = AUDIO_STAGES[3:]   # mix_audio, mux

FULL_STAGES = [*_PRE_CLIP, *_AUDIO_MID, *_CLIP, *_POST_CLIP, *_AUDIO_END]


def full_pipeline(gw: Gateway, store: ProjectStore, on_progress=None) -> Pipeline:
    return Pipeline(gw, store, on_progress=on_progress, stages=FULL_STAGES)
