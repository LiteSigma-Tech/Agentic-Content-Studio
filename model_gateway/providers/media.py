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
                # Pre-signed URLs (S3/R2) carry auth in query params — adding an
                # Authorization header causes a 400 signature conflict.
                r = client.get(url, timeout=120)
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


class MiniMaxVideoProvider(_ReplicateBase):
    """MiniMax (Hailuo) video-01 via Replicate — photorealistic T2V, 5-6 s clips."""
    def generate(self, prompt, *, seconds=5.0, fps=24, init_image=None) -> MediaAsset:
        # minimax/video-01 only supports 5 or 6 second durations
        duration = 6 if seconds >= 6 else 5
        inp: dict = {"prompt": prompt, "duration": duration}
        # 240s (4 min) timeout — typical minimax runs finish in 2-3 min;
        # failing fast lets the router fall through to mock/video rather than blocking.
        out = self._run(inp, timeout=240)
        uri = self._fetch(out, ".mp4")
        return MediaAsset(uri=uri, mime="video/mp4", model_id=self.model_id,
                          cost_usd=self.est_cost_usd)


# --- COMFYUI FLUX.1-dev-fp8 via RunPod Serverless ----------------------------

# Standard FLUX.1-dev-fp8 workflow. Prompt, seed, width and height injected
# per call. Uses the RunPod pre-built ComfyUI worker — no custom Docker build.
_FLUX_WORKFLOW: dict = {
    "6":  {"inputs": {"text": "__PROMPT__", "clip": ["30", 1]},
           "class_type": "CLIPTextEncode"},
    "8":  {"inputs": {"samples": ["31", 0], "vae": ["30", 2]},
           "class_type": "VAEDecode"},
    "9":  {"inputs": {"filename_prefix": "ComfyUI", "images": ["8", 0]},
           "class_type": "SaveImage"},
    "27": {"inputs": {"width": 1024, "height": 1024, "batch_size": 1},
           "class_type": "EmptySD3LatentImage"},
    "30": {"inputs": {"ckpt_name": "flux1-dev-fp8.safetensors"},
           "class_type": "CheckpointLoaderSimple"},
    "31": {"inputs": {"seed": 0, "steps": 20, "cfg": 1,
                      "sampler_name": "euler", "scheduler": "simple",
                      "denoise": 1,
                      "model": ["30", 0], "positive": ["35", 0],
                      "negative": ["33", 0], "latent_image": ["27", 0]},
           "class_type": "KSampler"},
    "33": {"inputs": {"text": "", "clip": ["30", 1]},
           "class_type": "CLIPTextEncode"},
    "35": {"inputs": {"guidance": 3.5, "conditioning": ["6", 0]},
           "class_type": "FluxGuidance"},
}


