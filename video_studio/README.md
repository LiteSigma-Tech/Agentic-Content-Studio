# Video Studio (Pipeline B4)

The episodic video generation pipeline — the second slice of the platform. It
turns a one-line concept + genre into a finished episode by running six staged,
**durable, resumable** steps, each calling the Model Gateway from the first
slice. Runs fully offline (mock models + ffmpeg); plug in real free/open models
via the gateway and the same pipeline produces real footage.

## The pipeline

```
concept + genre
   │
   ├─ write_script        LLM → structured shot list (genre template shapes it)
   ├─ design_characters   image → one reference per character (reused = consistency)
   ├─ generate_keyframes  image → a keyframe per shot
   ├─ generate_clips      video → a clip per shot (keyframe as init image)
   ├─ assemble            → manifest.json (timeline / edit-decision-list)
   └─ render              ffmpeg → final.mp4
```

Each stage is **idempotent** and the project is **checkpointed to disk after
every stage**, so an interrupted or failed run resumes from the first
incomplete stage. In production this maps directly onto a Temporal workflow
(each stage an activity) + Postgres; here it's the same logic with zero infra.

## Genres

`drama`, `romance`, `comedy`, `kids_cartoon`. Each template sets tone, structure
(beats), pacing, visual style, and **which gateway LLM task** the script runs
under. `kids_cartoon` routes through the gateway's `kids_content` task, which is
gated on the `moderation_ok` capability — so only models vetted as
child-safe can produce it. (Flag, not legal advice: confirm your real models and
their licenses are appropriate for children's content before shipping.)

## Run it

```bash
pip install -r ../requirements.txt           # fastapi, pydantic, pyyaml, httpx, uvicorn
# ffmpeg + ffprobe must be on PATH for the render stage
python tests_video_pipeline.py               # 4 offline tests (incl. real mp4 + resume)
uvicorn video_studio.api:app --reload        # from the repo root; docs at /docs
```

```bash
PID=$(curl -s localhost:8000/v1/projects -H 'content-type: application/json' \
  -d '{"concept":"A cat tries to run a coffee shop","genre":"comedy"}' | jq -r .id)
curl -s localhost:8000/v1/projects/$PID/run -H 'content-type: application/json' -d '{}'
curl -s localhost:8000/v1/projects/$PID            # per-stage status + cost + output uris
```

`run` accepts `{"background": true}` to run async and poll status, and
`{"force_from": "generate_clips"}` to re-run from a chosen stage.

## How it consumes the gateway

The pipeline only talks to a `Gateway` interface with two implementations:

- **InProcessGateway** (default): imports the gateway's `Router` directly.
- **HttpGateway**: set `GATEWAY_URL=http://host:8000` to call the gateway service
  over HTTP instead — no pipeline code changes.

So the model layer can be in-process or a separate service, and *which* model
each step uses is still controlled entirely by the gateway's `routing.yaml`.

## Offline behaviour (honest notes)

- With the gateway's **mock** models: the script stage synthesizes a coherent
  shot list from the genre beats (real LLMs return a richer JSON script), and
  keyframes/clips are placeholders. The **render stage is real** — ffmpeg
  produces an actual `.mp4` whose length matches the timeline (colored slates
  per shot offline; your real clips once a video model is configured).
- Plug a real LLM into the gateway (`OLLAMA_HOST`, etc.) and the script becomes
  a real written episode. Plug ComfyUI (`COMFYUI_URL`) and keyframes/clips
  become real footage that the render stage concatenates.

## Files

```
video_studio/
  models.py          # Project/Episode/Scene/Shot/Character + pipeline state
  genres.py          # genre templates (tone, beats, style, safety routing)
  gateway_client.py  # InProcessGateway + HttpGateway behind one interface
  store.py           # durable project store (checkpoint / resume)
  stages.py          # the six stage functions
  render.py          # manifest builder + ffmpeg render
  pipeline.py        # orchestrator: order, checkpoint, resume, progress, cost
  api.py             # FastAPI: create / run / status
  tests_video_pipeline.py
demo_output/         # a sample generated episode (mp4 + manifest + project json)
```

## Next slice

**Audio Studio (B5):** TTS for the dialogue already in each shot, music + SFX,
mix, then mux onto this pipeline's video. The shot list already carries
`dialogue` per shot, so B5 plugs straight in before the render step.
