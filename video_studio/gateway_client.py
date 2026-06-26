"""Adapter the pipeline uses to call the Model Gateway (previous slice).

Two implementations behind one interface:
  - InProcessGateway: imports the gateway's Router directly (monorepo, tests, CI).
  - HttpGateway: calls the running FastAPI gateway over HTTP (distributed).

The pipeline only knows this interface, so the gateway can live in-process or as
a separate service without changing a line of pipeline code.
"""
from __future__ import annotations

import sys
from dataclasses import dataclass
from pathlib import Path

# Make the sibling `model_gateway` package importable (monorepo layout).
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from model_gateway import (  # noqa: E402
    ConfigStore, LLMMessage, Router, build_registry,
)


@dataclass
class GenResult:
    text: str = ""
    uri: str = ""
    model_used: str = ""
    cost_usd: float = 0.0


class Gateway:
    def llm(self, task, messages, *, json_mode=False, required_caps=None) -> GenResult: ...
    def image(self, task, prompt, *, width=1024, height=576) -> GenResult: ...
    def video(self, task, prompt, *, seconds=5.0, fps=24, init_image=None,
              required_caps=None) -> GenResult: ...
    def tts(self, task, text, *, voice_id="default", required_caps=None) -> GenResult: ...
    def music(self, task, prompt, *, seconds=15.0, required_caps=None) -> GenResult: ...


class InProcessGateway(Gateway):
    def __init__(self, routing_yaml: str | Path):
        self.registry = build_registry()
        self.store = ConfigStore.from_yaml(routing_yaml)
        self.router = Router(self.registry, self.store)

    def llm(self, task, messages, *, json_mode=False, required_caps=None) -> GenResult:
        msgs = [LLMMessage(role=m["role"], content=m["content"]) for m in messages]
        out = self.router.execute(
            "llm", task, lambda p: p.generate(msgs, json_mode=json_mode),
            required_caps=set(required_caps or []))
        return GenResult(text=out.result.text, model_used=out.model_id,
                         cost_usd=out.cost_usd)

    def image(self, task, prompt, *, width=1024, height=576) -> GenResult:
        out = self.router.execute(
            "image", task, lambda p: p.generate(prompt, width=width, height=height))
        return GenResult(uri=out.result.uri, model_used=out.model_id,
                         cost_usd=out.cost_usd)

    def video(self, task, prompt, *, seconds=5.0, fps=24, init_image=None,
              required_caps=None) -> GenResult:
        out = self.router.execute(
            "video", task,
            lambda p: p.generate(prompt, seconds=seconds, fps=fps, init_image=init_image),
            required_caps=set(required_caps or []))
        return GenResult(uri=out.result.uri, model_used=out.model_id,
                         cost_usd=out.cost_usd)

    def tts(self, task, text, *, voice_id="default", required_caps=None) -> GenResult:
        out = self.router.execute(
            "tts", task, lambda p: p.synthesize(text, voice_id=voice_id),
            required_caps=set(required_caps or []))
        return GenResult(uri=out.result.uri, model_used=out.model_id,
                         cost_usd=out.cost_usd)

    def music(self, task, prompt, *, seconds=15.0, required_caps=None) -> GenResult:
        out = self.router.execute(
            "music", task, lambda p: p.generate(prompt, seconds=seconds),
            required_caps=set(required_caps or []))
        return GenResult(uri=out.result.uri, model_used=out.model_id,
                         cost_usd=out.cost_usd)


class HttpGateway(Gateway):
    def __init__(self, base_url: str = "http://127.0.0.1:8000"):
        import httpx
        self._httpx = httpx
        self.base = base_url.rstrip("/")

    def _post(self, path, payload):
        r = self._httpx.post(f"{self.base}{path}", json=payload, timeout=300)
        r.raise_for_status()
        d = r.json()
        res = d["result"]
        return GenResult(text=res.get("text", ""), uri=res.get("uri", ""),
                         model_used=d["model_used"], cost_usd=d["cost_usd"])

    def llm(self, task, messages, *, json_mode=False, required_caps=None):
        return self._post("/v1/llm", {"task": task, "messages": messages,
                                      "json_mode": json_mode})

    def image(self, task, prompt, *, width=1024, height=576):
        return self._post("/v1/image", {"task": task, "prompt": prompt,
                                        "width": width, "height": height})

    def video(self, task, prompt, *, seconds=5.0, fps=24, init_image=None,
              required_caps=None):
        return self._post("/v1/video", {"task": task, "prompt": prompt,
                                        "seconds": seconds, "fps": fps})

    def tts(self, task, text, *, voice_id="default", required_caps=None):
        return self._post("/v1/tts", {"task": task, "text": text, "voice_id": voice_id})

    def music(self, task, prompt, *, seconds=15.0, required_caps=None):
        return self._post("/v1/music", {"task": task, "prompt": prompt, "seconds": seconds})
