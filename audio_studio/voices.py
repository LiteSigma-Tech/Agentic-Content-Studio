"""A small voice library. In production each entry maps to a real TTS voice
(e.g. a Kokoro/XTTS speaker id). Offline, `base_freq` drives a distinct
placeholder timbre per character so synced dialogue is audible and characters
sound different from one another.

Voice casting is deterministic (stable across resume) and genre-aware: kids'
content gets brighter, friendlier voices.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Voice:
    id: str
    label: str
    base_freq: int      # Hz, for the offline placeholder tone
    tags: frozenset


VOICES = [
    Voice("vo_warm_f", "Warm female", 320, frozenset({"warm", "adult", "female"})),
    Voice("vo_deep_m", "Deep male", 130, frozenset({"deep", "adult", "male"})),
    Voice("vo_bright_f", "Bright female", 380, frozenset({"bright", "kids", "female"})),
    Voice("vo_playful_m", "Playful male", 220, frozenset({"playful", "kids", "male"})),
    Voice("vo_narrator", "Narrator", 180, frozenset({"narration", "adult"})),
]

_BY_ID = {v.id: v for v in VOICES}


def get(voice_id: str) -> Voice:
    return _BY_ID.get(voice_id, _BY_ID["vo_narrator"])


def cast_for(characters: list[str], genre: str) -> dict[str, str]:
    """Assign a stable voice to each character. Alternates pools so two
    characters in a scene don't share a voice."""
    pool = (["vo_bright_f", "vo_playful_m"] if genre == "kids_cartoon"
            else ["vo_warm_f", "vo_deep_m", "vo_narrator"])
    return {name: pool[i % len(pool)] for i, name in enumerate(sorted(characters))}