class RunPodComfyUIImageProvider:
    """FLUX.1-dev-fp8 image generation via the RunPod ComfyUI serverless worker.

    Uses RunPod's pre-built ComfyUI template — no custom Docker build needed.
    Response contains the image as base64; no S3 required.

    Set in .env:
      RUNPOD_COMFYUI_ENDPOINT_ID  — serverless endpoint ID
      RUNPOD_API_KEY               — same key used for the Wan endpoint
    """
    _API = "https://api.runpod.ai/v2"

    def __init__(self, api_key: str, endpoint_id: str):
        self.model_id = "runpod/comfyui-flux"
        self._key = api_key
        self._endpoint = endpoint_id
        self.capabilities = {Cap.MODERATION_OK}
        self.est_cost_usd = 0.004
        self.est_latency_s = 20.0
        self.quality = 9

    def _headers(self) -> dict:
        return {"Authorization": f"Bearer {self._key}",
                "Content-Type": "application/json"}

    def _build_workflow(self, prompt: str, width: int, height: int,
                        has_init: bool) -> dict:
        import copy, random
        wf = copy.deepcopy(_FLUX_WORKFLOW)
        wf["6"]["inputs"]["text"] = prompt
        wf["27"]["inputs"]["width"] = width
        wf["27"]["inputs"]["height"] = height
        wf["31"]["inputs"]["seed"] = random.randint(0, 2 ** 32 - 1)
        if has_init:
            # Add LoadImage + VAEEncode nodes to use init image as latent
            wf["init_load"] = {
                "inputs": {"image": "init.png", "upload": "image"},
                "class_type": "LoadImage",
            }
            wf["init_enc"] = {
                "inputs": {"pixels": ["init_load", 0], "vae": ["30", 2]},
                "class_type": "VAEEncode",
            }
            wf["31"]["inputs"]["latent_image"] = ["init_enc", 0]
            wf["31"]["inputs"]["denoise"] = 0.75
        return wf

    def generate(self, prompt, *, width=1024, height=1024,
                 init_image=None) -> MediaAsset:
        import base64, time

        images_input = []
        if init_image and Path(init_image).exists():
            raw = Path(init_image).read_bytes()
            images_input = [{"name": "init.png",
                              "image": base64.b64encode(raw).decode()}]

        workflow = self._build_workflow(prompt, width, height,
                                        bool(images_input))
        payload: dict = {"input": {"workflow": workflow}}
        if images_input:
            payload["input"]["images"] = images_input

        try:
            with httpx.Client(timeout=30) as client:
                r = client.post(f"{self._API}/{self._endpoint}/run",
                                json=payload, headers=self._headers())
                if r.status_code == 401:
                    raise ProviderError("RunPod ComfyUI: invalid API key")
                if r.status_code not in (200, 201):
                    raise ProviderError(
                        f"RunPod ComfyUI submit failed ({r.status_code}): "
                        f"{r.text[:300]}")
                job_id = r.json().get("id", "")
                if not job_id:
                    raise ProviderError("RunPod ComfyUI: no job ID returned")

                deadline = time.time() + 300
                poll = f"{self._API}/{self._endpoint}/status/{job_id}"
                while time.time() < deadline:
                    time.sleep(3)
                    rp = client.get(poll, headers=self._headers())
                    d = rp.json()
                    status = d.get("status", "")
                    if status == "COMPLETED":
                        out = d.get("output", {})
                        # Handle both response formats:
                        #   {"images": [{"data": "<b64>"}]}  ← RunPod ComfyUI worker
                        #   {"status": "success", "message": "<data:...;base64,b64>"}
                        b64 = None
                        if isinstance(out, dict):
                            images = out.get("images", [])
                            if images and isinstance(images[0], dict):
                                b64 = images[0].get("data", "")
                            if not b64:
                                msg = out.get("message", "")
                                if msg:
                                    b64 = msg.split(",", 1)[-1]
                        if not b64:
                            raise ProviderError(
                                f"RunPod ComfyUI: no image data in output: {str(out)[:200]}")
                        uri = _stub_file(".png", base64.b64decode(b64))
                        return MediaAsset(uri=uri, mime="image/png",
                                          model_id=self.model_id,
                                          cost_usd=self.est_cost_usd)
                    if status in ("FAILED", "ERROR"):
                        raise ProviderError(
                            f"RunPod ComfyUI job failed: {d.get('error', d)}")
                raise ProviderError("RunPod ComfyUI: timed out after 5 min")

        except ProviderError:
            raise
        except Exception as e:
            raise ProviderError(f"RunPod ComfyUI call failed: {e}") from e


# --- WAN 2.2 TI2V-5B — unified provider (Modal or RunPod) -------------------
#
# Switch backends via WAN_BACKEND in .env:
#   WAN_BACKEND=modal    → calls MODAL_ENDPOINT_URL (synchronous web endpoint)
#   WAN_BACKEND=runpod   → submits to RunPod serverless, polls for result
#
# Both backends:
#   - Scale to 0 when idle (GPU off, $0/hr)
#   - Accept keyframe image as init frame (TI2V)
#   - Upload output to S3, return presigned URL
#   - Same input/output contract → swapping backends requires only .env change

