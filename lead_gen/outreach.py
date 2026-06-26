"""Outreach runs on the Agent Runtime (B2): every send goes through the
runtime's human-in-the-loop approval gate, and the send tool itself re-checks
the suppression list (defense-in-depth) so a lead suppressed after a draft was
proposed can never be emailed even if a human clicks approve.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from agent_runtime.models import Action  # noqa: E402
from agent_runtime.tools import Tool, ToolError, ToolRegistry  # noqa: E402

from .compliance import SuppressionList, contactability_email  # noqa: E402


def make_outreach_registry(suppression: SuppressionList,
                           on_sent=None) -> ToolRegistry:
    def _send(to: str, subject: str, body: str) -> str:
        ok, reason = contactability_email(to, suppression)
        if not ok:
            raise ToolError(f"send blocked by compliance: {reason}")
        if "stop" not in body.lower() and "unsubscribe" not in body.lower():
            raise ToolError("send blocked: body lacks an opt-out/unsubscribe line")
        if on_sent:
            on_sent(to)
        return f"Email queued to {to} | subject={subject!r} | {len(body)} chars (simulated)"

    reg = ToolRegistry()
    reg.register(Tool(
        "send_email", "Send a compliance-checked outreach email.",
        {"to": "string", "subject": "string", "body": "string"},
        _send, scope="comms", requires_approval=True))
    return reg


def outreach_brain(run, tools_spec) -> Action:
    """Scripted brain: propose the (pre-drafted) send, then report the outcome.
    The draft is carried in run.goal as JSON. A real LLMPolicy could research /
    personalize before drafting; the approval gate and compliance tool are
    unchanged."""
    pad = " ".join(run.scratchpad).lower()
    if not any(k in pad for k in ("queued", "rejected", "blocked", "error")):
        draft = json.loads(run.goal)
        return Action(kind="tool", tool="send_email", args=draft,
                      reasoning="send the approved, compliance-checked outreach")
    if "queued" in pad:
        return Action(kind="final", content="Outreach sent.", reasoning="done")
    return Action(kind="final", content="Outreach NOT sent (rejected or blocked).",
                  reasoning="halted")
