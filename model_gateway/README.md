# Model Gateway

The config-driven, swappable, **free-first** model layer for the agentic
content + lead platform. Product code asks for a *capability*
(`generate_video`, `synthesize_speech`); a config layer decides which model
actually runs. **Swapping a model is a config change, not a code change.**

This is the spine of the larger platform — the lead-gen, video studio, and
audio studio services all call through this gateway. It is intentionally the
first thing built.

## What it does

- One interface per modality: **LLM, image, video, TTS, music**.
- Every provider — free hosted, self-hosted open-weight, or paid — implements
  the same contract, so they're interchangeable.
- **Config-driven routing** per task, with an ordered fallback chain.
- **Capability filtering**: a task that needs `function_calling` or
  `moderation_ok` (kids' content) only routes to models that declare it.
- **Cost policy**: `max_cost_per_job_usd: 0.0` enforces *free-only*; raise it to
  permit paid fallbacks.
- **Automatic fallback** when a free tier is rate-limited or down.
- **Runtime switching** via `PUT /v1/config/routing` — the next job uses the
  new selection, no redeploy.
- Runs **fully offline** out of the box (mock providers, no GPU, no API keys).

## Run it

```bash
pip install -r requirements.txt
python tests/test_gateway.py          # 6 offline tests
uvicorn app.main:app --reload         # http://127.0.0.1:8000/docs
```

Try it:

```bash
curl -s localhost:8000/v1/llm -H 'content-type: application/json' \
  -d '{"task":"script_writing","messages":[{"role":"user","content":"Write a comedy cold open"}]}'

curl -s localhost:8000/v1/providers        # catalogue (drives the UI model picker)
curl -s localhost:8000/v1/config/routing   # current routing
```

## Switch / configure models

Two ways:

1. **Edit `routing.yaml`** and restart — declarative, version-controlled.
2. **`PUT /v1/config/routing`** with a new config body — live, no restart.

```yaml
routing:
  llm:
    script_writing:  { default: "ollama/qwen2.5:32b" }            # local, free
    agent_reasoning: { default: "groq/llama-3.3-70b", require: ["function_calling"] }
    kids_content:    { default: "ollama/llama3.1:8b", require: ["moderation_ok"] }
  video: { default: { default: "comfyui/ltx-video" } }
policy:
  max_cost_per_job_usd: 0.0     # free-only; raise to allow paid fallback
  prefer: "route_order"         # or cheapest | fastest | best_quality
```

`model_id`s must match providers registered in `model_gateway/bootstrap.py`
(see `GET /v1/providers`).

## Plug in real free/open models

Mocks ship enabled so it runs with zero setup. To go real **and** free, set env
vars and the matching providers auto-register in `bootstrap.py`:

| Env var | Enables | Notes |
|---|---|---|
| `OLLAMA_HOST` | local open LLMs (Qwen, Llama, Mistral…) | truly free, self-hosted, via LiteLLM |
| `OPENROUTER_API_KEY` | OpenRouter `:free` models | hosted, rate-limited |
| `COMFYUI_URL` | image / video / TTS / music | self-hosted open models (FLUX, LTX-Video, Kokoro, MusicGen) |

For real LLM calls also `pip install litellm`. Then point `routing.yaml` at the
new `model_id`s. Add new providers by implementing the relevant Protocol in
`model_gateway/interfaces.py` and registering it in `bootstrap.py`.

> **Honest note on "free":** open LLMs, image, and TTS are excellent for free.
> Text-to-video and music still trail paid tools and need real GPUs (free of
> API fees, not free of compute). The design lets you run *those two* on a paid
> provider while everything else stays free — and swap later as open models
> improve. Check each open model's license permits commercial use, especially
> for kids' content. (Flag, not legal advice.)

## Layout

```
model_gateway/
  interfaces.py    # capability contracts + result types
  config.py        # routing config models + hot-swappable store
  registry.py      # available providers + capabilities (feeds the UI)
  router.py        # task -> eligible providers -> execute with fallback
  bootstrap.py     # registers providers (mocks always; real on env vars)
  providers/
    llm.py         # LiteLLM (Ollama/OpenRouter/…) + offline echo mock
    media.py       # ComfyUI image/video/tts/music adapters + offline mocks
app/main.py        # FastAPI: generate endpoints + runtime config switching
routing.yaml       # default config (points at free mocks)
tests/test_gateway.py
```

## How this fits the bigger plan

This implements **§2 (Model configuration)** and **Phase B1's Model Gateway**
from the implementation plan. Next slices that plug into it: the agent runtime
(B2), then the video pipeline (B4) and audio pipeline (B5) calling these
endpoints, then lead gen (B3).
