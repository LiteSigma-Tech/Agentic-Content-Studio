# Agentic Content & Lead Platform

A modular platform with three product surfaces — **autonomous lead generation**, a
**video studio**, and an **audio studio** for generating episodic content (drama,
romance, comedy, kids' cartoon) — built on a shared, **config-driven, free-first**
model layer and an agentic runtime.

Everything here runs **fully offline** (no GPUs, no API keys): models are mocked
behind a swappable gateway, and ffmpeg produces real media. Point the gateway at
real model backends and the same code runs live.

```
┌──────────────────────────────────────────────────────────────────────┐
│  frontend            operator console over all of it  (Vite + React) │
├──────────────────────────────────────────────────────────────────────┤
│  nginx               reverse proxy — single public entry point (80)  │
├──────────────────────────────────────────────────────────────────────┤
│  platform_core       auth · tenancy · RBAC · metering · quotas ·     │
│                      rate limiting · observability                    │
├───────────────┬───────────────┬───────────────┬──────────────────────┤
│ video_studio  │ audio_studio  │ lead_gen      │ agent_runtime         │
│ concept →     │ + voices,     │ compliant     │ tools · HITL · memory │
│ silent ep.    │ music, mix →  │ funnel +      │ guardrails · durable  │
│               │ final A/V     │ approval-gated│ runs                  │
│               │               │ outreach      │                       │
├───────────────┴───────────────┴───────────────┴──────────────────────┤
│  model_gateway       one interface for LLM/image/video/TTS/music;    │
│                      config-driven routing, fallback, free-only,      │
│                      capability gating, per-call cost capture         │
├──────────────────────────────────────────────────────────────────────┤
│  worker (ARQ)        background task processor — studio pipelines     │
│                      and agent runs via Redis queue                   │
├──────────────────────────────────────────────────────────────────────┤
│  Postgres 16         durable state — tenants, runs, leads, projects  │
│  Redis 7             rate-limit buckets · ARQ job queue              │
└──────────────────────────────────────────────────────────────────────┘
```

## Quickstart

```bash
pip install -r requirements.txt        # ffmpeg + ffprobe also required for media
./run_all_tests.sh                     # 85 tests across seven suites
python demo_e2e.py                     # one narrated flow through every slice
```

Or use the `Makefile`: `make install`, `make test`, `make demo`, `make up`
(docker compose), `make run-studio` (etc.), `make help` to list all targets.

Run any service's API (from the repo root), e.g.:

```bash
uvicorn audio_studio.api:app --reload      # the studio (video + audio)
uvicorn lead_gen.api:app --reload          # lead generation
uvicorn agent_runtime.api:app --reload     # the agent runtime
uvicorn platform_core.app:app --reload     # auth / metering / quotas
```

The frontend (`frontend-app/`) is a full Vite + React app with JWT auth,
TanStack Query, and an Admin tab for tenant management. It serves the dashboard,
studio pipeline, lead approval inbox, model-settings screen, and webhook
management against the live APIs.

## Run with Docker

```bash
cp .env.example .env       # fill in secrets (see below)
docker compose up --build
```

All services start from one shared image. The public entry point is nginx on
**port 80** — it routes `/api/gateway/`, `/api/studio/`, `/api/leads/`,
`/api/agents/`, `/api/platform/` to the respective backend, and `/` to the
frontend. Backend service ports are bound to `127.0.0.1` only (localhost dev
access, not public):

| Service | Dev URL | Notes |
|---|---|---|
| **nginx** | http://localhost | public entry point — use this in production |
| gateway | http://localhost:8001 | model gateway |
| studio | http://localhost:8002 | video + audio; routes models via gateway |
| leads | http://localhost:8003 | lead generation |
| agents | http://localhost:8004 | agent runtime + webhook delivery |
| platform | http://localhost:8005 | auth · metering · quotas |
| frontend | http://localhost:3000 | React console (also at http://localhost/) |

The `studio`, `agents`, and `worker` containers route model calls to the
`gateway` over HTTP and share volumes so generated media resolves across
containers. The `worker` service (ARQ) picks up background studio pipeline and
agent run jobs from the Redis queue — long-running tasks no longer block HTTP
workers.

### Required secrets (`.env`)

Copy `.env.example` to `.env` and set these before starting in production:

| Variable | Purpose | Generate with |
|---|---|---|
| `PLATFORM_SIGNING_KEY` | JWT signing key — tokens are invalidated if changed | `openssl rand -hex 32` |
| `ADMIN_BOOTSTRAP_TOKEN` | Bearer token required by `POST /admin/tenants` — leave blank to disable | `openssl rand -hex 32` |
| `POSTGRES_PASSWORD` | Postgres superuser password | `openssl rand -hex 24` |
| `REDIS_PASSWORD` | Optional Redis auth — omit for dev, set in prod | `openssl rand -hex 24` |
| `CORS_ORIGINS` | Comma-separated allowed frontend origins | your production domain |

### Default admin account

On first boot, if the database has no users, the platform automatically creates
an admin account:

| Field | Default | Override via |
|---|---|---|
| Email | `admin@admin.com` | `DEFAULT_ADMIN_EMAIL` in `.env` |
| Password | `admin123` | `DEFAULT_ADMIN_PASSWORD` in `.env` |
| Tenant | `Default` | `DEFAULT_TENANT_NAME` in `.env` |

**Change these in production.** Set the env vars in `.env` before the first
`docker compose up`, or log in and update the password from the Admin tab.

The bootstrap is idempotent — it only runs when the `users` table is empty and
is skipped on every subsequent restart.

### Bootstrap additional tenants

To create extra tenants programmatically, use the bootstrap token:

```bash
curl -X POST http://localhost:8005/admin/tenants \
  -H "Authorization: Bearer <ADMIN_BOOTSTRAP_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Acme", "admin_email": "admin@acme.com", "admin_password": "...", "plan": "free"}'
```

The response includes a one-time API key. After that, use `POST /v1/login` for
regular JWT-based auth. Additional tenants can also be created from the Admin
tab in the console (admin role only).

## The packages

| Package | What it is | Tests |
|---|---|---|
| `model_gateway` | Swappable, free-first model layer; routing, fallback, capability gating, cost capture | 6 |
| `agent_runtime` | Tool-using agent loop; HITL approval, memory, guardrails, durable runs, tracing, webhook delivery | 8 |
| `video_studio` | Concept → script → shots → keyframes → clips → silent episode | 4 |
| `audio_studio` | Voices, dialogue, music, ducked mix, mux → finished A/V (composes video_studio) | 5* |
| `lead_gen` | Source → enrich → score → compliance gate → approval-gated outreach | 8 |
| `platform_core` | Auth, multi-tenancy, RBAC, usage metering + quotas, rate limit, observability | 10 |
| Integration | HTTP-layer tests across all four service APIs + webhook unit tests | 49 |

\* audio_studio tests require `ffmpeg`/`ffprobe`; they are skipped gracefully when absent.

Each package has its own README with details and an API reference at `/docs` when
the service is running.

## Themes that run through every slice

- **Free-first, swappable models.** Product code asks for a capability; the
  gateway's config decides the model. `max_cost_per_job_usd: 0` enforces
  free-only; raise it to allow paid fallback. Nothing in product code names a model.
- **Durable & resumable.** Pipelines and agent runs checkpoint after every step
  (to Postgres when available, disk otherwise) and resume from failure. Long-running
  jobs are offloaded to the ARQ worker so HTTP workers stay responsive.
- **Human-in-the-loop.** Side-effecting actions (notably outreach sends) pause for
  approval; the agent runtime provides the gate, lead-gen uses it, the console
  surfaces it as an inbox.
- **Webhook notifications.** Register HTTP endpoints on `POST /v1/webhooks`;
  the agent runtime delivers HMAC-signed payloads on `run.done` / `run.failed`
  with automatic retry.
- **Child safety by routing.** Kids' content routes through a moderation-gated
  path so only models flagged `moderation_ok` can produce script, dialogue, music.
- **Compliance as a gate.** Lead outreach checks suppression, consent, region, and
  opt-out — upstream and again at send time (defense-in-depth).
- **Multi-tenant + metered.** Every billable action rolls up to a tenant bill with
  spend/job quotas; requests are authenticated, permissioned, rate-limited, traced.

## What's wired vs. what to extend for scale

Fully wired and tested:

- **Auth & tenancy** — PBKDF2 passwords, HMAC-signed JWT, refresh tokens (7-day,
  rotated), API keys, RBAC, rate limiting, quota enforcement.
- **Persistence** — Postgres 16 for tenants/runs/leads/projects; Redis 7 for rate
  buckets and the ARQ job queue. All stores fall back to disk/memory when
  `DATABASE_URL` is unset (keeps offline tests fast).
- **Background jobs** — ARQ worker handles studio pipelines and agent runs.
  `?background=true` on any run endpoint enqueues to Redis; falls back to
  `asyncio` task if Redis is unavailable.
- **Observability** — Structured logs (structlog), Prometheus metrics on `/metrics`
  per service, per-request IDs, tenant context in every span.
- **Frontend** — Full Vite+React console with JWT auth, auto-refresh on 401,
  TanStack Query caching, and an Admin tab (tenant list + create, webhook
  management) visible to admin-role users.

Deliberately thin / extension points:

- **Models** are mocked behind the gateway; wire Ollama / OpenRouter / Bedrock /
  ComfyUI by adding a provider in `model_gateway/providers/`.
- **Durable orchestration** — ARQ is the queue; Temporal would add workflow
  durability, retries, and visibility for very long pipelines.
- **Kubernetes** — Docker Compose is the current target; Helm charts or Kustomize
  manifests are the natural next step for horizontal scaling.
- **Email / SMS delivery** — outreach approval triggers a stub; wire an ESP
  (SendGrid, Postmark) behind the `send_email` tool.

## Legal note

Lead sourcing and automated outreach are heavily regulated (GDPR/CCPA, CAN-SPAM,
and local equivalents) and vary by jurisdiction. The compliance defaults here are
a sensible base to build on — **not legal advice.** Have counsel review your data
sourcing, consent model, and outreach before going live, and prefer licensed data
providers over scraping. Likewise, confirm any real models' licenses permit
commercial and children's-content use.

`implementation-plan.md` (separately provided) maps each package to its backend
phase (B0–B6) and the frontend phases (F0–F5).
