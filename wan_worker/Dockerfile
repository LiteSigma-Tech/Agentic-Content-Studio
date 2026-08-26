# ── Wan 2.2 TI2V-5B — RunPod Serverless Worker ──────────────────────────────
#
# The model weights are baked into this image at build time.
# A 4090 24GB handles 5B at 720p comfortably; 3090 works at 480p.
#
# Build & push (one-time, ~20 min — model download):
#   docker build -t yourorg/wan-worker:latest .
#   docker push yourorg/wan-worker:latest
#
# RunPod serverless endpoint → point at this image, set env vars:
#   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_DEFAULT_REGION, S3_BUCKET
# ─────────────────────────────────────────────────────────────────────────────

FROM runpod/pytorch:1.1.0-cu1281-torch291-ubuntu2204 AS deps-only

WORKDIR /app

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg git wget curl \
    && rm -rf /var/lib/apt/lists/*

# Python deps (install before model download so layer is cached separately)
# torch is already in the base image — requirements.txt excludes it
# --timeout 120 prevents failures on slow connections for large packages
COPY requirements.txt .
RUN pip install --no-cache-dir --timeout 120 -r requirements.txt

# Worker code
COPY handler.py .

# ── Validate: run this target to confirm imports + handler structure work ──
# docker build --target deps-only -t wan-test wan_worker/
# docker run --rm wan-test python3 -c "import handler; print('OK')"

# ── Full image option A: bake model weights (~10GB, ~20GB total image) ───────
# Fastest cold start (~30s), largest image, slowest first push.
FROM deps-only AS full-baked

RUN python3 -c "\
from huggingface_hub import snapshot_download; \
snapshot_download( \
    'Wan-AI/Wan2.2-TI2V-5B', \
    local_dir='/app/models/Wan2.2-TI2V-5B', \
    ignore_patterns=['*.md', '*.txt', '*.gitattributes'] \
)"

CMD ["python", "-u", "handler.py"]

# ── Full image option B: model on RunPod Network Volume (~8GB image) ─────────
# Mount a RunPod Network Volume at /runpod-volume/models on the endpoint.
# Handler downloads model to volume on first run, reuses it on subsequent runs.
# Image is ~8GB — much faster to build, push, and pull.
#
# Setup: RunPod dashboard → Storage → New Network Volume → mount at /runpod-volume
# Set env var on endpoint: MODEL_DIR=/runpod-volume/models/Wan2.2-TI2V-5B
#
# To build this target:
#   docker build --target full-network-volume -t emmanuelob/wan-worker:slim wan_worker/
FROM deps-only AS full-network-volume

# Download model to network volume on first run, reuse thereafter
ENV MODEL_DIR=/runpod-volume/models/Wan2.2-TI2V-5B

CMD ["python", "-u", "handler.py"]

# Default target is the baked version (RunPod endpoint uses full-baked behaviour)
FROM full-baked AS default
