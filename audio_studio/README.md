# Audio Studio (B5)

The audio generation + mix slice — third piece of the platform. It takes the
dialogue each shot already carries from the video pipeline (B4), gives every
character a voice, generates a music bed, mixes them with ducking, and muxes the
result onto the silent video. The final deliverable is a single playable
audio-visual `.mp4` (`final_av_uri`).

Runs fully offline (gateway mocks + ffmpeg); plug a real TTS/music model into
the gateway and the same stages produce real voices and score.

## The composed pipeline

B5 doesn't replace B4 — it extends it into one durable, resumable run:

```
write_script → design_characters → generate_keyframes → generate_clips →
assemble → render            ← video (B4), silent mp4
cast_voices → generate_dialogue → generate_music → mix_audio → mux   ← audio (B5)
                                                                    └─ final_av.mp4
```

All 11 stages share the same orchestrator, checkpointing, and resume — a crash
in `mix_audio` resumes there without re-rendering video (covered by a test).

## The audio stages

- **cast_voices** — assigns a voice per character (deterministic, genre-aware;
  two characters in a scene get different voices). See `voices.py`.
- **generate_dialogue** — per shot, concatenates its lines and calls the gateway
  `tts` modality with the speaker's voice; places the result at the shot.
- **generate_music** — calls the gateway `music` modality for a bed spanning the
  whole episode.
- **mix_audio** — places each shot's dialogue at its timeline offset (`adelay`),
  **ducks the music under dialogue** (`sidechaincompress`), and mixes to one
  master track aligned to the video timeline.
- **mux** — combines the silent video (`final_uri`) with the master audio into
  `final_av_uri` (`-c:v copy -c:a aac`).

## Child-safety routing carries through

For `kids_cartoon`, the TTS and music calls pass the genre's `required_caps`
(`moderation_ok`), so — exactly like the script and video stages — kids' audio
can only be produced by models the gateway has vetted as safe. (Flag, not legal
advice: verify your real audio models/licenses suit children's content.)

## Run it

```bash
pip install -r ../requirements.txt           # ffmpeg + ffprobe also required
python tests_audio_pipeline.py               # 5 offline tests (incl. real A/V + resume)
uvicorn audio_studio.api:app --reload        # from the repo root; docs at /docs
```

```bash
PID=$(curl -s localhost:8000/v1/projects -H 'content-type: application/json' \
  -d '{"concept":"A shy turtle learns to share","genre":"kids_cartoon"}' | jq -r .id)
curl -s localhost:8000/v1/projects/$PID/run -H 'content-type: application/json' -d '{}'
# response includes all 11 stages, total cost, and final_av output
```

## Offline behaviour (honest notes)

- With the gateway's **mock** TTS/music: dialogue is a soft per-voice
  placeholder tone (distinct timbre per character) sized to the line, and music
  is a quiet drone — but the **mix and mux are real**: the output `.mp4` has a
  genuine AAC audio stream, ducked under dialogue, synced to shot timings.
- Plug a real TTS provider (Kokoro/XTTS via ComfyUI, etc.) and `generate_dialogue`
  uses its audio directly — no stage changes. Same for a music model.

## Files

```
audio_studio/
  voices.py             # voice library + deterministic, genre-aware casting
  synth.py              # ffmpeg: speech/music synthesis, ducked mix, A/V mux
  stages.py             # cast_voices, generate_dialogue, generate_music, mix_audio, mux
  pipeline.py           # FULL_STAGES = video (B4) + audio (B5); full_pipeline()
  api.py                # FastAPI: create / run / status (final deliverable = A/V)
  tests_audio_pipeline.py
demo_output/            # a sample episode WITH audio (mp4 + master wav + project json)
```

## Where this leaves the build

Three slices done and composing cleanly: **Model Gateway** → **Video Studio (B4)**
→ **Audio Studio (B5)**, producing a finished audio-visual episode from a
one-line concept, all model-swappable via the gateway. Still ahead: the **Agent
Runtime (B2)**, **Lead Generation (B3)**, platform pillars (auth, durable
queue/Temporal, metering), and the **frontend**.
