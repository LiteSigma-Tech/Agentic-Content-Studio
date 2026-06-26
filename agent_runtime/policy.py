"""The policy is the agent's 'brain': given the goal, available tools, and the
observations so far, it returns the next Action (call a tool, or finish).

- LLMPolicy: production brain. Prompts the Model Gateway's LLM (agent_reasoning
  task, requiring function_calling) for a structured JSON decision and parses it.
- ScriptedPolicy: a deterministic brain for tests/offline/demos. The runtime
  mechanics (loop, tools, memory, HITL, tracing, guardrails, checkpointing) are
  identical regardless of which brain drives.

Offline the gateway's echo mock can't produce tool-calling JSON, so the demo
uses ScriptedPolicy; plug a real model into the gateway and LLMPolicy drives.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Callable

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from .models import Action, AgentRun  # noqa: E402


class PolicyError(Exception):
    pass


def _extract_json(text: str) -> dict | None:
    t = re.sub(r"```(?:json)?", "", text or "").strip()
    start = t.find("{")
    if start == -1:
        return None
    depth = 0
    for i in range(start, len(t)):
        depth += (t[i] == "{") - (t[i] == "}")
        if depth == 0:
            try:
                return json.loads(t[start:i + 1])
            except Exception:
                return None
    return None


class Policy:
    def next_action(self, run: AgentRun, preamble: str, tools_spec: list[dict]) -> Action:
        raise NotImplementedError


class ScriptedPolicy(Policy):
    """Wraps a function (run, tools_spec) -> Action for deterministic control."""

    def __init__(self, fn: Callable[[AgentRun, list[dict]], Action]):
        self._fn = fn

    def next_action(self, run, preamble, tools_spec) -> Action:
        return self._fn(run, tools_spec)


class LLMPolicy(Policy):
    def __init__(self, gateway, task: str = "agent_reasoning",
                 required_caps: set[str] | None = None):
        self.gw = gateway
        self.task = task
        self.required_caps = required_caps or {"function_calling"}

    def _prompt(self, run: AgentRun, preamble: str, tools_spec: list[dict]) -> str:
        tools = "\n".join(
            f"- {t['name']}({', '.join(t['params'])}): {t['description']}"
            + (" [requires approval]" if t["requires_approval"] else "")
            for t in tools_spec)
        history = "\n".join(run.scratchpad) or "(no observations yet)"
        return (
            f"{preamble}\n\nGoal: {run.goal}\n\nTools available:\n{tools}\n\n"
            f"Observations so far:\n{history}\n\n"
            "Decide the single next step. Respond ONLY with JSON, one of:\n"
            '  {"reasoning": "...", "action": {"tool": "<name>", "args": {...}}}\n'
            '  {"reasoning": "...", "final": "<answer to the goal>"}'
        )

    def next_action(self, run, preamble, tools_spec) -> Action:
        res = self.gw.llm(self.task, [{"role": "user",
                                       "content": self._prompt(run, preamble, tools_spec)}],
                          json_mode=True, required_caps=self.required_caps)
        data = _extract_json(res.text)
        if not data:
            raise PolicyError("LLM did not return parseable JSON for the next action")
        if "final" in data:
            return Action(kind="final", content=str(data["final"]),
                          reasoning=str(data.get("reasoning", "")),
                          model=res.model_used, cost_usd=res.cost_usd)
        act = data.get("action") or {}
        if not act.get("tool"):
            raise PolicyError("LLM action missing a tool name")
        return Action(kind="tool", tool=act["tool"], args=act.get("args", {}),
                      reasoning=str(data.get("reasoning", "")),
                      model=res.model_used, cost_usd=res.cost_usd)
