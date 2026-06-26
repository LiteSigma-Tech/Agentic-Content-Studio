"""Tool registry.

Tools are typed and *permissioned*: each declares a scope, an arg schema, and
whether it requires human approval before it runs. An agent is granted a subset
of tool names; the runtime refuses any call outside that grant. Side-effecting
tools (e.g. send_email) set `requires_approval=True`, which forces a
human-in-the-loop gate.

The built-ins here are safe, deterministic demo tools so the runtime runs
offline. Real deployments register real tools (data-provider APIs, DB access,
the Model Gateway media tools, etc.) the same way.
"""
from __future__ import annotations

import ast
import operator
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Callable


class ToolError(Exception):
    """Raised by a tool on failure. The runtime records it and lets the agent
    observe the error and adapt, rather than aborting the whole run."""


@dataclass
class Tool:
    name: str
    description: str
    params: dict                      # {arg_name: "type/description"} for the LLM + UI
    fn: Callable[..., str]
    scope: str = "read"               # read | write | comms | media ...
    requires_approval: bool = False   # side-effecting -> HITL gate
    est_cost_usd: float = 0.0


class ToolRegistry:
    def __init__(self) -> None:
        self._tools: dict[str, Tool] = {}

    def register(self, tool: Tool) -> None:
        self._tools[tool.name] = tool

    def get(self, name: str) -> Tool | None:
        return self._tools.get(name)

    def describe(self, allowed: set[str] | None = None) -> list[dict]:
        """Tool specs for the agent prompt / UI. Restricted to `allowed`."""
        names = allowed if allowed is not None else set(self._tools)
        return [
            {"name": t.name, "description": t.description, "params": t.params,
             "scope": t.scope, "requires_approval": t.requires_approval}
            for t in self._tools.values() if t.name in names
        ]


# --- safe arithmetic for the calculator tool -------------------------------
_OPS = {ast.Add: operator.add, ast.Sub: operator.sub, ast.Mult: operator.mul,
        ast.Div: operator.truediv, ast.Pow: operator.pow, ast.Mod: operator.mod,
        ast.USub: operator.neg, ast.UAdd: operator.pos}


def _safe_eval(node):
    if isinstance(node, ast.Expression):
        return _safe_eval(node.body)
    if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
        return node.value
    if isinstance(node, ast.BinOp) and type(node.op) in _OPS:
        return _OPS[type(node.op)](_safe_eval(node.left), _safe_eval(node.right))
    if isinstance(node, ast.UnaryOp) and type(node.op) in _OPS:
        return _OPS[type(node.op)](_safe_eval(node.operand))
    raise ToolError("unsupported expression")


def _calculator(expression: str) -> str:
    try:
        return str(_safe_eval(ast.parse(str(expression), mode="eval")))
    except ToolError:
        raise
    except Exception as e:
        raise ToolError(f"could not evaluate {expression!r}: {e}") from e


def _web_search(query: str) -> str:
    # Deterministic offline stand-in. Real deployments register a search/data API.
    q = str(query).strip()
    return (f"Top results for '{q}': "
            f"(1) Overview of {q}; (2) Recent trends in {q}; "
            f"(3) Key players and contact pages related to {q}.")


def _current_time() -> str:
    return datetime.now(timezone.utc).isoformat()


def _send_email(to: str, subject: str, body: str) -> str:
    # Side-effecting -> registered with requires_approval=True. Demo simulates.
    return f"Email queued to {to} | subject={subject!r} | {len(body)} chars (simulated send)"


def default_tools() -> ToolRegistry:
    reg = ToolRegistry()
    reg.register(Tool("calculator", "Evaluate an arithmetic expression.",
                      {"expression": "string, e.g. '2*(3+4)'"}, _calculator, scope="read"))
    reg.register(Tool("web_search", "Search the web for a query.",
                      {"query": "string"}, _web_search, scope="read"))
    reg.register(Tool("current_time", "Get the current UTC time.",
                      {}, _current_time, scope="read"))
    reg.register(Tool("send_email", "Send an email to a recipient.",
                      {"to": "string", "subject": "string", "body": "string"},
                      _send_email, scope="comms", requires_approval=True))
    return reg
