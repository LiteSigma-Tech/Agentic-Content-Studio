"""Genre templates. Each genre shapes the script prompt (tone, structure,
pacing), the global visual style, and — importantly — which gateway LLM *task*
the script runs under. Kids' content routes through the `kids_content` task,
which the gateway gates on the `moderation_ok` capability so only vetted-safe
models can produce it.
"""
from __future__ import annotations

from dataclasses import dataclass

from .models import Genre


@dataclass(frozen=True)
class GenreTemplate:
    genre: Genre
    tone: str
    beats: list[str]              # structural beats -> one shot each in the offline skeleton
    shot_seconds: float
    style_prompt: str             # appended to every image/video prompt
    llm_task: str                 # gateway routing task
    required_caps: frozenset      # extra capabilities the LLM must declare
    safety_notes: str


_TEMPLATES = {
    Genre.drama: GenreTemplate(
        genre=Genre.drama,
        tone="grounded, emotionally weighty, naturalistic dialogue",
        beats=["establishing exterior", "quiet tension between leads",
               "confrontation", "turning point", "aftermath / resolution"],
        shot_seconds=6.0,
        style_prompt="cinematic, shallow depth of field, muted color grade, naturalistic lighting",
        llm_task="script_writing",
        required_caps=frozenset(),
        safety_notes="Adult themes allowed; standard content moderation.",
    ),
    Genre.romance: GenreTemplate(
        genre=Genre.romance,
        tone="warm, tender, longing, character-driven",
        beats=["meet-cute", "growing connection", "obstacle / misunderstanding",
               "grand gesture", "happy resolution"],
        shot_seconds=6.0,
        style_prompt="soft warm lighting, golden hour, gentle bokeh, intimate framing",
        llm_task="script_writing",
        required_caps=frozenset(),
        safety_notes="Romantic but non-explicit by default.",
    ),
    Genre.comedy: GenreTemplate(
        genre=Genre.comedy,
        tone="upbeat, punchy, quick comic timing, witty banter",
        beats=["cold open hook", "setup of the bit", "escalation",
               "comedic peak", "button / tag"],
        shot_seconds=4.5,
        style_prompt="bright high-key lighting, vivid saturated colors, lively framing",
        llm_task="script_writing",
        required_caps=frozenset(),
        safety_notes="Keep humor inclusive; avoid punching down.",
    ),
    Genre.kids_cartoon: GenreTemplate(
        genre=Genre.kids_cartoon,
        tone="cheerful, simple, gentle, clearly age-appropriate; short sentences",
        beats=["friendly introduction", "a small fun problem",
               "kind friends help out", "happy solution", "warm goodbye lesson"],
        shot_seconds=4.0,
        style_prompt="2D cartoon, rounded friendly shapes, bright primary colors, simple backgrounds",
        llm_task="kids_content",         # gateway gates this on moderation_ok
        required_caps=frozenset({"moderation_ok"}),
        safety_notes=("Strictly age-appropriate. No violence, fear, romance, or "
                      "unsafe behavior. Routed through a moderation-vetted model."),
    ),
}


def template_for(genre: Genre) -> GenreTemplate:
    return _TEMPLATES[genre]