class WanVideoProvider:
    """Wan 2.2 TI2V-5B — routes to Modal or RunPod based on WAN_BACKEND env var.

    .env variables:
      WAN_BACKEND             = modal | runpod

      # Modal
      MODAL_ENDPOINT_URL      = https://yourorg--wan-worker-generate.modal.run

      # RunPod
      RUNPOD_API_KEY          = (from runpod.io → Settings → API Keys)
      RUNPOD_WAN_ENDPOINT_ID  = (serverless endpoint ID)

      # Both (S3 for video output)
      S3_BUCKET, S3_PREFIX, S3_URL_EXPIRES, AWS_* — already in .env
    """

    _RUNPOD_API = "https://api.runpod.ai/v2"

    def __init__(self, backend: str, modal_url: str = "",
                 runpod_key: str = "", runpod_endpoint: str = ""):
        self._backend        = backend          # "modal" | "runpod"
        self._modal_url      = modal_url.rstrip("/")
        self._runpod_key     = runpod_key
        self._runpod_ep      = runpod_endpoint
        self.model_id        = f"wan/{backend}"
        self.capabilities    = {Cap.IMAGE_INIT, Cap.MODERATION_OK}
        self.est_cost_usd    = 0.03 if backend == "modal" else 0.02
        self.est_latency_s   = 90.0
        self.quality         = 9

    # ── shared payload builder ────────────────────────────────────────────────
    def _payload(self, prompt: str, seconds: float, init_image) -> dict:
        import base64
        duration = 5 if seconds <= 6 else 8
        # Wan renders floating text overlays (captions, bold on-screen titles)
        # poorly — blurry and misspelled. The render stage handles those separately.
        # We suppress overlay-style text but allow natural scene text (laptop
        # screens, whiteboards, documents) which is part of the visual composition.
        no_text_suffix = (
            ". No floating text overlays, no bold caption cards, "
            "no subtitle bars, no watermarks, no large on-screen titles. "
            "Any screen or document content should appear natural and in context."
        )
        p: dict = {
            "prompt": prompt + no_text_suffix,
            "duration": duration,
            "resolution": "720p",
            "num_inference_steps": 50,
        }
        if init_image and Path(init_image).exists():
            p["init_image_b64"] = base64.b64encode(
                Path(init_image).read_bytes()).decode()
        return p

    # ── download video from S3 presigned URL ──────────────────────────────────
    def _download(self, client: httpx.Client, video_url: str) -> str:
        rv = client.get(video_url, timeout=120, follow_redirects=True)
        rv.raise_for_status()
        return _stub_file(".mp4", rv.content)

    # ── Modal backend — single synchronous POST, gateway waits ───────────────
    def _generate_modal(self, payload: dict) -> str:
        if not self._modal_url:
            raise ProviderError("Wan/Modal: MODAL_ENDPOINT_URL not set")
        with httpx.Client(timeout=600) as client:   # 10 min — covers cold start + inference
            r = client.post(self._modal_url, json=payload)
            if r.status_code == 401:
                raise ProviderError("Wan/Modal: invalid credentials")
            if r.status_code != 200:
                raise ProviderError(
                    f"Wan/Modal failed ({r.status_code}): {r.text[:300]}")
            out = r.json()
            video_url = out.get("video_url", "")
            if not video_url:
                raise ProviderError(f"Wan/Modal: no video_url in response: {out}")
            return self._download(client, video_url)

    # ── RunPod backend — async submit + poll ──────────────────────────────────
    def _generate_runpod(self, payload: dict) -> str:
        import time
        if not self._runpod_key or not self._runpod_ep:
            raise ProviderError("Wan/RunPod: RUNPOD_API_KEY or RUNPOD_WAN_ENDPOINT_ID not set")
        headers = {"Authorization": f"Bearer {self._runpod_key}",
                   "Content-Type": "application/json"}
        # Use separate clients for submit and poll so timeout doesn't
        # apply to the combined cold-start + inference wait (up to 10 min).
        with httpx.Client(timeout=60) as submit_client:
            r = submit_client.post(
                f"{self._RUNPOD_API}/{self._runpod_ep}/run",
                json={"input": payload}, headers=headers)
            if r.status_code == 401:
                raise ProviderError("Wan/RunPod: invalid API key")
            if r.status_code not in (200, 201):
                raise ProviderError(
                    f"Wan/RunPod submit failed ({r.status_code}): {r.text[:300]}")
            job_id = r.json().get("id", "")
            if not job_id:
                raise ProviderError("Wan/RunPod: no job ID returned")

        # Poll with fresh per-request connections — no stale connection issues.
        # 20 min deadline: pipeline load (~2 min) + inference (~8-9 min) + VAE decode (~1 min).
        deadline = time.time() + 1200
        poll = f"{self._RUNPOD_API}/{self._runpod_ep}/status/{job_id}"
        while time.time() < deadline:
            time.sleep(10)
            with httpx.Client(timeout=30) as poll_client:
                rp = poll_client.get(poll, headers=headers)
                d = rp.json()
            status = d.get("status", "")
            elapsed = int(time.time() - (deadline - 600))
            print(f"[wan/runpod] job {job_id[:8]}… status={status} t+{elapsed}s")
            if status == "COMPLETED":
                video_url = d.get("output", {}).get("video_url", "")
                if not video_url:
                    raise ProviderError(
                        f"Wan/RunPod: no video_url in output: {d.get('output')}")
                with httpx.Client(timeout=120) as dl_client:
                    return self._download(dl_client, video_url)
            if status in ("FAILED", "ERROR"):
                raise ProviderError(f"Wan/RunPod job failed: {d.get('error', d)}")
        raise ProviderError("Wan/RunPod: timed out after 10 min")

    # ── public interface ──────────────────────────────────────────────────────
    def generate(self, prompt, *, seconds=5.0, fps=24, init_image=None) -> MediaAsset:
        payload = self._payload(prompt, seconds, init_image)
        try:
            if self._backend == "modal":
                uri = self._generate_modal(payload)
            else:
                uri = self._generate_runpod(payload)
            return MediaAsset(uri=uri, mime="video/mp4",
                              model_id=self.model_id,
                              cost_usd=self.est_cost_usd)
        except ProviderError:
            raise
        except Exception as e:
            raise ProviderError(f"Wan/{self._backend} call failed: {e}") from e


