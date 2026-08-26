"""Wan 2.2 TI2V-5B — Modal serverless deployment.

Deploy once:
  modal deploy wan_worker/modal_app.py

Download model into the persistent volume (run once per volume):
  modal run wan_worker/modal_app.py::download_model

After deploy, copy the printed web endpoint URL into .env as MODAL_ENDPOINT_URL.

The function scales to 0 when idle — you pay only while generating.
Cold start (GPU boot + model load from volume): ~25s.

GPU options (set WAN_GPU in .env or change the decorator):
  "A10G"      — 24GB, ~$1.10/hr, ~90s/clip, cheapest that fits 5B @ 720p
  "A100-40GB" — 40GB, ~$3.70/hr, ~45s/clip, faster
  "L40S"      — 48GB, ~$1.60/hr, ~55s/clip, good mid-tier

Environment variables (set as a Modal Secret named "wan-secrets"):
  AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_DEFAULT_REGION
  S3_BUCKET     — bucket for output videos
  S3_PREFIX     — key prefix, default "wan-outputs"
  S3_URL_EXPIRES — presigned URL TTL seconds, default 3600
"""
from __future__ import annotations

import base64
import io
import os
import tempfile
import time
import uuid

import modal

# ── App + persistent model volume ─────────────────────────────────────────────
app = modal.App("wan-worker")

# Volume persists across container restarts — model downloaded once, reused always.
volume = modal.Volume.from_name("wan-model-cache", create_if_missing=True)
MODEL_PATH = "/cache/Wan2.2-TI2V-5B"

# ── Container image ────────────────────────────────────────────────────────────
image = (
    modal.Image.from_registry(
        "nvidia/cuda:12.4.1-devel-ubuntu22.04",
        add_python="3.11",
    )
    .apt_install("ffmpeg", "git")
    .pip_install(
        "torch==2.4.0",
        "torchvision",
        "diffusers>=0.32.0",
        "transformers>=4.45.0",
        "accelerate>=0.34.0",
        "huggingface_hub>=0.24.0",
        "boto3>=1.35.0",
        "Pillow>=10.4.0",
        "imageio>=2.35.0",
        "imageio-ffmpeg>=0.5.1",
        "sentencepiece>=0.2.0",
        "safetensors>=0.4.5",
    )
)


# ── One-time model download ────────────────────────────────────────────────────
@app.function(volumes={"/cache": volume}, image=image, timeout=3600)
def download_model():
    """Run once: modal run wan_worker/modal_app.py::download_model"""
    from huggingface_hub import snapshot_download
    dest = MODEL_PATH
    if os.path.exists(f"{dest}/model_index.json"):
        print(f"[wan] Model already in volume at {dest}")
        return
    print(f"[wan] Downloading Wan 2.2 TI2V-5B → {dest} …")
    snapshot_download(
        "Wan-AI/Wan2.2-TI2V-5B",
        local_dir=dest,
        ignore_patterns=["*.md", "*.txt", "*.gitattributes"],
    )
    volume.commit()   # persist to volume
    print("[wan] Download complete.")


# ── Inference function ─────────────────────────────────────────────────────────
# Swap "A10G" for "A100-40GB" or "L40S" based on your budget / speed needs.
@app.function(
    gpu=os.environ.get("WAN_GPU", "A10G"),
    image=image,
    volumes={"/cache": volume},
    secrets=[modal.Secret.from_name("wan-secrets")],
    timeout=600,
    container_idle_timeout=30,   # scale to 0 after 30s idle
)
@modal.web_endpoint(method="POST")
def generate(
    prompt: str,
    init_image_b64: str | None = None,
    duration: int = 5,
    resolution: str = "720p",
    num_inference_steps: int = 50,
) -> dict:
    """
    POST body (JSON):
      prompt           str
      init_image_b64   str | null   base64-encoded PNG/JPEG for image init
      duration         int          5 or 8 (default 5)
      resolution       str          "480p" | "720p" (default "720p")
      num_inference_steps int       default 50
    """
    import torch
    from diffusers import WanImageToVideoPipeline, WanPipeline
    from diffusers.utils import export_to_video
    from PIL import Image
    import boto3

    res_map = {"480p": (832, 480), "720p": (1280, 720)}
    width, height = res_map.get(resolution, (1280, 720))

    fps = 16
    num_frames = max(duration, 5) * fps + 1

    print(f"[wan] {resolution} {duration}s, {num_frames} frames, {num_inference_steps} steps")

    # Load pipeline (cached in container for the lifetime of the worker)
    t0 = time.time()
    if init_image_b64:
        pipe = WanImageToVideoPipeline.from_pretrained(
            MODEL_PATH, torch_dtype=torch.bfloat16)
    else:
        pipe = WanPipeline.from_pretrained(
            MODEL_PATH, torch_dtype=torch.bfloat16)

    pipe.enable_model_cpu_offload()
    pipe.enable_vae_slicing()
    print(f"[wan] Pipeline loaded in {time.time()-t0:.1f}s")

    kwargs: dict = dict(
        prompt=prompt,
        num_frames=num_frames,
        height=height,
        width=width,
        num_inference_steps=num_inference_steps,
        guidance_scale=5.0,
    )
    if init_image_b64:
        raw = base64.b64decode(init_image_b64)
        img = Image.open(io.BytesIO(raw)).convert("RGB").resize((width, height))
        kwargs["image"] = img

    t1 = time.time()
    with torch.inference_mode():
        output = pipe(**kwargs)
    elapsed = round(time.time() - t1, 1)
    print(f"[wan] Inference done in {elapsed}s")

    frames = output.frames[0]
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as f:
        tmp = f.name
    export_to_video(frames, tmp, fps=fps)

    # Upload to S3
    bucket = os.environ["S3_BUCKET"]
    prefix = os.environ.get("S3_PREFIX", "wan-outputs").rstrip("/")
    expires = int(os.environ.get("S3_URL_EXPIRES", "3600"))
    key = f"{prefix}/{uuid.uuid4().hex}.mp4"
    s3 = boto3.client("s3")
    s3.upload_file(tmp, bucket, key, ExtraArgs={"ContentType": "video/mp4"})
    url = s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": bucket, "Key": key},
        ExpiresIn=expires,
    )
    os.unlink(tmp)
    print(f"[wan] Uploaded → S3:{key}")

    return {
        "video_url": url,
        "duration_s": duration,
        "resolution": resolution,
        "model": "Wan2.2-TI2V-5B",
        "inference_seconds": elapsed,
    }
