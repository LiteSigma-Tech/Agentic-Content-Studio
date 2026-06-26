"""FastAPI surface for the Agent Runtime.

  POST /v1/agents/{agent}/runs        -> create a run (goal)
  POST /v1/runs/{id}/run              -> run/resume until done or an approval gate
  POST /v1/runs/{id}/approve          -> resolve a human-in-the-loop approval
  GET  /v1/runs/{id}                  -> status, result, cost, pending approval
  GET  /v1/runs/{id}/trace            -> full auditable step trace
  GET  /healthz

Uses the in-process gateway for LLMPolicy by default (set GATEWAY_URL for HTTP).
Offline, the echo model can't emit tool-calling JSON, so a ScriptedPolicy demo
agent is wired up; configure a real model in the gateway to let LLMPolicy drive.
"""
from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from video_studio.gateway_client import HttpGateway, InProcessGateway

from .guardrails import Guardrails, default_moderator
from .memory import MemoryStore
from .models import Action, AgentSpec
from .policy import LLMPolicy, ScriptedPolicy
from .runtime import AgentRuntime
from .store import RunStore
from .tools import default_tools

_ROUTING = os.getenv("ROUTING_CONFIG",
                     str(Path(__file__).resolve().parent.parent / "routing.yaml"))
_USE_LLM = os.getenv("AGENT_LLM_POLICY") == "1"

gateway = (HttpGateway(os.environ["GATEWAY_URL"]) if os.getenv("GATEWAY_URL")
           else InProcessGateway(_ROUTING))


# Scripted demo brain (offline): research -> propose email (gated) -> finish.
def _demo_brain(run, tools_spec) -> Action:
    pad = " ".join(run.scratchpad)
    if "web_search" not in pad:
        return Action(kind="tool", tool="web_search", args={"query": run.goal},
                      reasoning="research the goal")
    if "Email queued" not in pad and "REJECTED" not in pad:
        return Action(kind="tool", tool="send_email",
                      args={"to": "lead@example.com", "subject": "Hello",
                            "body": "Saw your work — would love to connect."},
                      reasoning="draft outreach (needs approval)")
    return Action(kind="final", content="Outreach task handled.", reasoning="done")


policy = LLMPolicy(gateway) if _USE_LLM else ScriptedPolicy(_demo_brain)

SPECS = {
    "researcher": AgentSpec(
        name="researcher",
        goal_preamble="You are a research + outreach agent. Be concise and safe.",
        allowed_tools={"web_search", "calculator", "current_time", "send_email"},
        guardrails=Guardrails(max_steps=8, spend_cap_usd=1.0, moderate=default_moderator)),
}

app = FastAPI(title="Agent Runtime", version="0.1.0")
runtime = AgentRuntime(SPECS, default_tools(), MemoryStore(),
                       RunStore(os.getenv("AGENT_RUNS_ROOT", "/tmp/agent_runs")), policy)


class CreateRun(BaseModel):
    goal: str


class Approval(BaseModel):
    approved: bool
    note: str = ""


def _view(run):
    return {"id": run.id, "agent": run.agent, "goal": run.goal,
            "status": run.status.value, "step": run.step,
            "total_cost_usd": run.total_cost_usd, "result": run.result,
            "error": run.error,
            "pending": run.pending.model_dump() if run.pending else None}


@app.post("/v1/agents/{agent}/runs")
def create(agent: str, req: CreateRun):
    if agent not in SPECS:
        raise HTTPException(404, "unknown agent")
    return _view(runtime.create_run(agent, req.goal))


@app.post("/v1/runs/{run_id}/run")
def run(run_id: str):
    if not runtime.store.exists(run_id):
        raise HTTPException(404, "run not found")
    return _view(runtime.run(run_id))


@app.post("/v1/runs/{run_id}/approve")
def approve(run_id: str, req: Approval):
    if not runtime.store.exists(run_id):
        raise HTTPException(404, "run not found")
    try:
        return _view(runtime.approve(run_id, req.approved, req.note))
    except RuntimeError as e:
        raise HTTPException(409, str(e))


@app.get("/v1/runs/{run_id}")
def status(run_id: str):
    if not runtime.store.exists(run_id):
        raise HTTPException(404, "run not found")
    return _view(runtime.store.load(run_id))


@app.get("/v1/runs/{run_id}/trace")
def trace(run_id: str):
    if not runtime.store.exists(run_id):
        raise HTTPException(404, "run not found")
    return {"trace": [e.model_dump() for e in runtime.store.load(run_id).trace]}


@app.get("/healthz")
def healthz():
    return {"status": "ok", "policy": "llm" if _USE_LLM else "scripted"}
