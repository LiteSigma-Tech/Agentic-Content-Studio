"""Media providers (image / video / TTS / music).

There is no single unified gateway for media like there is for LLMs, so each
modality has a thin HTTP adapter (ComfyUI in API mode is the open backend) plus
a dependency-free mock that produces a tiny real file on disk so the whole
pipeline runs offline.

`est_cost_usd = 0.0` marks free/open/self-hosted models; the cost policy uses
this to enforce "free-only" routing.
"""
from __future__ import annotations

import json
import uuid
from pathlib import Path

import httpx

from ..errors import ProviderError
from ..interfaces import Cap, MediaAsset

_OUT = Path("/tmp/gateway_media")
_OUT.mkdir(parents=True, exist_ok=True)


def _stub_file(suffix: str, payload: bytes) -> str:
    p = _OUT / f"{uuid.uuid4().hex}{suffix}"
    p.write_bytes(payload)
    return str(p)


# 1x1 transparent PNG so mock image output is a genuinely valid file.
_PNG_1x1 = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4"
    "890000000a49444154789c6360000002000154a24f5f0000000049454e44ae42"
    "6082"
)


class _HttpMedia:
    """Shared ComfyUI/HTTP adapter base. Real calls hit a self-hosted endpoint;
    on any failure raise ProviderError so the router falls through."""

    def __init__(self, model_id, endpoint, capabilities, est_cost_usd=0.0,
                 est_latency_s=20.0, quality=5):
        self.model_id = model_id
        self.endpoint = endpoint
        self.capabilities = set(capabilities)
        self.est_cost_usd = est_cost_usd
        self.est_latency_s = est_latency_s
        self.quality = quality

    def _post(self, payload: dict) -> dict:
        try:
            r = httpx.post(self.endpoint, json=payload, timeout=self.est_latency_s * 3)
            r.raise_for_status()
            return r.json()
        except Exception as e:
            raise ProviderError(f"{self.model_id} backend failed: {e}") from e


# --- IMAGE ------------------------------------------------------------------
class ComfyUIImageProvider(_HttpMedia):
    def generate(self, prompt, *, width=1024, height=576) -> MediaAsset:
        data = self._post({"prompt": prompt, "width": width, "height": height})
        return MediaAsset(uri=data["uri"], mime="image/png", model_id=self.model_id,
                          cost_usd=self.est_cost_usd)


class MockImageProvider:
    def __init__(self, model_id="mock/image"):
        self.model_id = model_id
        self.capabilities: set[str] = {Cap.MODERATION_OK}
        self.est_cost_usd = 0.0
        self.est_latency_s = 0.05
        self.quality = 1

    def generate(self, prompt, *, width=1024, height=576) -> MediaAsset:
        uri = _stub_file(".png", _PNG_1x1)
        return MediaAsset(uri=uri, mime="image/png", model_id=self.model_id,
                          meta={"prompt": prompt, "w": width, "h": height})


# --- VIDEO ------------------------------------------------------------------
class ComfyUIVideoProvider(_HttpMedia):
    def generate(self, prompt, *, seconds=5.0, fps=24, init_image=None) -> MediaAsset:
        data = self._post({"prompt": prompt, "seconds": seconds, "fps": fps,
                           "init_image": init_image})
        return MediaAsset(uri=data["uri"], mime="video/mp4", model_id=self.model_id,
                          cost_usd=self.est_cost_usd)


class MockVideoProvider:
    def __init__(self, model_id="mock/video"):
        self.model_id = model_id
        self.capabilities = {Cap.IMAGE_INIT, Cap.MODERATION_OK}
        self.est_cost_usd = 0.0
        self.est_latency_s = 0.1
        self.quality = 1

    def generate(self, prompt, *, seconds=5.0, fps=24, init_image=None) -> MediaAsset:
        uri = _stub_file(".json", json.dumps(
            {"mock_video": True, "prompt": prompt, "seconds": seconds}).encode())
        return MediaAsset(uri=uri, mime="video/mp4", model_id=self.model_id,
                          meta={"seconds": seconds, "fps": fps})


# --- TTS --------------------------------------------------------------------
class HttpTTSProvider(_HttpMedia):
    def synthesize(self, text, *, voice_id="default") -> MediaAsset:
        data = self._post({"text": text, "voice_id": voice_id})
        return MediaAsset(uri=data["uri"], mime="audio/wav", model_id=self.model_id,
                          cost_usd=self.est_cost_usd)


class MockTTSProvider:
    def __init__(self, model_id="mock/tts"):
        self.model_id = model_id
        self.capabilities = {Cap.MULTI_SPEAKER, Cap.MODERATION_OK}
        self.est_cost_usd = 0.0
        self.est_latency_s = 0.05
        self.quality = 1

    def synthesize(self, text, *, voice_id="default") -> MediaAsset:
        uri = _stub_file(".txt", text.encode())
        return MediaAsset(uri=uri, mime="audio/wav", model_id=self.model_id,
                          meta={"voice_id": voice_id, "chars": len(text)})


# --- MUSIC ------------------------------------------------------------------
class HttpMusicProvider(_HttpMedia):
    def generate(self, prompt, *, seconds=15.0) -> MediaAsset:
        data = self._post({"prompt": prompt, "seconds": seconds})
        return MediaAsset(uri=data["uri"], mime="audio/wav", model_id=self.model_id,
                          cost_usd=self.est_cost_usd)


class MockMusicProvider:
    def __init__(self, model_id="mock/music"):
        self.model_id = model_id
        self.capabilities: set[str] = {Cap.MODERATION_OK}
        self.est_cost_usd = 0.0
        self.est_latency_s = 0.05
        self.quality = 1

    def generate(self, prompt, *, seconds=15.0) -> MediaAsset:
        uri = _stub_file(".txt", prompt.encode())
        return MediaAsset(uri=uri, mime="audio/wav", model_id=self.model_id,
                          meta={"seconds": seconds})
