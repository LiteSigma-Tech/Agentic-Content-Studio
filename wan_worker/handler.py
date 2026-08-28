"""RunPod Serverless handler for Wan 2.2 TI2V-5B video generation.

Architecture:
  Gateway  →  RunPod API  →  this handler (GPU spins up)
                                  ↓
                            Wan 2.2 inference
                                  ↓
                            upload MP4 → S3
                                  ↓
                         return presigned URL  →  Gateway downloads

Environment variables (set on the RunPod endpoint):
  AWS_ACCESS_KEY_ID       — S3 upload credentials
  AWS_SECRET_ACCESS_KEY
  AWS_DEFAULT_REGION      — e.g. us-east-1
  S3_BUCKET               — bucket for video outputs
  S3_PREFIX               — optional key prefix, default "wan-outputs"
  S3_URL_EXPIRES          — presigned URL TTL in seconds, default 3600

Input schema (job["input"]):
  prompt          str   — text description of the video
  init_image_b64  str?  — base64-encoded PNG/JPEG for image-to-video
  duration        int   — 4 or 5 seconds (default 5)
  resolution      str   — "480p" or "720p" (default "720p")
  num_inference_steps int — default 50 (fewer = faster, lower quality)

Output:
  {"video_url": "<presigned S3 URL>", "duration_s": 5, "model": "Wan2.2-TI2V-5B"}
"""
from __future__ import annotations

import base64
import io
import os
import tempfile
import time
import uuid
from pathlib import Path

import boto3
import runpod
import torch
from PIL import Image


# ── Model path ───────────────────────────────────────────────────────────────
# Default: baked into image at /app/models (full-baked Docker target)
# Override: set MODEL_DIR env var to a network volume path for the slim image
MODEL_DIR = Path(os.environ.get("MODEL_DIR", "/app/models/Wan2.2-TI2V-5B"))

# ── Lazy-load the pipeline once per worker lifetime ──────────────────────────
_pipe = None


def _load_pipeline():
    global _pipe
    if _pipe is not None:
        return _pipe

    MODEL_ID = "Wan-AI/Wan2.2-TI2V-5B-Diffusers"
    HF_TOKEN = os.environ.get("HF_TOKEN")
    local_dir = MODEL_DIR / "model_files"

    print(f"[wan] Model dir: {local_dir}")
    local_dir.mkdir(parents=True, exist_ok=True)

    # Download native Wan model files if not already present.
    # Wan-AI/Wan2.2-TI2V-5B is NOT in diffusers pipeline format — it has no
    # model_index.json — so we can't use from_pretrained() on the repo directly.
    # We download the raw files then construct the pipeline component by component.
    print(f"[wan] Loading {MODEL_ID}...")
    t0 = time.time()

    from diffusers import WanImageToVideoPipeline
    from diffusers.utils import export_to_video

    # Wan-AI/Wan2.2-TI2V-5B-Diffusers is the official diffusers-format repo
    # with model_index.json and all component subfolders — loads cleanly.
    _pipe = WanImageToVideoPipeline.from_pretrained(
        MODEL_ID,
        cache_dir=str(MODEL_DIR),
        torch_dtype=torch.bfloat16,
        token=HF_TOKEN,
    )

    _pipe.enable_model_cpu_offload()
    _pipe.vae.enable_slicing()
    _pipe.vae.enable_tiling()

    print(f"[wan] Pipeline ready in {time.time() - t0:.1f}s")
    return _pipe


def _resolution_to_dims(resolution: str) -> tuple[int, int]:
    mapping = {
        "480p":  (832, 480),
        "720p":  (1280, 720),
        "1080p": (1920, 1080),
    }
    return mapping.get(resolution, (1280, 720))


def _decode_image(b64_str: str) -> Image.Image:
    data = base64.b64decode(b64_str)
    return Image.open(io.BytesIO(data)).convert("RGB")


def _upload_to_s3(local_path: str) -> str:
    bucket = os.environ["S3_BUCKET"]
    prefix = os.environ.get("S3_PREFIX", "wan-outputs").rstrip("/")
    expires = int(os.environ.get("S3_URL_EXPIRES", "3600"))
    key = f"{prefix}/{uuid.uuid4().hex}.mp4"

    s3 = boto3.client("s3")
    s3.upload_file(local_path, bucket, key,
                   ExtraArgs={"ContentType": "video/mp4"})
    url = s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": bucket, "Key": key},
        ExpiresIn=expires,
    )
    return url


def handler(job: dict) -> dict:
    inp = job.get("input", {})

    prompt          = inp.get("prompt", "cinematic video clip")
    init_b64        = inp.get("init_image_b64")
    duration        = int(inp.get("duration", 5))
    resolution      = inp.get("resolution", "720p")
    steps           = int(inp.get("num_inference_steps", 50))

    width, height = _resolution_to_dims(resolution)

    # fps=16 for Wan; num_frames = duration × fps (Wan uses 16 fps internally)
    fps = 16
    num_frames = duration * fps + 1   # +1 for the initial frame

    print(f"[wan] Generating {resolution} {duration}s clip ({num_frames} frames)")
    print(f"[wan] Prompt: {prompt[:120]}")

    pipe = _load_pipeline()

    from diffusers.utils import export_to_video

    t0 = time.time()
    with torch.inference_mode():
        kwargs: dict = dict(
            prompt=prompt,
            num_frames=num_frames,
            height=height,
            width=width,
            num_inference_steps=steps,
            guidance_scale=5.0,
        )
        # WanImageToVideoPipeline always requires an image argument.
        # Use the provided keyframe if available, otherwise a black frame.
        if init_b64:
            image = _decode_image(init_b64)
            image = image.resize((width, height))
        else:
            image = Image.new("RGB", (width, height), color=(0, 0, 0))
        kwargs["image"] = image

        output = pipe(**kwargs)

    frames = output.frames[0]
    elapsed = time.time() - t0
    print(f"[wan] Inference done in {elapsed:.1f}s")

    # Write to temp file then upload
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as f:
        tmp_path = f.name

    export_to_video(frames, tmp_path, fps=fps)

    video_url = _upload_to_s3(tmp_path)
    os.unlink(tmp_path)

    print(f"[wan] Uploaded → {video_url[:80]}…")
    return {
        "video_url": video_url,
        "duration_s": duration,
        "resolution": resolution,
        "model": "Wan2.2-TI2V-5B",
        "inference_seconds": round(elapsed, 1),
    }


if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})
