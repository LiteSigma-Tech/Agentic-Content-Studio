"""ARQ worker — background task processor for studio pipelines and agent runs.

Run with:
    python -m arq shared.worker.WorkerSettings

Or via docker-compose (see worker service).
"""
from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

from arq.connections import RedisSettings

_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_ROOT))


async def studio_pipeline_run(ctx, project_id: str, force_from: str | None = None):
    """Run (or resume) a studio pipeline project in a worker process."""
    from video_studio.gateway_client import HttpGateway, InProcessGateway
    from video_studio.store import ProjectStore
    from audio_studio.pipeline import full_pipeline

    routing = os.getenv("ROUTING_CONFIG", str(_ROOT / "routing.yaml"))
    store = ProjectStore(os.getenv("STUDIO_ROOT", "/tmp/video_studio"))
    gw = (HttpGateway(os.environ["GATEWAY_URL"]) if os.getenv("GATEWAY_URL")
          else InProcessGateway(routing))
    pipeline = full_pipeline(gw, store)
    await asyncio.to_thread(pipeline.run, project_id, force_from=force_from)


async def agent_run_execute(ctx, run_id: str):
    """Run (or resume) an agent run in a worker process."""
    from video_studio.gateway_client import HttpGateway, InProcessGateway
    from agent_runtime.api import SPECS, _USE_LLM, _demo_brain
    from agent_runtime.memory import MemoryStore
    from agent_runtime.policy import LLMPolicy, ScriptedPolicy
    from agent_runtime.runtime import AgentRuntime
    from agent_runtime.store import RunStore
    from agent_runtime.tools import default_tools

    routing = os.getenv("ROUTING_CONFIG", str(_ROOT / "routing.yaml"))
    gw = (HttpGateway(os.environ["GATEWAY_URL"]) if os.getenv("GATEWAY_URL")
          else InProcessGateway(routing))
    policy = LLMPolicy(gw) if _USE_LLM else ScriptedPolicy(_demo_brain)
    store = RunStore(os.getenv("AGENT_RUNS_ROOT", "/tmp/agent_runs"))
    rt = AgentRuntime(SPECS, default_tools(), MemoryStore(), store, policy)
    await asyncio.to_thread(rt.run, run_id)


class WorkerSettings:
    functions = [studio_pipeline_run, agent_run_execute]
    redis_settings = RedisSettings.from_dsn(
        os.getenv("REDIS_URL", "redis://localhost:6379")
    )
    max_jobs = 10
    job_timeout = 3600  # 60 min — local LLMs on CPU can be slow