# --- GOOGLE IMAGEN via Gemini API (free tier) --------------------------------

class GeminiImageProvider:
    """Gemini 3.1 image generation — free tier with GEMINI_API_KEY.

    Uses gemini-3.1-flash-image (fast, free) or gemini-3.1-flash-lite-image.
    Returns a JPEG written to /tmp/gateway_media like other image providers.
    """
    _API = "https://generativelanguage.googleapis.com/v1beta"

    def __init__(self, api_key: str, model: str = "gemini-3.1-flash-image"):
        self.model_id = f"google/{model}"
        self._key = api_key
        self._model = model
        self.capabilities = {Cap.MODERATION_OK}
        self.est_cost_usd = 0.0
        self.est_latency_s = 8.0
        self.quality = 8

    def generate(self, prompt, *, width=1024, height=576, init_image=None) -> MediaAsset:
        body: dict = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"responseModalities": ["IMAGE"]},
        }
        # If an init image is provided, include it as context for style consistency
        if init_image and Path(init_image).exists():
            import base64, mimetypes
            mime, _ = mimetypes.guess_type(init_image)
            data = base64.b64encode(Path(init_image).read_bytes()).decode()
            body["contents"][0]["parts"].insert(0, {
                "inlineData": {"mimeType": mime or "image/png", "data": data}
            })
        try:
            with httpx.Client(timeout=60) as client:
                r = client.post(
                    f"{self._API}/models/{self._model}:generateContent",
                    headers={"Content-Type": "application/json",
                             "x-goog-api-key": self._key},
                    json=body)
                if r.status_code == 429:
                    raise ProviderError("Gemini Image: quota exhausted (resets daily)")
                if r.status_code != 200:
                    raise ProviderError(
                        f"Gemini Image failed ({r.status_code}): {r.text[:300]}")
                parts = (r.json().get("candidates", [{}])[0]
                           .get("content", {}).get("parts", []))
                for part in parts:
                    if "inlineData" in part:
                        import base64
                        img_bytes = base64.b64decode(part["inlineData"]["data"])
                        ext = ".jpg" if "jpeg" in part["inlineData"]["mimeType"] else ".png"
                        return MediaAsset(uri=_stub_file(ext, img_bytes),
                                          mime=part["inlineData"]["mimeType"],
                                          model_id=self.model_id, cost_usd=0.0)
                raise ProviderError("Gemini Image: no image in response")
        except ProviderError:
            raise
        except Exception as e:
            raise ProviderError(f"Gemini Image call failed: {e}") from e


# --- HAILUO (MiniMax) DIRECT API --------------------------------------------

