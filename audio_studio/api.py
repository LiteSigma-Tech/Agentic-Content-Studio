"""FastAPI surface for the full studio (video + audio).

  POST /v1/projects            -> create (concept + genre)
  POST /v1/projects/{id}/run   -> run/resume the full 11-stage pipeline
  GET  /v1/projects            -> list project summaries (paginated)
  GET  /v1/projects/{id}       -> status: per-stage progress, cost, all output uris
  GET  /healthz

Same contract as the video studio API but runs the composed pipeline whose
final deliverable is `final_av_uri` (video + synced, mixed audio).
"""
from __future__ import annotations

import asyncio
import os
from pathlib import Path

from fastapi import BackgroundTasks, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from video_studio.gateway_client import HttpGateway, InProcessGateway
from video_studio.models import Genre
from video_studio.pipeline import create_project
from video_studio.store import ProjectStore

from .pipeline import full_pipeline

_ROUTING = os.getenv("ROUTING_CONFIG",
                     str(Path(__file__).resolve().parent.parent / "routing.yaml"))

app = FastAPI(title="Studio (Video + Audio)", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173,http://localhost:5174").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

store = ProjectStore(os.getenv("STUDIO_ROOT", "/tmp/video_studio"))
gateway = (HttpGateway(os.environ["GATEWAY_URL"]) if os.getenv("GATEWAY_URL")
           else InProcessGateway(_ROUTING))
pipeline = full_pipeline(gateway, store)

try:
    from shared.metrics import add_metrics_endpoint
    add_metrics_endpoint(app, "studio")
except Exception:
    pass


@app.on_event("startup")
async def _startup():
    try:
        from shared.logging_config import configure_logging
        configure_logging()
    except Exception:
        pass


class CreateReq(BaseModel):
    concept: str
    genre: Genre
    title: str = ""


class RunReq(BaseModel):
    force_from: str | None = None
    background: bool = False


@app.post("/v1/projects")
def create(req: CreateReq):
    p = create_project(req.concept, req.genre, req.title, store=store)
    return {"id": p.id, "title": p.title, "genre": p.genre.value}


@app.post("/v1/projects/{project_id}/run")
async def run(project_id: str, req: RunReq, bg: BackgroundTasks):
    if not store.exists(project_id):
        raise HTTPException(404, "project not found")
    if req.background:
        redis_url = os.getenv("REDIS_URL")
        if redis_url:
            try:
                from arq import create_pool
                from arq.connections import RedisSettings
                pool = await create_pool(RedisSettings.from_dsn(redis_url))
                job = await pool.enqueue_job(
                    "studio_pipeline_run", project_id, force_from=req.force_from)
                await pool.aclose()
                return {"status": "queued", "id": project_id, "job_id": job.job_id}
            except Exception:
                pass
        # Fallback to FastAPI BackgroundTasks when Redis is unavailable
        bg.add_task(pipeline.run, project_id, force_from=req.force_from)
        return {"status": "started", "id": project_id}
    try:
        await asyncio.to_thread(pipeline.run, project_id, force_from=req.force_from)
    except Exception as e:  # noqa: BLE001
        return {"status": "failed", "error": str(e), **pipeline.status(project_id)}
    return pipeline.status(project_id)


@app.get("/v1/projects")
async def list_projects(limit: int = Query(50, ge=1, le=500), offset: int = Query(0, ge=0)):
    summaries = await store.alist_projects(limit=limit, offset=offset)
    items = []
    for s in summaries:
        try:
            items.append(pipeline.status(s["id"]))
        except Exception:
            items.append(s)
    return {"items": items, "limit": limit, "offset": offset}


@app.get("/v1/projects/{project_id}")
def status(project_id: str):
    if not store.exists(project_id):
        raise HTTPException(404, "project not found")
    return pipeline.status(project_id)


@app.get("/v1/projects/{project_id}/video")
def get_video(project_id: str):
    """Serve the final rendered video file with range-request support for seeking."""
    if not store.exists(project_id):
        raise HTTPException(404, "project not found")
    s = pipeline.status(project_id)
    # Prefer the muxed A/V file; fall back to silent video
    video_path = s.get("final_av_uri") or s.get("final_uri")
    if not video_path:
        raise HTTPException(404, "video not yet generated")
    p = Path(video_path)
    if not p.exists():
        raise HTTPException(404, "video file not found on disk")
    return FileResponse(str(p), media_type="video/mp4",
                        headers={"Accept-Ranges": "bytes"})


@app.get("/healthz")
def healthz():
    return {"status": "ok"}
