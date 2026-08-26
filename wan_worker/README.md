# Wan 2.2 TI2V-5B — Scale-to-0 GPU Worker

Generates video clips from text + optional keyframe image using Wan 2.2 TI2V-5B.
The GPU spins up only when jobs are queued and shuts down when idle — $0/hr at rest.

Controlled by `WAN_BACKEND` in `.env`:
- `modal` — easier setup, no Docker push, faster iteration
- `runpod` — cheaper per clip in production, more setup

Both backends upload output to S3 and return a presigned URL to the gateway.

---

## Architecture

```
Pipeline worker
      │
      ▼
Model Gateway (gateway)
      │  POST /v1/video
      ▼
WanVideoProvider (model_gateway/providers/media.py)
      │
      ├── WAN_BACKEND=modal ──▶  Modal web endpoint
      │                               │
      └── WAN_BACKEND=runpod ─▶  RunPod serverless API
                                      │
                              (both) GPU spins up
                                      │
                              Wan 2.2 inference
                                      │
                              Upload MP4 → S3
                                      │
                              Presigned URL → Gateway
                                      │
                              Gateway downloads → stores locally
```

---

## Prerequisites (both backends)

### S3 bucket for video output

The worker uploads generated videos to S3. The gateway downloads them.
Your AWS credentials are already in `.env` — just create a bucket:

```bash
aws s3 mb s3://your-project-wan-outputs --region us-east-1
```

Add to `.env`:
```
S3_BUCKET=your-project-wan-outputs
S3_PREFIX=wan-outputs
S3_URL_EXPIRES=3600
```

---

## Option A — Modal (recommended for getting started)

**Why Modal first:** No Docker Hub account, no 20GB image push, no dashboard config.
Model weights live in a Modal Volume — downloaded once, reused across cold starts.
Swap inference parameters and redeploy in seconds.

**Cost:** ~$0.028–$0.05 per 5-second 720p clip depending on GPU.

**Cold start:** ~25s (GPU boot + load weights from volume).

### Step 1 — Install Modal and authenticate

#### Local machine (browser available)

```bash
pip install modal
modal token new        # opens browser → log in → token saved to ~/.modal.toml
```

#### Server / CI (no browser)

Generate the token on your local machine first, then copy the values to the server.

**On your local machine — retrieve the token:**
```bash
modal token new        # completes in browser
cat ~/.modal.toml
# Output:
# [default]
# token_id = "ak-xxxxxxxxxxxxxxxxxxxx"
# token_secret = "as-xxxxxxxxxxxxxxxxxxxx"
```

**On the server — set as environment variables** (add to `.env` or your system environment):
```
MODAL_TOKEN_ID=ak-xxxxxxxxxxxxxxxxxxxx
MODAL_TOKEN_SECRET=as-xxxxxxxxxxxxxxxxxxxx
```

The Modal CLI and the gateway both pick these up automatically — no browser login needed on the server.

> **Note:** `modal deploy` and `modal run` are always run from your **local machine** (or CI/CD).
> The server running the Docker stack only needs `MODAL_ENDPOINT_URL` — it never calls the Modal CLI.

### Step 2 — Create Modal secret with AWS credentials

Modal needs your AWS creds to upload videos to S3.
The secret name `wan-secrets` is what `modal_app.py` references.

```bash
modal secret create wan-secrets \
  AWS_ACCESS_KEY_ID=your-key-id \
  AWS_SECRET_ACCESS_KEY=your-secret \
  AWS_DEFAULT_REGION=us-east-1 \
  S3_BUCKET=your-project-wan-outputs \
  S3_PREFIX=wan-outputs \
  S3_URL_EXPIRES=3600
```

### Step 3 — Download Wan model weights into Modal Volume

This runs once and stores the model (~10GB) in a persistent Modal Volume.
Subsequent cold starts load from the volume — no re-download.

```bash
# Runs on a CPU container, takes ~15 min
modal run wan_worker/modal_app.py::download_model
```

### Step 4 — Deploy the function

```bash
modal deploy wan_worker/modal_app.py
```

Output will include:
```
✓ Created objects.
├── 🔨 Created function generate.
└── 🌐 Created web endpoint https://yourorg--wan-worker-generate.modal.run
```

Copy that URL.

### Step 5 — Configure `.env`

```
WAN_BACKEND=modal
MODAL_ENDPOINT_URL=https://yourorg--wan-worker-generate.modal.run
```

### Step 6 — Restart the gateway

```bash
docker compose up -d gateway studio worker
```

### Choosing a GPU

Edit the `gpu=` line in `modal_app.py` before deploying, or set `WAN_GPU` before running `modal deploy`:

