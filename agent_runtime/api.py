"""FastAPI surface for the Agent Runtime.

  POST /v1/agents/{agent}/runs        -> create a run (goal)
  POST /v1/runs/{id}/run              -> run/resume until done or an approval gate
                                         ?background=true -> enqueue to ARQ worker
  POST /v1/runs/{id}/approve          -> resolve a human-in-the-loop approval
  GET  /v1/runs                       -> list runs (paginated)
  GET  /v1/runs/{id}                  -> status, result, cost, pending approval
  GET  /v1/runs/{id}/trace            -> full auditable step trace
  POST /v1/webhooks                   -> register a webhook (url, events, secret)
  GET  /v1/webhooks                   -> list registered webhooks
  DELETE /v1/webhooks/{id}            -> remove a webhook
  GET  /healthz

Uses the in-process gateway for LLMPolicy by default (set GATEWAY_URL for HTTP).
Offline, the echo model can't emit tool-calling JSON, so a ScriptedPolicy demo
agent is wired up; configure a real model in the gateway to let LLMPolicy drive.
"""
from __future__ import annotations

import asyncio
import os
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
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

# --- webhook store -----------------------------------------------------------
try:
    from shared.webhooks import WebhookStore, deliver_event
    webhook_store = WebhookStore()
    _webhooks_available = True
except ImportError:
    _webhooks_available = False


def _maybe_fire_webhooks(run) -> None:
    """Schedule webhook delivery if run reached a terminal state."""
    if not _webhooks_available:
        return
    terminal = ("done", "failed", "aborted")
    status = run.status.value if hasattr(run.status, "value") else str(run.status)
    if status in terminal:
        event = f"run.{status}"
        asyncio.create_task(deliver_event(webhook_store, event, _view(run)))


app = FastAPI(title="Agent Runtime", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173,http://localhost:5174").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

try:
    from shared.metrics import add_metrics_endpoint
    add_metrics_endpoint(app, "agents")
except Exception:
    pass


@app.on_event("startup")
async def _startup():
    try:
        from shared.logging_config import configure_logging
        configure_logging()
    except Exception:
        pass


runtime = AgentRuntime(SPECS, default_tools(), MemoryStore(),
                       RunStore(os.getenv("AGENT_RUNS_ROOT", "/tmp/agent_runs")), policy)


# --- request/response models -------------------------------------------------
class CreateRun(BaseModel):
    goal: str


class Approval(BaseModel):
    approved: bool
    note: str = ""


class WebhookReq(BaseModel):
    url: str
    events: list[str]
    secret: str = ""


# --- helpers -----------------------------------------------------------------
def _view(run):
    return {"id": run.id, "agent": run.agent, "goal": run.goal,
            "status": run.status.value, "step": run.step,
            "total_cost_usd": run.total_cost_usd, "result": run.result,
            "error": run.error,
            "pending": run.pending.model_dump() if run.pending else None}


# --- run endpoints -----------------------------------------------------------
@app.post("/v1/agents/{agent}/runs")
def create(agent: str, req: CreateRun):
    if agent not in SPECS:
        raise HTTPException(404, "unknown agent")
    return _view(runtime.create_run(agent, req.goal))


@app.post("/v1/runs/{run_id}/run")
async def run(run_id: str, background: bool = Query(False)):
    if not runtime.store.exists(run_id):
        raise HTTPException(404, "run not found")

    if background:
        # Try ARQ first; fall back to asyncio task if Redis is unavailable.
        redis_url = os.getenv("REDIS_URL")
        if redis_url:
            try:
                from arq import create_pool
                from arq.connections import RedisSettings
                pool = await create_pool(RedisSettings.from_dsn(redis_url))
                job = await pool.enqueue_job("agent_run_execute", run_id)
                await pool.aclose()
                return {"status": "queued", "run_id": run_id, "job_id": job.job_id}
            except Exception:
                pass
        # Fallback: fire-and-forget asyncio task
        asyncio.create_task(asyncio.to_thread(runtime.run, run_id))
        return {"status": "started", "run_id": run_id}

    result = await asyncio.to_thread(runtime.run, run_id)
    _maybe_fire_webhooks(result)
    return _view(result)


@app.post("/v1/runs/{run_id}/approve")
async def approve(run_id: str, req: Approval):
    if not runtime.store.exists(run_id):
        raise HTTPException(404, "run not found")
    try:
        result = await asyncio.to_thread(runtime.approve, run_id, req.approved, req.note)
    except RuntimeError as e:
        raise HTTPException(409, str(e))
    _maybe_fire_webhooks(result)
    return _view(result)


@app.get("/v1/runs")
async def list_runs(limit: int = Query(50, ge=1, le=500), offset: int = Query(0, ge=0)):
    runs = await runtime.store.alist_runs(limit=limit, offset=offset)
    return {"items": runs, "limit": limit, "offset": offset}


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


# --- webhook endpoints -------------------------------------------------------
@app.post("/v1/webhooks", status_code=201)
def register_webhook(req: WebhookReq):
    if not _webhooks_available:
        raise HTTPException(501, "webhooks not available")
    if not req.url.startswith(("http://", "https://")):
        raise HTTPException(422, "url must start with http:// or https://")
    hook = webhook_store.register(req.url, req.events, req.secret)
    return hook.to_dict()


@app.get("/v1/webhooks")
def list_webhooks():
    if not _webhooks_available:
        return {"webhooks": []}
    return {"webhooks": [h.to_dict() for h in webhook_store.list()]}


@app.delete("/v1/webhooks/{hook_id}")
def delete_webhook(hook_id: str):
    if not _webhooks_available:
        raise HTTPException(501, "webhooks not available")
    if not webhook_store.delete(hook_id):
        raise HTTPException(404, "webhook not found")
    return {"deleted": hook_id}


@app.get("/healthz")
def healthz():
    return {"status": "ok", "policy": "llm" if _USE_LLM else "scripted"}