class HailuoVideoProvider:
    """MiniMax Hailuo-02 via the minimaxi.chat API — cheaper than Replicate.

    Set MINIMAX_API_KEY in .env (get at platform.minimaxi.chat).
    Pricing: ~$0.04/s → a 6 s clip ≈ $0.24.
    """
    _SUBMIT = "https://api.minimaxi.chat/v1/video_generation"
    _QUERY  = "https://api.minimaxi.chat/v1/query/video_generation"
    _CDN    = "https://api.minimaxi.chat/v1/files/retrieve"

    def __init__(self, api_key: str):
        self.model_id = "minimax/hailuo-02"
        self._key = api_key
        self.capabilities = {Cap.IMAGE_INIT, Cap.MODERATION_OK}
        self.est_cost_usd = 0.24   # 6 s × $0.04/s
        self.est_latency_s = 90.0
        self.quality = 9

    def _headers(self) -> dict:
        return {"Authorization": f"Bearer {self._key}",
                "Content-Type": "application/json"}

    def generate(self, prompt, *, seconds=5.0, fps=24, init_image=None) -> MediaAsset:
        import time
        duration = 10 if seconds > 7 else 6
        body: dict = {
            "model": "video-01",          # Hailuo-02 on their API
            "prompt": prompt,
            "duration": duration,
        }
        if init_image and Path(init_image).exists():
            # Encode local keyframe as base64 for the first-frame init
            import base64, mimetypes
            mime, _ = mimetypes.guess_type(init_image)
            data = base64.b64encode(Path(init_image).read_bytes()).decode()
            body["first_frame_image"] = f"data:{mime or 'image/png'};base64,{data}"

        try:
            with httpx.Client(timeout=30) as client:
                r = client.post(self._SUBMIT, json=body, headers=self._headers())
                if r.status_code == 429:
                    raise ProviderError("Hailuo: rate limited")
                if r.status_code not in (200, 201, 202):
                    raise ProviderError(
                        f"Hailuo submit failed ({r.status_code}): {r.text[:300]}")
                task_id = r.json().get("task_id", "")
                if not task_id:
                    raise ProviderError(f"Hailuo: no task_id in response: {r.text[:200]}")

                # Poll for completion
                deadline = time.time() + 300
                while time.time() < deadline:
                    time.sleep(5)
                    rq = client.get(self._QUERY,
                                    params={"task_id": task_id},
                                    headers=self._headers())
                    d = rq.json()
                    status = d.get("status", "")
                    if status == "Success":
                        file_id = (d.get("file_id") or
                                   d.get("video", {}).get("file_id", ""))
                        video_url = d.get("download_url") or d.get("video", {}).get("url", "")
                        if video_url:
                            rv = client.get(video_url, timeout=120)
                            rv.raise_for_status()
                            return MediaAsset(uri=_stub_file(".mp4", rv.content),
                                              mime="video/mp4", model_id=self.model_id,
                                              cost_usd=self.est_cost_usd)
                        if file_id:
                            rf = client.get(self._CDN,
                                            params={"file_id": file_id},
                                            headers=self._headers())
                            url = rf.json().get("file", {}).get("download_url", "")
                            rv = client.get(url, timeout=120)
                            rv.raise_for_status()
                            return MediaAsset(uri=_stub_file(".mp4", rv.content),
                                              mime="video/mp4", model_id=self.model_id,
                                              cost_usd=self.est_cost_usd)
                        raise ProviderError("Hailuo: success but no video URL")
                    if status in ("Fail", "Failed", "Error"):
                        raise ProviderError(f"Hailuo prediction failed: {d}")
                raise ProviderError("Hailuo: prediction timed out")
        except ProviderError:
            raise
        except Exception as e:
            raise ProviderError(f"Hailuo call failed: {e}") from e


# --- SEEDANCE (ByteDance) via fal.ai -----------------------------------------

class SeedanceVideoProvider(_ReplicateBase):
    """ByteDance Seedance-1-Lite via Replicate — T2V + I2V, ~$0.03/s.

    Confirmed slug: bytedance/seedance-1-lite (3.6M runs).
    Registered with the REPLICATE_API_TOKEN — no separate key needed.
    """
    def generate(self, prompt, *, seconds=5.0, fps=24, init_image=None) -> MediaAsset:
        duration = max(4, min(8, int(round(seconds))))
        inp: dict = {
            "prompt": prompt,
            "duration": duration,
            "resolution": "480p",
            "aspect_ratio": "16:9",
        }
        if init_image:
            inp["image_url"] = init_image
        out = self._run(inp, timeout=240)
        uri = self._fetch(out, ".mp4")
        return MediaAsset(uri=uri, mime="video/mp4", model_id=self.model_id,
                          cost_usd=self.est_cost_usd)


# --- GOOGLE VEO via Gemini API (free tier available) -------------------------

