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
    def generate(self, prompt, *, width=1024, height=576, init_image=None) -> MediaAsset:
        data = self._post({"prompt": prompt, "width": width, "height": height,
                           "init_image": init_image})
        return MediaAsset(uri=data["uri"], mime="image/png", model_id=self.model_id,
                          cost_usd=self.est_cost_usd)


class MockImageProvider:
    def __init__(self, model_id="mock/image"):
        self.model_id = model_id
        self.capabilities: set[str] = {Cap.MODERATION_OK}
        self.est_cost_usd = 0.0
        self.est_latency_s = 0.05
        self.quality = 1

    def generate(self, prompt, *, width=1024, height=576, init_image=None) -> MediaAsset:
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


# --- DEEPGRAM TTS (free tier, $200 credit) -----------------------------------

class DeepgramTTSProvider:
    """Deepgram Aura TTS — high-quality, low-latency, generous free tier.

    Voices: aura-2-thalia-en (F), aura-2-orion-en (M), aura-2-luna-en (F),
            aura-2-arcas-en (M). Pass voice name as voice_id.
    """
    _API = "https://api.deepgram.com/v1/speak"
    _VOICE_MAP = {
        # Studio voice IDs (audio_studio/voices.py)
        "vo_warm_f":    "aura-2-thalia-en",
        "vo_deep_m":    "aura-2-orion-en",
        "vo_bright_f":  "aura-2-luna-en",
        "vo_playful_m": "aura-2-arcas-en",
        "vo_narrator":  "aura-2-orion-en",
        # Generic aliases and default
        "default":      "aura-2-thalia-en",
        "female":       "aura-2-thalia-en",
        "male":         "aura-2-orion-en",
        "af_bella":     "aura-2-thalia-en",
        "af_heart":     "aura-2-luna-en",
    }

    def __init__(self, token: str):
        self.model_id = "deepgram/aura-2"
        self._token = token
        self.capabilities = {Cap.MULTI_SPEAKER, Cap.MODERATION_OK}
        self.est_cost_usd = 0.0
        self.est_latency_s = 3.0
        self.quality = 8

    _CHUNK = 1900  # Deepgram free-tier limit per request

    def _speak(self, client: httpx.Client, voice: str, text: str) -> bytes:
        r = client.post(
            f"{self._API}?model={voice}",
            json={"text": text},
            headers={"Authorization": f"Token {self._token}",
                     "Content-Type": "application/json"},
        )
        r.raise_for_status()
        return r.content

    def synthesize(self, text, *, voice_id="default") -> MediaAsset:
        # Fall back to the default Deepgram voice for any unrecognised ID
        voice = self._VOICE_MAP.get(voice_id, self._VOICE_MAP["default"])
        try:
            with httpx.Client(timeout=30) as client:
                if len(text) <= self._CHUNK:
                    audio = self._speak(client, voice, text)
                else:
                    # Split on sentence boundaries, stay under the char limit
                    import re
                    sentences = re.split(r'(?<=[.!?])\s+', text)
                    chunks, current = [], ""
                    for s in sentences:
                        if len(current) + len(s) + 1 > self._CHUNK:
                            if current:
                                chunks.append(current.strip())
                            current = s
                        else:
                            current = (current + " " + s).strip()
                    if current:
                        chunks.append(current)
                    audio = b"".join(self._speak(client, voice, c) for c in chunks)
            uri = _stub_file(".mp3", audio)
            return MediaAsset(uri=uri, mime="audio/mpeg", model_id=self.model_id,
                              cost_usd=self.est_cost_usd)
        except Exception as e:
            from ..errors import ProviderError
            raise ProviderError(f"Deepgram TTS failed: {e}") from e


# --- HUGGING FACE INFERENCE API (free tier) ----------------------------------

class _HuggingFaceBase:
    """Shared base for HF Inference API providers.

    Returns binary content directly — image, audio, etc.
    Handles 503 model-loading responses with automatic retry.
    """
    _API = "https://router.huggingface.co/hf-inference/models"

    def __init__(self, model_id: str, hf_model: str, token: str,
                 capabilities, est_cost_usd: float, est_latency_s: float,
                 quality: int):
        self.model_id = model_id
        self._hf_model = hf_model
        self._token = token
        self.capabilities = set(capabilities)
        self.est_cost_usd = est_cost_usd
        self.est_latency_s = est_latency_s
        self.quality = quality

    def _call(self, payload: dict, suffix: str, timeout: float = 120) -> str:
        import time
        url = f"{self._API}/{self._hf_model}"
        headers = {"Authorization": f"Bearer {self._token}",
                   "Content-Type": "application/json"}
        try:
            with httpx.Client(timeout=timeout) as client:
                for attempt in range(3):
                    r = client.post(url, json=payload, headers=headers)
                    if r.status_code == 503:
                        # Model is loading — wait and retry
                        wait = r.json().get("estimated_time", 20)
                        time.sleep(min(wait, 30))
                        continue
                    if r.status_code != 200:
                        raise ProviderError(
                            f"{self.model_id} HF API error {r.status_code}: {r.text[:200]}")
                    return _stub_file(suffix, r.content)
                raise ProviderError(f"{self.model_id}: model still loading after retries")
        except ProviderError:
            raise
        except Exception as e:
            raise ProviderError(f"{self.model_id} call failed: {e}") from e


