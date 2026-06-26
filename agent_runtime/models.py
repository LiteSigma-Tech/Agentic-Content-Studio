"""Data models for the agent runtime."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field

from .guardrails import Guardrails


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# --- the policy's decision ---------------------------------------------------
@dataclass
class Action:
    kind: str                       # "tool" | "final"
    reasoning: str = ""
    tool: Optional[str] = None
    args: dict = field(default_factory=dict)
    content: str = ""               # for kind == "final"
    model: str = ""                 # model that produced the decision
    cost_usd: float = 0.0


# --- agent definition --------------------------------------------------------
@dataclass
class AgentSpec:
    name: str
    goal_preamble: str              # system instruction / role
    allowed_tools: set[str]         # tool names this agent may call
    guardrails: Guardrails = field(default_factory=Guardrails)
    memory_namespace: Optional[str] = None   # defaults to the agent name


# --- run state (persisted) ---------------------------------------------------
class RunStatus(str, Enum):
    running = "running"
    awaiting_approval = "awaiting_approval"
    done = "done"
    failed = "failed"
    aborted = "aborted"


class TraceEvent(BaseModel):
    step: int
    type: str            # think | tool_call | tool_result | approval_request
    #                      | approval_decision | final | guardrail | error
    summary: str
    data: dict = Field(default_factory=dict)
    model: Optional[str] = None
    cost_usd: float = 0.0
    ts: str = Field(default_factory=_now)


class PendingApproval(BaseModel):
    tool: str
    args: dict
    reason: str = ""


class AgentRun(BaseModel):
    id: str
    agent: str
    goal: str
    status: RunStatus = RunStatus.running
    step: int = 0
    scratchpad: list[str] = Field(default_factory=list)   # observations the policy sees
    trace: list[TraceEvent] = Field(default_factory=list)
    memory_namespace: str = ""
    pending: Optional[PendingApproval] = None
    result: Optional[str] = None
    error: Optional[str] = None
    total_cost_usd: float = 0.0
    created_at: str = Field(default_factory=_now)
    updated_at: str = Field(default_factory=_now)

    def log(self, **kw) -> None:
        self.trace.append(TraceEvent(step=self.step, **kw))