class GeminiVeoProvider:
    """Google Veo 3.1 via the Gemini API — free tier with GEMINI_API_KEY.

    Get a free key at https://aistudio.google.com/  (no credit card required).
    Set GEMINI_API_KEY in .env to activate this provider.
    Free tier resets daily; 429 falls through to the next provider.
    """
    _API = "https://generativelanguage.googleapis.com/v1beta"
    # Try models in quality order; each may have independent rate limits
    _MODELS = [
        "veo-3.1-generate-preview",       # best quality
        "veo-3.1-fast-generate-preview",  # fastest
        "veo-3.1-lite-generate-preview",  # lightest
    ]

    def __init__(self, api_key: str):
        self.model_id = "google/veo-2"
        self._key = api_key
        self.capabilities = {Cap.MODERATION_OK}
        self.est_cost_usd = 0.0
        self.est_latency_s = 90.0
        self.quality = 9

    def generate(self, prompt, *, seconds=5.0, fps=24, init_image=None) -> MediaAsset:
        import base64, time
        # Veo 3.1 only reliably accepts 6 or 8 second durations
        duration = 8 if seconds > 7 else 6
        body = {
            "instances": [{"prompt": prompt}],
            "parameters": {
                "durationSeconds": duration,
                "aspectRatio": "16:9",
                "sampleCount": 1,
            },
        }
        headers = {"Content-Type": "application/json", "x-goog-api-key": self._key}
        try:
            with httpx.Client(timeout=30) as client:
                # Try each model variant; each has independent rate-limit buckets
                r = None
                used_model = None
                for model in self._MODELS:
                    r = client.post(
                        f"{self._API}/models/{model}:predictLongRunning",
                        json=body, headers=headers)
                    if r.status_code != 429:
                        used_model = model
                        break
                if r.status_code == 429:
                    raise ProviderError(
                        "Gemini Veo: all model variants quota exhausted")
                if r.status_code not in (200, 201, 202):
                    raise ProviderError(
                        f"Gemini Veo submit failed ({r.status_code}): {r.text[:300]}")
                op = r.json()
                op_name = op.get("name", "")
                if not op_name:
                    raise ProviderError("Gemini Veo: no operation name in response")

                # Poll the long-running operation (typically 60-120 s)
                deadline = time.time() + 300
                while time.time() < deadline:
                    time.sleep(5)
                    rp = client.get(f"{self._API}/{op_name}", headers=headers)
                    op = rp.json()
                    if op.get("done"):
                        break
                else:
                    raise ProviderError("Gemini Veo: prediction timed out after 5 min")

                if "error" in op:
                    raise ProviderError(f"Gemini Veo error: {op['error']}")

                # Veo 3.1 returns generateVideoResponse.generatedSamples[].video.uri
                samples = (op.get("response", {})
                             .get("generateVideoResponse", {})
                             .get("generatedSamples", []))
                if not samples:
                    # Fallback: check predictions[] format
                    preds = op.get("response", {}).get("predictions", [])
                    if preds:
                        pred = preds[0]
                        if "bytesBase64Encoded" in pred:
                            video_bytes = base64.b64decode(pred["bytesBase64Encoded"])
                            return MediaAsset(uri=_stub_file(".mp4", video_bytes),
                                              mime="video/mp4", model_id=self.model_id,
                                              cost_usd=0.0)
                        if "uri" in pred:
                            rv = client.get(pred["uri"], headers=headers, timeout=120)
                            rv.raise_for_status()
                            return MediaAsset(uri=_stub_file(".mp4", rv.content),
                                              mime="video/mp4", model_id=self.model_id,
                                              cost_usd=0.0)
                    raise ProviderError(f"Gemini Veo: no video in response: {op}")

                video_uri = samples[0].get("video", {}).get("uri", "")
                if not video_uri:
                    raise ProviderError(f"Gemini Veo: missing video URI in samples: {samples[0]}")
                rv = client.get(video_uri, headers=headers, timeout=120,
                                follow_redirects=True)
                rv.raise_for_status()
                return MediaAsset(uri=_stub_file(".mp4", rv.content),
                                  mime="video/mp4", model_id=self.model_id,
                                  cost_usd=0.0)
        except ProviderError:
            raise
        except Exception as e:
            raise ProviderError(f"Gemini Veo call failed: {e}") from e


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