class HuggingFaceImageProvider(_HuggingFaceBase):
    def generate(self, prompt, *, width=1024, height=576, init_image=None) -> MediaAsset:
        uri = self._call({"inputs": prompt}, ".png")
        return MediaAsset(uri=uri, mime="image/png", model_id=self.model_id,
                          cost_usd=self.est_cost_usd)


class HuggingFaceTTSProvider(_HuggingFaceBase):
    def synthesize(self, text, *, voice_id="default") -> MediaAsset:
        uri = self._call({"inputs": text}, ".wav")
        return MediaAsset(uri=uri, mime="audio/wav", model_id=self.model_id,
                          cost_usd=self.est_cost_usd)


class HuggingFaceMusicProvider(_HuggingFaceBase):
    def generate(self, prompt, *, seconds=15.0) -> MediaAsset:
        uri = self._call({"inputs": prompt}, ".wav")
        return MediaAsset(uri=uri, mime="audio/wav", model_id=self.model_id,
                          cost_usd=self.est_cost_usd)


# --- REPLICATE (hosted, pay-per-run) ----------------------------------------

class _ReplicateBase:
    """Shared base for all Replicate-hosted media providers.

    Uses `Prefer: wait=55` for a synchronous response when the model is fast.
    Falls back to polling for slower models (video generation etc.).
    """
    _API = "https://api.replicate.com/v1"

    def __init__(self, model_id: str, owner_model: str, token: str,
                 capabilities, est_cost_usd: float, est_latency_s: float,
                 quality: int, version: str | None = None):
        self.model_id = model_id
        self._owner_model = owner_model   # "owner/model-name" slug on Replicate
        self._version = version           # specific version ID for community models
        self._token = token
        self.capabilities = set(capabilities)
        self.est_cost_usd = est_cost_usd
        self.est_latency_s = est_latency_s
        self.quality = quality

    def _headers(self) -> dict:
        return {"Authorization": f"Bearer {self._token}",
                "Content-Type": "application/json",
                "Prefer": "wait=55"}

    def _run(self, input_data: dict, timeout: float = 300):
        """Submit a prediction and return the output value (URL or list)."""
        import time
        # Community models need the versioned endpoint; official models use the
        # model-based endpoint.
        if self._version:
            url = f"{self._API}/predictions"
            body = {"version": self._version, "input": input_data}
        else:
            url = f"{self._API}/models/{self._owner_model}/predictions"
            body = {"input": input_data}
        try:
            with httpx.Client(timeout=timeout) as client:
                # Retry up to 4 times on 429 rate-limit with exponential backoff
                for attempt in range(6):
                    r = client.post(url, json=body, headers=self._headers())
                    if r.status_code == 429:
                        if attempt < 5:
                            wait = 15 * (2 ** attempt)  # 15s, 30s, 60s, 120s, 240s
                            time.sleep(min(wait, 300))
                            continue
                        raise ProviderError(
                            f"Replicate rate-limited after retries: {r.text[:200]}")
                    break
                # 200/201 = created (may include result if Prefer:wait honoured)
                # 202 = accepted and queued — poll for result
                if r.status_code not in (200, 201, 202):
                    raise ProviderError(
                        f"Replicate submit failed ({r.status_code}): {r.text[:300]}")
                pred = r.json()
                # Poll if not complete yet (model took > 55s to start)
                if pred.get("status") not in ("succeeded", "failed", "canceled"):
                    get_url = pred["urls"]["get"]
                    deadline = time.time() + timeout
                    while time.time() < deadline:
                        time.sleep(3)
                        rp = client.get(get_url,
                                        headers={"Authorization": f"Bearer {self._token}"})
                        pred = rp.json()
                        if pred["status"] in ("succeeded", "failed", "canceled"):
                            break
                    else:
                        raise ProviderError(f"{self.model_id}: prediction timed out")
                if pred.get("status") != "succeeded":
                    raise ProviderError(
                        f"{self.model_id} prediction failed: {pred.get('error')}")
                return pred["output"]
        except ProviderError:
            raise
        except Exception as e:
            raise ProviderError(f"{self.model_id} call failed: {e}") from e

    def _fetch(self, url_or_list, suffix: str) -> str:
        """Download the output URL to a local file and return the path."""
        url = url_or_list[0] if isinstance(url_or_list, list) else url_or_list
        try:
            with httpx.Client(timeout=120) as client:
                r = client.get(url, headers={"Authorization": f"Bearer {self._token}"})
                r.raise_for_status()
            return _stub_file(suffix, r.content)
        except Exception as e:
            raise ProviderError(f"{self.model_id}: download failed: {e}") from e