| GPU | VRAM | $/hr | ~Time/clip | Best for |
|---|---|---|---|---|
| `A10G` | 24GB | ~$1.10 | ~90s | Default — good balance |
| `A100-40GB` | 40GB | ~$3.70 | ~45s | Faster, more expensive |
| `L40S` | 48GB | ~$1.60 | ~55s | Best value for speed |
| `T4` | 16GB | ~$0.59 | ~3 min | Budget testing (480p only) |

To change GPU after deploying, update `gpu=` in `modal_app.py` and run `modal deploy` again.

### Updating inference code

Just edit `modal_app.py` and redeploy — no image rebuild:
```bash
modal deploy wan_worker/modal_app.py
```

---

## Option B — RunPod (lower cost per clip in production)

**Why RunPod later:** ~$0.01–0.02 per clip at scale vs ~$0.03–0.05 on Modal.
Requires Docker Hub and a one-time image build+push.

**Cost:** ~$0.44/hr for RTX 4090 ÷ ~20 clips/hr = ~$0.02/clip.

There are two image strategies — choose one:

| | B1: Baked image | B2: Slim + Network Volume |
|---|---|---|
| Image size | ~20GB | ~8GB |
| First build time | ~20 min | ~3 min |
| Cold start | ~30s (model in image) | ~10 min first run, ~30s after |
| Monthly fixed cost | $0 | ~$0.70/month (volume storage) |
| Best for | Stable production image | Frequent iteration / testing |

---

### Step 1 — Create accounts

- **runpod.io** — sign up, add payment method, purchase credits ($10–20 to start)
- **hub.docker.com** — create a free account

---

### Step 2 — Validate before building (2 min, no model download)

Always validate first to catch import errors before the expensive full build:

```bash
cd /root/projects/agentic-platform
docker build --target deps-only -t wan-test wan_worker/
docker run --rm wan-test python3 validate.py
```

Expected output:
```
Python: 3.12.x ...
PyTorch: 2.9.x
diffusers: WanImageToVideoPipeline + WanPipeline imported OK
boto3: x.x.x
handler.py: syntax OK
Model weights: not present (deps-only image — expected)
ALL CHECKS PASSED — safe to do full build
```

Fix any errors before proceeding.

---

### Step 3B1 — Build baked image (~20GB, model inside)

Model weights are downloaded and baked into the image during build (~20 min).
Cold start is fast (~30s) but the image is large.

```bash
docker build --target full-baked \
  -t yourdockerhubuser/wan-worker:main-base wan_worker/
docker push yourdockerhubuser/wan-worker:main-base
# First push: ~10 min. Subsequent code-only pushes: ~30s (only changed layers).
```

Skip to Step 4 and use `yourdockerhubuser/wan-worker:main-base` as the container image.

---

### Step 3B2 — Build slim image (~8GB, model on Network Volume)

Image contains only code and dependencies. Model downloads to a RunPod Network
Volume on first run (~10 min one-time), then reuses it on every subsequent start.

**First: create the Network Volume**
1. RunPod dashboard → **Storage → New Network Volume**
2. Name: `wan-models`, Size: **15GB** (leaves headroom), Region: same as your endpoint
3. Note the volume name

**Build and push the slim image:**
```bash
docker build --target full-network-volume \
  -t yourdockerhubuser/wan-worker:slim wan_worker/
docker push yourdockerhubuser/wan-worker:slim
# Pushes ~8GB — about half the time of the baked image
```

**When creating the endpoint (Step 4), additionally:**
- Mount the Network Volume at `/runpod-volume`
- Add env var: `MODEL_DIR=/runpod-volume/models/Wan2.2-TI2V-5B`

**Cost:** ~$0.07/GB/month × 15GB = **~$1.05/month** for the volume.

---

### Step 4 — Create a RunPod serverless endpoint

1. Go to **runpod.io → Serverless → New Endpoint**
2. Set **Container Image** to your chosen tag (`main-base` or `slim`)
3. Select GPU:

| GPU | VRAM | $/hr | Recommended |
|---|---|---|---|
| RTX 3090 24GB | 24GB | ~$0.20–0.50 | Cheapest experiment |
| **RTX 4090 24GB** | 24GB | ~$0.32–0.69 | **Best overall** |
| L40S 48GB | 48GB | ~$0.79–1.19 | Production |

4. Set scaling:
   - **Min workers: 0** — true scale-to-0, GPU off when idle
   - **Max workers: 1** — keeps a warm worker for sequential shots in a pipeline run
   - **Idle timeout: 300 seconds** — keeps pod warm between shots (avoids repeated cold starts within a single pipeline run)

