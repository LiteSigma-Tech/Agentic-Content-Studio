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
│  frontend            operator console over all of it  (React prototype)│
├──────────────────────────────────────────────────────────────────────┤
│  platform_core       auth · tenancy · RBAC · metering · quotas ·       │
│                      rate limiting · observability            (B0–B1)  │
├───────────────┬───────────────┬───────────────┬───────────────────────┤
│ video_studio  │ audio_studio  │ lead_gen      │ agent_runtime          │
│ concept →     │ + voices,     │ compliant     │ tools · HITL · memory  │
│ silent ep.    │ music, mix →  │ funnel +      │ guardrails · durable   │
│ (B4)          │ final A/V (B5)│ approval-gated│ runs            (B2)   │
│               │               │ outreach (B3) │                        │
├───────────────┴───────────────┴───────────────┴───────────────────────┤
│  model_gateway       one interface for LLM/image/video/TTS/music;      │
│                      config-driven routing, fallback, free-only,        │
│                      capability gating, per-call cost capture           │
└──────────────────────────────────────────────────────────────────────┘
```

## Quickstart

```bash
pip install -r requirements.txt        # ffmpeg + ffprobe also required for media
./run_all_tests.sh                     # 41 tests across all six backend slices
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

The frontend (`frontend/PlatformConsole.jsx`) is an interactive React prototype of
the operator UI; it renders the dashboard, studio pipeline, lead approval inbox,
and model-settings screen against mock state mirroring these APIs.

## Run with Docker

```bash
docker compose up --build
```

Five services come up from one shared image (ffmpeg included):

| Service | URL (docs at `/docs`) | Notes |
|---|---|---|
| gateway | http://localhost:8001 | the model gateway |
| studio | http://localhost:8002 | video + audio; routes models via the gateway |
| leads | http://localhost:8003 | lead generation |
| agents | http://localhost:8004 | the agent runtime |
| platform | http://localhost:8005 | auth · metering · quotas |

The `studio` and `agents` containers route their model calls to the `gateway`
container over HTTP (`GATEWAY_URL=http://gateway:8000`), and `studio` shares the
gateway's media volume so generated keyframes/clips/audio resolve across
containers — a real end-to-end render flows gateway → studio. Compose waits for
the gateway's healthcheck before starting dependents; named volumes persist
rendered episodes and durable agent/outreach runs.

Set `PLATFORM_SIGNING_KEY` to a stable value in any real deployment so tokens
survive restarts. The production frontend is a separate Next.js image (the file
in `./frontend` is a prototype, not a built app) — a commented stub in
`docker-compose.yml` shows where it slots in.

## The packages

| Package | Phase | What it is | Tests |
|---|---|---|---|
| `model_gateway` | B1 | Swappable, free-first model layer; routing, fallback, capability gating, cost capture | 6 |
| `agent_runtime` | B2 | Tool-using agent loop; HITL approval, memory, guardrails, durable runs, tracing | 8 |
| `video_studio` | B4 | Concept → script → shots → keyframes → clips → silent episode | 4 |
| `audio_studio` | B5 | Voices, dialogue, music, ducked mix, mux → finished A/V (composes B4) | 5 |
| `lead_gen` | B3 | Source → enrich → score → **compliance gate** → approval-gated outreach (on B2) | 8 |
| `platform_core` | B0–B1 | Auth, multi-tenancy, RBAC, usage metering + quotas, rate limit, observability | 10 |
| `frontend` | F0–F5 | Operator console (React prototype) | — |

Each package has its own README with details and an API.

## Themes that run through every slice

- **Free-first, swappable models.** Product code asks for a capability; the
  gateway's config decides the model. `max_cost_per_job_usd: 0` enforces
  free-only; raise it to allow paid fallback. Nothing in product code names a model.
- **Durable & resumable.** Pipelines and agent runs checkpoint after every step
  and resume from failure (maps onto Temporal in production).
- **Human-in-the-loop.** Side-effecting actions (notably outreach sends) pause for
  approval; the agent runtime provides the gate, lead-gen uses it, the console
  surfaces it as an inbox.
- **Child safety by routing.** Kids' content routes through a moderation-gated
  path so only models flagged `moderation_ok` can produce script, dialogue, music.
- **Compliance as a gate.** Lead outreach checks suppression, consent, region, and
  opt-out — upstream and again at send time (defense-in-depth).
- **Multi-tenant + metered.** Every billable action rolls up to a tenant bill with
  spend/job quotas; requests are authenticated, permissioned, rate-limited, traced.

## What's real vs. what's infrastructure to add

Real and tested here: all the **logic** — routing/fallback/cost, the staged
pipelines, the agent loop with HITL/guardrails/memory, the lead funnel and
compliance gates, and the auth/RBAC/metering layer — 41 passing offline tests
plus an end-to-end demo.

Deliberately mocked / left as infrastructure (flags, not hidden gaps):
- **Models** are mocked behind the gateway; wire Ollama / OpenRouter / ComfyUI etc.
- **Auth** is a minimal correct implementation; use a vetted IdP/JWT lib in prod.
- **State** is in-memory / on-disk JSON; use Postgres + Redis in prod.
- **Durable queue** is per-slice checkpoint stores; use Temporal in prod.
- **Frontend** is a clickable prototype; the production app is Next.js + TanStack
  Query + a WebSocket/SSE client on the same design tokens.

## Legal note

Lead sourcing and automated outreach are heavily regulated (GDPR/CCPA, CAN-SPAM,
and local equivalents) and vary by jurisdiction. The compliance defaults here are
a sensible base to build on — **not legal advice.** Have counsel review your data
sourcing, consent model, and outreach before going live, and prefer licensed data
providers over scraping. Likewise, confirm any real models' licenses permit
commercial and children's-content use.

`implementation-plan.md` (separately provided) maps each package to its backend
phase (B0–B6) and the frontend phases (F0–F5).
