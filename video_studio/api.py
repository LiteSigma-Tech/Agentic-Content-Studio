"""FastAPI surface for the Video Studio.

  POST /v1/projects            -> create a project (concept + genre)
  POST /v1/projects/{id}/run   -> run (or resume) the pipeline
  GET  /v1/projects/{id}       -> status: per-stage progress, cost, output uris
  GET  /v1/media               -> serve a media file by path
  GET  /v1/projects/{id}/video -> serve the final video for a project
  GET  /healthz

Uses the in-process gateway by default (set GATEWAY_URL to call a remote
gateway over HTTP instead).
"""
from __future__ import annotations

import mimetypes
import os
from pathlib import Path

from fastapi import BackgroundTasks, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from .gateway_client import HttpGateway, InProcessGateway
from .models import Genre
from .pipeline import Pipeline, create_project
from .store import ProjectStore

_ROUTING = os.getenv("ROUTING_CONFIG",
                     str(Path(__file__).resolve().parent.parent / "routing.yaml"))

app = FastAPI(title="Video Studio", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_ALLOWED_ROOTS = [
    Path("/tmp/gateway_media"),
    Path("/tmp/video_studio"),
]
store = ProjectStore(os.getenv("STUDIO_ROOT", "/tmp/video_studio"))
gateway = (HttpGateway(os.environ["GATEWAY_URL"]) if os.getenv("GATEWAY_URL")
           else InProcessGateway(_ROUTING))
pipeline = Pipeline(gateway, store)


class CreateReq(BaseModel):
    concept: str
    genre: Genre
    title: str = ""
    review_mode: bool = False


class RunReq(BaseModel):
    force_from: str | None = None
    background: bool = False


class ApproveReq(BaseModel):
    note: str = ""
    background: bool = False


class RejectReq(BaseModel):
    prompt_override: str = ""
    note: str = ""
    background: bool = False


@app.post("/v1/projects")
def create(req: CreateReq):
    p = create_project(req.concept, req.genre, req.title,
                       store=store, review_mode=req.review_mode)
    return {"id": p.id, "title": p.title, "genre": p.genre.value,
            "review_mode": p.review_mode}


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


@app.post("/v1/projects/{project_id}/stages/{stage_name}/approve")
def approve_stage(project_id: str, stage_name: str, req: ApproveReq,
                  bg: BackgroundTasks):
    if not store.exists(project_id):
        raise HTTPException(404, "project not found")
    try:
        pipeline.approve_stage(project_id, stage_name, note=req.note)
    except ValueError as e:
        raise HTTPException(400, str(e))
    if req.background:
        bg.add_task(pipeline.run, project_id)
        return {"status": "approved_running", "id": project_id}
    try:
        pipeline.run(project_id)
    except Exception as e:  # noqa: BLE001
        return {"status": "failed", "error": str(e), **pipeline.status(project_id)}
    return pipeline.status(project_id)


@app.post("/v1/projects/{project_id}/stages/{stage_name}/reject")
def reject_stage(project_id: str, stage_name: str, req: RejectReq,
                 bg: BackgroundTasks):
    if not store.exists(project_id):
        raise HTTPException(404, "project not found")
    try:
        pipeline.reject_stage(project_id, stage_name,
                              prompt_override=req.prompt_override, note=req.note)
    except ValueError as e:
        raise HTTPException(400, str(e))
    if req.background:
        bg.add_task(pipeline.run, project_id)
        return {"status": "rejected_rerunning", "id": project_id}
    try:
        pipeline.run(project_id)
    except Exception as e:  # noqa: BLE001
        return {"status": "failed", "error": str(e), **pipeline.status(project_id)}
    return pipeline.status(project_id)


@app.get("/v1/projects/{project_id}")
def status(project_id: str):
    if not store.exists(project_id):
        raise HTTPException(404, "project not found")
    return pipeline.status(project_id)


@app.get("/v1/media")
def serve_media(path: str = Query(...)):
    resolved = Path(path).resolve()
    allowed = any(
        resolved.is_relative_to(root.resolve()) for root in _ALLOWED_ROOTS
    )
    if not allowed:
        raise HTTPException(403, "path not allowed")
    if not resolved.exists():
        raise HTTPException(404, "file not found")
    mime, _ = mimetypes.guess_type(str(resolved))
    return FileResponse(str(resolved), media_type=mime or "application/octet-stream")


@app.get("/v1/projects/{project_id}/video")
def project_video(project_id: str):
    if not store.exists(project_id):
        raise HTTPException(404, "project not found")
    proj_status = pipeline.status(project_id)
    video_path = proj_status.get("final_av_uri") or proj_status.get("final_uri")
    if not video_path:
        raise HTTPException(404, "no video available yet")
    resolved = Path(video_path).resolve()
    if not resolved.exists():
        raise HTTPException(404, "video file not found on disk")
    mime, _ = mimetypes.guess_type(str(resolved))
    return FileResponse(str(resolved), media_type=mime or "video/mp4")


@app.get("/healthz")
def healthz():
    return {"status": "ok"}
