"""FastAPI surface for the full studio (video + audio).

  POST /v1/projects            -> create (concept + genre)
  POST /v1/projects/{id}/run   -> run/resume the full 11-stage pipeline
  GET  /v1/projects/{id}       -> status: per-stage progress, cost, all output uris
  GET  /healthz

Same contract as the video studio API but runs the composed pipeline whose
final deliverable is `final_av_uri` (video + synced, mixed audio).
"""
from __future__ import annotations

import os
from pathlib import Path

from fastapi import BackgroundTasks, FastAPI, HTTPException
from pydantic import BaseModel

from video_studio.gateway_client import HttpGateway, InProcessGateway
from video_studio.models import Genre
from video_studio.pipeline import create_project
from video_studio.store import ProjectStore

from .pipeline import full_pipeline

_ROUTING = os.getenv("ROUTING_CONFIG",
                     str(Path(__file__).resolve().parent.parent / "routing.yaml"))

app = FastAPI(title="Studio (Video + Audio)", version="0.1.0")
store = ProjectStore(os.getenv("STUDIO_ROOT", "/tmp/video_studio"))
gateway = (HttpGateway(os.environ["GATEWAY_URL"]) if os.getenv("GATEWAY_URL")
           else InProcessGateway(_ROUTING))
pipeline = full_pipeline(gateway, store)


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
def run(project_id: str, req: RunReq, bg: BackgroundTasks):
    if not store.exists(project_id):
        raise HTTPException(404, "project not found")
    if req.background:
        bg.add_task(pipeline.run, project_id, force_from=req.force_from)
        return {"status": "started", "id": project_id}
    try:
        pipeline.run(project_id, force_from=req.force_from)
    except Exception as e:  # noqa: BLE001
        return {"status": "failed", "error": str(e), **pipeline.status(project_id)}
    return pipeline.status(project_id)


@app.get("/v1/projects/{project_id}")
def status(project_id: str):
    if not store.exists(project_id):
        raise HTTPException(404, "project not found")
    return pipeline.status(project_id)


@app.get("/healthz")
def healthz():
    return {"status": "ok"}
