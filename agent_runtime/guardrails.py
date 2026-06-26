"""Guardrails enforced by the runtime around every step.

- step cap: bound the agent loop.
- spend cap: abort if accumulated cost (reasoning + tool costs) would exceed a
  per-run ceiling. (Pairs with the gateway's own free-only cost policy.)
- moderation hook: a pluggable `moderate(text) -> (ok, reason)` applied to final
  output (and usable on tool inputs). The default is a simple keyword blocklist;
  production swaps in a real moderation model. Kids' agents use a stricter one.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

Moderator = Callable[[str], tuple[bool, str]]


def keyword_moderator(blocked: set[str]) -> Moderator:
    low = {w.lower() for w in blocked}

    def _mod(text: str) -> tuple[bool, str]:
        hit = next((w for w in low if w in text.lower()), None)
        return (hit is None, "" if hit is None else f"blocked term: {hit!r}")
    return _mod


# Minimal default; real deployments plug in a moderation model.
default_moderator: Moderator = keyword_moderator({"malware", "explosive"})

# Stricter default for child-directed agents.
kids_moderator: Moderator = keyword_moderator(
    {"malware", "explosive", "weapon", "kill", "blood", "drug"})


@dataclass
class Guardrails:
    max_steps: int = 8
    spend_cap_usd: float = 1.0
    moderate: Moderator = default_moderator