5. Set **Environment Variables** in the RunPod dashboard:
   ```
   AWS_ACCESS_KEY_ID       your-key-id
   AWS_SECRET_ACCESS_KEY   your-secret
   AWS_DEFAULT_REGION      us-east-1
   S3_BUCKET               your-project-wan-outputs
   S3_PREFIX               wan-outputs
   S3_URL_EXPIRES          3600
   ```
   If using the slim image, also add:
   ```
   MODEL_DIR               /runpod-volume/models/Wan2.2-TI2V-5B
   ```

6. If using the slim image, attach the Network Volume under **Advanced → Volume Mounts → Mount path: `/runpod-volume`**

7. Click **Deploy** and note the **Endpoint ID** (e.g. `abc123xyz`)

---

### Step 5 — Get your RunPod API key

runpod.io → Settings → API Keys → Create API Key

---

### Step 6 — Configure `.env`

```
WAN_BACKEND=runpod
RUNPOD_API_KEY=your-api-key
RUNPOD_WAN_ENDPOINT_ID=abc123xyz
```

### Step 7 — Restart the gateway

```bash
docker compose up -d gateway studio worker
```

---

### Updating inference code on RunPod

**Always validate first:**
```bash
docker build --target deps-only -t wan-test wan_worker/
docker run --rm wan-test python3 validate.py
```

**Then rebuild only the target you use:**
```bash
# Baked image
docker build --target full-baked -t yourdockerhubuser/wan-worker:main-base wan_worker/
docker push yourdockerhubuser/wan-worker:main-base

# Slim image
docker build --target full-network-volume -t yourdockerhubuser/wan-worker:slim wan_worker/
docker push yourdockerhubuser/wan-worker:slim
```

> **Note:** After the first push, only changed layers are uploaded. A `handler.py`-only
> change pushes ~50KB regardless of image size.

---

## Switching between backends

Change one line in `.env` and restart:

```bash
# Switch to Modal
WAN_BACKEND=modal

# Switch to RunPod
WAN_BACKEND=runpod

# Disable Wan entirely (falls back to Veo / Seedance / Ken Burns)
WAN_BACKEND=
```

Then:
```bash
docker compose up -d gateway studio worker
```

No other changes needed — both backends use the same gateway interface.

---

## Verifying it works

After setup, check the gateway recognises the provider:

```bash
curl http://localhost:8001/v1/providers | python3 -c "
import json,sys; d=json.load(sys.stdin)
for p in d['video']: print(p['model_id'], p['est_cost_usd'])"
```

You should see `wan/modal` or `wan/runpod` in the list.

Test a single clip end-to-end (~2 min including cold start):

```bash
curl -X POST http://localhost:8001/v1/video \
  -H "Content-Type: application/json" \
  -d '{"prompt":"two people having a conversation in a bright office, photorealistic","task":"default","seconds":5}' \
  --max-time 300 | python3 -c "
import json,sys; d=json.load(sys.stdin)
print('model:', d['model_used'])
print('cost:', d['cost_usd'])
print('uri:', d['result']['uri'][-30:])"
```

---

## Cost summary

| Backend | GPU | $/hr | Time/clip | **$/clip** |
|---|---|---|---|---|
| Modal | A10G | $1.10 | ~90s | ~$0.028 |
| Modal | A100-40GB | $3.70 | ~45s | ~$0.046 |
| RunPod | RTX 4090 | $0.50 | ~75s | ~$0.010 |
| RunPod | L40S | $1.00 | ~50s | ~$0.014 |
| Replicate Seedance | — | — | ~60s | ~$0.150 |
| MiniMax (Replicate) | — | — | ~120s | ~$0.060 |

**12-clip full pipeline run (720p):**
- Modal A10G: ~$0.34
- RunPod 4090: ~$0.12
- Replicate Seedance: ~$1.80

---

## Deploying the platform on a server

When the agentic platform itself runs on a server (not your laptop), the Modal setup
changes slightly. The Modal worker still runs on Modal's cloud — your server is only
a consumer of the endpoint URL.

### What the server needs

Only two things related to Modal:
1. `MODAL_ENDPOINT_URL` in `.env`
2. Outbound HTTPS to `*.modal.run` (port 443)

The Modal CLI does **not** need to be installed on the server.

### What stays on your local machine

| Task | Where to run |
|---|---|
| `modal token new` | Local machine (needs browser) |
| `modal secret create wan-secrets ...` | Local machine |
| `modal run ::download_model` | Local machine |
| `modal deploy modal_app.py` | Local machine (or CI/CD) |
| Docker Compose | Server |

### Full server `.env` additions

```
# ── Modal authentication (server / headless) ───────────────────────────────
# Get these from ~/.modal.toml after running `modal token new` on your laptop.
MODAL_TOKEN_ID=ak-xxxxxxxxxxxxxxxxxxxx
MODAL_TOKEN_SECRET=as-xxxxxxxxxxxxxxxxxxxx

# ── Wan backend config ─────────────────────────────────────────────────────
WAN_BACKEND=modal
MODAL_ENDPOINT_URL=https://yourorg--wan-worker-generate.modal.run

# ── S3 for video output ────────────────────────────────────────────────────
S3_BUCKET=your-project-wan-outputs
S3_PREFIX=wan-outputs
S3_URL_EXPIRES=3600
```