class ReplicateImageProvider(_ReplicateBase):
    def generate(self, prompt, *, width=1024, height=576, init_image=None) -> MediaAsset:
        input_data = {"prompt": prompt, "num_outputs": 1, "width": width, "height": height}
        if init_image:
            input_data["image"] = init_image   # flux-schnell img2img input
        out = self._run(input_data, timeout=120)
        uri = self._fetch(out, ".png")
        return MediaAsset(uri=uri, mime="image/png", model_id=self.model_id,
                          cost_usd=self.est_cost_usd)


class ReplicateVideoProvider(_ReplicateBase):
    def generate(self, prompt, *, seconds=5.0, fps=8,
                 init_image=None) -> MediaAsset:
        # lucataco/animate-diff: prompt + style checkpoint
        inp: dict = {
            "prompt": prompt,
            "path": "toonyou_beta3.safetensors",
        }
        out = self._run(inp, timeout=300)
        uri = self._fetch(out, ".mp4")
        return MediaAsset(uri=uri, mime="video/mp4", model_id=self.model_id,
                          cost_usd=self.est_cost_usd)


class ReplicateTTSProvider(_ReplicateBase):
    def synthesize(self, text, *, voice_id="af_bella") -> MediaAsset:
        # Map generic "default" to a valid Kokoro voice
        voice = voice_id if voice_id != "default" else "af_bella"
        out = self._run({"text": text, "voice": voice, "speed": 1}, timeout=120)
        uri = self._fetch(out, ".wav")
        return MediaAsset(uri=uri, mime="audio/wav", model_id=self.model_id,
                          cost_usd=self.est_cost_usd)


class ReplicateMusicProvider(_ReplicateBase):
    def generate(self, prompt, *, seconds=15.0) -> MediaAsset:
        out = self._run({
            "prompt": prompt,
            "model_version": "stereo-melody-large",
            "duration": max(1, int(seconds)),
            "output_format": "wav",
        }, timeout=180)
        uri = self._fetch(out, ".wav")
        return MediaAsset(uri=uri, mime="audio/wav", model_id=self.model_id,
                          cost_usd=self.est_cost_usd)


class KlingVideoProvider(_ReplicateBase):
    """Kling 1.6 via Replicate — strong motion coherence, mid-tier quality."""
    def generate(self, prompt, *, seconds=5.0, fps=24, init_image=None) -> MediaAsset:
        inp: dict = {
            "prompt": prompt,
            "duration": "10" if seconds > 7 else "5",
            "aspect_ratio": "16:9",
            "mode": "standard",
        }
        if init_image:
            inp["start_image"] = init_image
        out = self._run(inp, timeout=360)
        uri = self._fetch(out, ".mp4")
        return MediaAsset(uri=uri, mime="video/mp4", model_id=self.model_id,
                          cost_usd=self.est_cost_usd)


class HunyuanVideoProvider(_ReplicateBase):
    """Hunyuan Video via Replicate — high-quality open model from Tencent."""
    def generate(self, prompt, *, seconds=5.0, fps=24, init_image=None) -> MediaAsset:
        # ~24 fps; clamp to the model's supported frame range
        frames = min(129, max(45, int(seconds * 24)))
        out = self._run({
            "prompt": prompt,
            "resolution": "544p",
            "num_frames": frames,
            "flow_shift": 7.0,
            "embedded_guidance_scale": 6.0,
        }, timeout=600)
        uri = self._fetch(out, ".mp4")
        return MediaAsset(uri=uri, mime="video/mp4", model_id=self.model_id,
                          cost_usd=self.est_cost_usd)


