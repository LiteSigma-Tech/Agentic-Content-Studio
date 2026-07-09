"""Runs fully offline against the gateway's mock providers. Verifies:
  - the full 6-stage pipeline runs end to end and produces a real .mp4,
  - checkpoints are written and a failed run resumes from the failed stage,
  - kids' content routes through the moderation-gated task,
  - cost is accumulated per stage.
"""
from __future__ import annotations

import shutil
import sys
import tempfile
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO))

from video_studio.gateway_client import InProcessGateway  # noqa: E402
from video_studio.models import Genre, StageStatus  # noqa: E402
from video_studio.pipeline import Pipeline, create_project  # noqa: E402
from video_studio.store import ProjectStore  # noqa: E402

ROUTING = str(REPO / "routing.yaml")

_HAS_FFMPEG = shutil.which("ffmpeg") is not None and shutil.which("ffprobe") is not None


def _assert_video(path_or_none: str | None) -> None:
    """Assert the rendered video exists — or that it's None when ffmpeg is absent."""
    if _HAS_FFMPEG:
        assert path_or_none and Path(path_or_none).exists(), \
            f"expected a rendered .mp4 but got {path_or_none!r}"
        assert Path(path_or_none).stat().st_size > 0
    else:
        assert path_or_none is None, \
            f"ffmpeg absent — expected None final_uri but got {path_or_none!r}"


def _fresh():
    store = ProjectStore(tempfile.mkdtemp())
    gw = InProcessGateway(ROUTING)
    return store, Pipeline(gw, store)


def test_full_pipeline_produces_video():
    store, pipe = _fresh()
    p = create_project("Two rival food trucks fall in love", Genre.romance, store=store)
    out = pipe.run(p.id)
    assert all(s.status == StageStatus.done for s in out.pipeline.stages)
    assert len(out.pipeline.stages) == 6
    assert out.manifest_uri and Path(out.manifest_uri).exists()
    _assert_video(out.final_uri)
    # every shot got a keyframe and a clip
    assert all(sh.keyframe_uri and sh.clip_uri for sh in out.all_shots())


def test_checkpoint_resume_after_failure():
    store, pipe = _fresh()
    p = create_project("A detective who can't stop crying", Genre.drama, store=store)

    # Break the clip stage on first attempt to force a failure mid-pipeline.
    import video_studio.stages as stages
    real_clips = stages.generate_clips
    calls = {"n": 0}

    def flaky(project, ctx):
        calls["n"] += 1
        if calls["n"] == 1:
            raise RuntimeError("simulated video backend outage")
        return real_clips(project, ctx)

    stages.STAGES[3] = ("generate_clips", flaky)
    try:
        try:
            pipe.run(p.id)
            assert False, "expected failure"
        except RuntimeError:
            pass

        # checkpoint shows script/characters/keyframes done, clips failed
        s = pipe.status(p.id)
        by = {x["name"]: x["status"] for x in s["stages"]}
        assert by["write_script"] == "done"
        assert by["generate_keyframes"] == "done"
        assert by["generate_clips"] == "failed"

        # resume: completed stages are skipped, clips retried, run finishes
        out = pipe.run(p.id)
        assert all(x.status == StageStatus.done for x in out.pipeline.stages)
        assert calls["n"] == 2          # clip stage attempted exactly twice total
        _assert_video(out.final_uri)
    finally:
        stages.STAGES[3] = ("generate_clips", real_clips)


def test_kids_content_routes_through_moderation_gate():
    store, pipe = _fresh()
    p = create_project("A shy turtle learns to share", Genre.kids_cartoon, store=store)
    out = pipe.run(p.id)
    script = next(s for s in out.pipeline.stages if s.name == "write_script")
    # the gateway's mock model declares moderation_ok, so the gated task resolves
    assert script.status == StageStatus.done
    assert script.model_used == "mock/echo-llm"
    assert all(s.status == StageStatus.done for s in out.pipeline.stages)


def test_cost_is_tracked():
    store, pipe = _fresh()
    p = create_project("Office workers vs a haunted printer", Genre.comedy, store=store)
    out = pipe.run(p.id)
    # mocks are free, so total is 0.0 — but the field exists and aggregates.
    assert isinstance(out.pipeline.total_cost_usd, float)
    assert out.pipeline.total_cost_usd == 0.0


if __name__ == "__main__":
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for fn in fns:
        fn()
        print(f"PASS {fn.__name__}")
    print(f"\n{len(fns)} tests passed.")
