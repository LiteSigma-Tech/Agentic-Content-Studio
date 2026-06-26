"""FastAPI surface for the Model Gateway.

Endpoints:
  POST /v1/llm | /v1/image | /v1/video | /v1/tts | /v1/music   -> generate
  GET  /v1/providers          -> catalogue for the UI model picker
  GET  /v1/config/routing     -> current routing config
  PUT  /v1/config/routing     -> swap models / policy at runtime (no redeploy)
  GET  /healthz
"""
from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from model_gateway import (
    ConfigStore, LLMMessage, NoEligibleProvider, ProviderError, Router,
    RoutingConfig, build_registry,
)

_CFG_PATH = os.getenv("ROUTING_CONFIG", str(Path(__file__).resolve().parent.parent / "routing.yaml"))

app = FastAPI(title="Model Gateway", version="0.1.0")
registry = build_registry()
store = ConfigStore.from_yaml(_CFG_PATH)
router = Router(registry, store)


# --- request models ---------------------------------------------------------
class LLMReq(BaseModel):
    messages: list[dict]
    task: str = "script_writing"
    json_mode: bool = False


class ImageReq(BaseModel):
    prompt: str
    task: str = "default"
    width: int = 1024
    height: int = 576


class VideoReq(BaseModel):
    prompt: str
    task: str = "default"
    seconds: float = 5.0
    fps: int = 24


class TTSReq(BaseModel):
    text: str
    task: str = "default"
    voice_id: str = "default"


class MusicReq(BaseModel):
    prompt: str
    task: str = "default"
    seconds: float = 15.0


def _run(modality, task, call, required_caps=None):
    try:
        out = router.execute(modality, task, call, required_caps=required_caps)
    except NoEligibleProvider as e:
        raise HTTPException(status_code=409, detail=str(e))
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    payload = out.result.__dict__
    return {"model_used": out.model_id, "cost_usd": out.cost_usd,
            "attempts": out.attempts, "result": payload}


# --- generation endpoints ---------------------------------------------------
@app.post("/v1/llm")
def gen_llm(req: LLMReq):
    msgs = [LLMMessage(role=m["role"], content=m["content"]) for m in req.messages]
    return _run("llm", req.task,
                lambda p: p.generate(msgs, json_mode=req.json_mode))


@app.post("/v1/image")
def gen_image(req: ImageReq):
    return _run("image", req.task,
                lambda p: p.generate(req.prompt, width=req.width, height=req.height))


@app.post("/v1/video")
def gen_video(req: VideoReq):
    return _run("video", req.task,
                lambda p: p.generate(req.prompt, seconds=req.seconds, fps=req.fps))


@app.post("/v1/tts")
def gen_tts(req: TTSReq):
    return _run("tts", req.task,
                lambda p: p.synthesize(req.text, voice_id=req.voice_id))


@app.post("/v1/music")
def gen_music(req: MusicReq):
    return _run("music", req.task,
                lambda p: p.generate(req.prompt, seconds=req.seconds))


# --- introspection + runtime switching --------------------------------------
@app.get("/v1/providers")
def providers():
    return registry.describe()


@app.get("/v1/config/routing")
def get_routing():
    return store.get().model_dump()


@app.put("/v1/config/routing")
def put_routing(cfg: RoutingConfig):
    """Replace the live routing config. Next job uses the new selection."""
    store.set(cfg)
    return {"status": "ok", "routing": store.get().model_dump()}


@app.get("/healthz")
def healthz():
    return {"status": "ok", "providers": {m: len(registry.list(m))
            for m in ("llm", "image", "video", "tts", "music")}}