### Deployment workflow

```
Your laptop                              Server                     Modal cloud
    │                                       │                           │
    ├─ modal token new (once) ──────────────────────────────────────▶  │
    │  copy token_id + token_secret         │                           │
    │                                       │                           │
    ├─ modal secret create wan-secrets ─────────────────────────────▶  │
    │                                       │                           │
    ├─ modal run ::download_model ──────────────────────────────────▶  │
    │  (writes Wan weights to Modal Volume) │                           │
    │                                       │                           │
    ├─ modal deploy modal_app.py ───────────────────────────────────▶  │
    │  copy endpoint URL                    │                           │
    │                                       │                           │
    └─ set MODAL_ENDPOINT_URL ─────────────▶│                           │
       + MODAL_TOKEN_ID/SECRET in .env      │                           │
                                            │                           │
                            docker compose up -d                        │
                                            │                           │
                            pipeline runs video ──── POST endpoint ───▶ │
                            job                                   GPU runs
                                            │◀──── video_url ─────────── │
```

### CI/CD — automated redeploy on code change

If you update `modal_app.py` (e.g. tune inference parameters), redeploy from your
local machine or add this to your CI pipeline:

```yaml
# .github/workflows/deploy-wan.yml
- name: Deploy Wan worker
  env:
    MODAL_TOKEN_ID: ${{ secrets.MODAL_TOKEN_ID }}
    MODAL_TOKEN_SECRET: ${{ secrets.MODAL_TOKEN_SECRET }}
  run: |
    pip install modal
    modal deploy wan_worker/modal_app.py
```

No server restart needed after redeploying — the endpoint URL stays the same.

---

## Troubleshooting

**`WanVideoProvider` not appearing in `/v1/providers`**
- Check `WAN_BACKEND` is set to `modal` or `runpod` (not blank)
- For Modal: `MODAL_ENDPOINT_URL` must be set
- For RunPod: both `RUNPOD_API_KEY` and `RUNPOD_WAN_ENDPOINT_ID` must be set
- Restart gateway after changing `.env`

**Modal: `modal.exception.NotFoundError: Secret wan-secrets not found`**
- Run `modal secret create wan-secrets ...` (Step 2 above)

**Modal: model not found in volume**
- Run `modal run wan_worker/modal_app.py::download_model`

**RunPod: job fails immediately**
- Check the environment variables are set on the RunPod endpoint dashboard
- Check `S3_BUCKET` exists and the AWS credentials have write access

**RunPod: `[transformers] Disabling PyTorch because PyTorch >= 2.5 is required`**
- The base image is too old. Use `runpod/pytorch:1.1.0-cu1281-torch291-ubuntu2204` in the Dockerfile.
- Rebuild: `docker build --target full-baked -t youruser/wan-worker:main-base wan_worker/`

**RunPod: `OSError: no file named model_index.json found in /app/models/Wan2.2-TI2V-5B`**
- The model weights were not baked into the image correctly.
- The `hf` CLI redirected downloads to `HF_HOME` instead of `--local-dir`. The Dockerfile now uses `snapshot_download` via Python which is reliable.
- Rebuild with the current Dockerfile: `docker build --target full-baked ...`
- To verify before rebuilding: `docker build --target deps-only -t wan-test wan_worker/ && docker run --rm wan-test python3 validate.py`

**RunPod: jobs stay `IN_QUEUE` for 10+ minutes**
- First-time image pull from Docker Hub (20GB takes 5–15 min). This only happens once per RunPod machine.
- After the first pull, the image is cached on that machine and cold start drops to ~30s.
- Set **Idle timeout to 300s** so back-to-back clips in a pipeline run reuse the warm worker.

**RunPod: gateway falls through to `mock/video` immediately**
- The httpx client was timing out during polling. This is fixed — the provider now uses separate clients for submit and polling.
- Confirm you're running the latest gateway image: `docker compose up -d gateway`

**Video is 480p / blurry**
- The 5B model requires 24GB VRAM for 720p; use RTX 3090/4090/L40S
- T4 (16GB) can only run 480p — change `resolution` to `"480p"` in the payload

**Cold start too slow**
- RunPod: set **Idle timeout to 300s** — keeps the pod warm for a full 12-clip pipeline run after the first cold start
- RunPod: set min workers to 1 (GPU always on, eliminates cold start, costs ~$0.50/hr constantly)
- Modal: set `container_idle_timeout` higher (e.g. 120s) in `modal_app.py` and redeploy
