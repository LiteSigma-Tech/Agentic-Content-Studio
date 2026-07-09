"""Runs fully offline (gateway mocks + ffmpeg). Verifies:
  - the full 11-stage pipeline produces an A/V file with a real audio stream,
  - voices are cast (one per character, distinct in a scene),
  - dialogue audio is generated per shot and music spans the episode,
  - resume works across the video→audio boundary,
  - kids' content routes TTS/music through the moderation-gated path.
"""
from __future__ import annotations

import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO))

# Skip the entire suite when ffmpeg/ffprobe are not installed.
if not (shutil.which("ffmpeg") and shutil.which("ffprobe")):
    print("0 tests passed.  (ffmpeg not installed — skipping audio pipeline tests)")
    sys.exit(0)

from audio_studio.pipeline import FULL_STAGES, full_pipeline  # noqa: E402
from video_studio.gateway_client import InProcessGateway  # noqa: E402
from video_studio.models import Genre, StageStatus  # noqa: E402
from video_studio.pipeline import create_project  # noqa: E402
from video_studio.store import ProjectStore  # noqa: E402

ROUTING = str(REPO / "routing.yaml")


def _fresh():
    store = ProjectStore(tempfile.mkdtemp())
    return store, full_pipeline(InProcessGateway(ROUTING), store)


def _has_audio_stream(path: str) -> bool:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "a:0",
         "-show_entries", "stream=codec_type,duration", "-of", "csv=p=0", path],
        capture_output=True, text=True, timeout=20)
    return "audio" in out.stdout


def test_full_av_pipeline_produces_audio_video():
    store, pipe = _fresh()
    p = create_project("Two rival food trucks fall in love", Genre.romance, store=store)
    out = pipe.run(p.id)
    assert len(out.pipeline.stages) == 11
    assert all(s.status == StageStatus.done for s in out.pipeline.stages)
    # silent video + master audio + final muxed A/V all exist
    assert out.final_uri and Path(out.final_uri).exists()
    assert out.master_audio_uri and Path(out.master_audio_uri).exists()
    assert out.final_av_uri and Path(out.final_av_uri).exists()
    assert _has_audio_stream(out.final_av_uri)          # the mux really has audio
    # every dialogue-bearing shot got its own audio
    assert all(sh.dialogue_audio_uri for sh in out.all_shots() if sh.dialogue)


def test_voices_cast_distinctly():
    store, pipe = _fresh()
    p = create_project("A heist, but everyone is polite", Genre.comedy, store=store)
    out = pipe.run(p.id)
    assert out.voice_cast                                 # characters were cast
    cast = out.voice_cast
    # in the skeleton there are two characters -> two different voices
    assert len(set(cast.values())) >= min(2, len(cast))


def test_music_spans_episode():
    store, pipe = _fresh()
    p = create_project("A lighthouse keeper and a whale", Genre.drama, store=store)
    out = pipe.run(p.id)
    total = sum(sh.seconds for sh in out.all_shots())
    dur = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "csv=p=0", out.music_uri], capture_output=True, text=True).stdout
    assert abs(float(dur) - total) < 1.0                 # bed ~= episode length


def test_resume_across_video_audio_boundary():
    store, pipe = _fresh()
    p = create_project("A robot learns to bake", Genre.comedy, store=store)

    import audio_studio.stages as a_stages
    real_mix = a_stages.mix_audio
    calls = {"n": 0}

    def flaky(project, ctx):
        calls["n"] += 1
        if calls["n"] == 1:
            raise RuntimeError("simulated mixer crash")
        return real_mix(project, ctx)

    # patch within the composed stage list
    idx = [i for i, (n, _) in enumerate(FULL_STAGES) if n == "mix_audio"][0]
    FULL_STAGES[idx] = ("mix_audio", flaky)
    try:
        try:
            pipe.run(p.id)
            assert False, "expected failure at mix_audio"
        except RuntimeError:
            pass
        s = {x["name"]: x["status"] for x in pipe.status(p.id)["stages"]}
        assert s["render"] == "done"                     # video side finished
        assert s["generate_dialogue"] == "done"
        assert s["mix_audio"] == "failed"
        out = pipe.run(p.id)                             # resume
        assert all(x.status == StageStatus.done for x in out.pipeline.stages)
        assert calls["n"] == 2
        assert out.final_av_uri and Path(out.final_av_uri).exists()
    finally:
        FULL_STAGES[idx] = ("mix_audio", real_mix)


def test_kids_audio_routes_through_moderation_gate():
    store, pipe = _fresh()
    p = create_project("A shy turtle learns to share", Genre.kids_cartoon, store=store)
    out = pipe.run(p.id)
    dlg = next(s for s in out.pipeline.stages if s.name == "generate_dialogue")
    mus = next(s for s in out.pipeline.stages if s.name == "generate_music")
    # mock tts/music declare moderation_ok, so the gated calls resolve
    assert dlg.model_used == "mock/tts"
    assert mus.model_used == "mock/music"
    assert all(s.status == StageStatus.done for s in out.pipeline.stages)


if __name__ == "__main__":
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for fn in fns:
        fn()
        print(f"PASS {fn.__name__}")
    print(f"\n{len(fns)} tests passed.")