class MochiVideoProvider(_ReplicateBase):
    """Genmo Mochi-1 via Replicate — creative, fluid motion."""
    def generate(self, prompt, *, seconds=5.0, fps=24, init_image=None) -> MediaAsset:
        out = self._run({"prompt": prompt}, timeout=360)
        uri = self._fetch(out, ".mp4")
        return MediaAsset(uri=uri, mime="video/mp4", model_id=self.model_id,
                          cost_usd=self.est_cost_usd)


# --- RUNWAY ML (production-grade, text-to-video) -----------------------------

class RunwayMLVideoProvider:
    """Runway Gen-4 Turbo — best-in-class motion quality, async polling."""
    _API = "https://api.runwayml.com/v1"

    def __init__(self, token: str, model: str = "gen4_turbo"):
        self.model_id = f"runway/{model}"
        self._token = token
        self._model = model
        self.capabilities = {Cap.IMAGE_INIT, Cap.MODERATION_OK}
        self.est_cost_usd = 0.05
        self.est_latency_s = 40.0
        self.quality = 9

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self._token}",
            "X-Runway-Version": "2024-11-06",
            "Content-Type": "application/json",
        }

    def generate(self, prompt, *, seconds=5.0, fps=24, init_image=None) -> MediaAsset:
        import time
        duration = 10 if seconds > 7 else 5
        body: dict = {
            "promptText": prompt,
            "model": self._model,
            "ratio": "1280:768",
            "duration": duration,
        }
        if init_image:
            body["promptImage"] = [{"uri": init_image, "position": "first"}]
        try:
            with httpx.Client(timeout=60) as client:
                r = client.post(f"{self._API}/text_to_video", json=body,
                                headers=self._headers())
                r.raise_for_status()
                task_id = r.json()["id"]
                deadline = time.time() + 360
                while time.time() < deadline:
                    time.sleep(6)
                    r = client.get(f"{self._API}/tasks/{task_id}",
                                   headers=self._headers())
                    r.raise_for_status()
                    task = r.json()
                    if task["status"] == "SUCCEEDED":
                        video_url = task["output"][0]
                        video = client.get(video_url).content
                        return MediaAsset(uri=_stub_file(".mp4", video),
                                          mime="video/mp4", model_id=self.model_id,
                                          cost_usd=self.est_cost_usd)
                    if task["status"] in ("FAILED", "CANCELLED"):
                        raise ProviderError(
                            f"Runway task failed: {task.get('failure', 'unknown')}")
                raise ProviderError(f"Runway task {task_id} timed out")
        except ProviderError:
            raise
        except Exception as e:
            raise ProviderError(f"Runway call failed: {e}") from e


# --- LUMA DREAM MACHINE (cinematic quality, async polling) -------------------

class LumaVideoProvider:
    """Luma Dream Machine — cinematic quality, strong scene understanding."""
    _API = "https://api.lumaai.com/dream-machine/v1"

    def __init__(self, token: str):
        self.model_id = "luma/dream-machine"
        self._token = token
        self.capabilities = {Cap.IMAGE_INIT, Cap.MODERATION_OK}
        self.est_cost_usd = 0.03
        self.est_latency_s = 90.0
        self.quality = 8

    def _headers(self) -> dict:
        return {"Authorization": f"Bearer {self._token}",
                "Content-Type": "application/json"}

    def generate(self, prompt, *, seconds=5.0, fps=24, init_image=None) -> MediaAsset:
        import time
        body: dict = {"prompt": prompt, "aspect_ratio": "16:9", "loop": False}
        if init_image:
            body["keyframes"] = {"frame0": {"type": "image", "url": init_image}}
        try:
            with httpx.Client(timeout=120) as client:
                r = client.post(f"{self._API}/generations", json=body,
                                headers=self._headers())
                r.raise_for_status()
                gen_id = r.json()["id"]
                deadline = time.time() + 360
                while time.time() < deadline:
                    time.sleep(8)
                    r = client.get(f"{self._API}/generations/{gen_id}",
                                   headers=self._headers())
                    r.raise_for_status()
                    gen = r.json()
                    if gen["state"] == "completed":
                        video_url = gen["assets"]["video"]
                        video = client.get(video_url).content
                        return MediaAsset(uri=_stub_file(".mp4", video),
                                          mime="video/mp4", model_id=self.model_id,
                                          cost_usd=self.est_cost_usd)
                    if gen["state"] == "failed":
                        raise ProviderError(
                            f"Luma generation failed: {gen.get('failure_reason', 'unknown')}")
                raise ProviderError(f"Luma generation {gen_id} timed out")
        except ProviderError:
            raise
        except Exception as e:
            raise ProviderError(f"Luma call failed: {e}") from e
