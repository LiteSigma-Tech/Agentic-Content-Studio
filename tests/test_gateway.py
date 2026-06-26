"""Runs fully offline (mock providers). Verifies the gateway's core promises:
swappable routing, capability filtering, free-only cost policy, automatic
fallback, and runtime config switching."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from model_gateway import (  # noqa: E402
    Cap, ConfigStore, LLMMessage, NoEligibleProvider, Policy, ProviderError,
    Registry, Router, RoutingConfig, TaskRoute, build_registry,
)
from model_gateway.providers.llm import EchoLLMProvider  # noqa: E402


def _store(routing, policy=None):
    return ConfigStore(RoutingConfig(routing=routing, policy=policy or Policy()))


def test_basic_llm_route():
    reg = build_registry()
    store = _store({"llm": {"script_writing": TaskRoute(default="mock/echo-llm")}})
    out = Router(reg, store).execute(
        "llm", "script_writing",
        lambda p: p.generate([LLMMessage("user", "Write a comedy cold open")]))
    assert out.model_id == "mock/echo-llm"
    assert "comedy cold open" in out.result.text
    assert out.cost_usd == 0.0


def test_capability_filter_excludes_incapable_model():
    reg = Registry()
    reg.register("llm", EchoLLMProvider("weak"))            # no function_calling
    # 'weak' lacks function_calling, so an agent_reasoning route requiring it
    # should find no eligible provider.
    store = _store({"llm": {"agent": TaskRoute(default="weak",
                                               require=[Cap.FUNCTION_CALLING])}})
    # remove the cap to simulate an incapable model
    reg.get("llm", "weak").capabilities = set()
    try:
        Router(reg, store).candidates("llm", "agent")
        Router(reg, store).execute("llm", "agent", lambda p: p.generate([]))
        assert False, "expected NoEligibleProvider"
    except NoEligibleProvider:
        pass


def test_free_only_cost_policy_blocks_paid_model():
    reg = Registry()
    paid = EchoLLMProvider("paid/model")
    paid.est_cost_usd = 0.02          # costs money
    reg.register("llm", paid)
    store = _store({"llm": {"t": TaskRoute(default="paid/model")}},
                   policy=Policy(max_cost_per_job_usd=0.0))  # free-only
    try:
        Router(reg, store).execute("llm", "t", lambda p: p.generate([]))
        assert False, "free-only policy should have blocked the paid model"
    except NoEligibleProvider:
        pass
    # raise the ceiling -> now it's allowed
    store.set(RoutingConfig(routing={"llm": {"t": TaskRoute(default="paid/model")}},
                            policy=Policy(max_cost_per_job_usd=1.0)))
    out = Router(reg, store).execute("llm", "t", lambda p: p.generate([]))
    assert out.model_id == "paid/model"


def test_automatic_fallback_on_provider_failure():
    reg = Registry()

    class Flaky(EchoLLMProvider):
        def generate(self, *a, **k):
            raise ProviderError("simulated rate limit")

    reg.register("llm", Flaky("free/flaky"))
    reg.register("llm", EchoLLMProvider("free/backup"))
    store = _store({"llm": {"t": TaskRoute(default="free/flaky",
                                           fallbacks=["free/backup"])}})
    out = Router(reg, store).execute("llm", "t", lambda p: p.generate(
        [LLMMessage("user", "hi")]))
    assert out.model_id == "free/backup"
    assert out.attempts == ["free/flaky", "free/backup"]   # tried flaky first


def test_runtime_switch_changes_model():
    reg = Registry()
    reg.register("llm", EchoLLMProvider("model/a"))
    reg.register("llm", EchoLLMProvider("model/b"))
    store = _store({"llm": {"t": TaskRoute(default="model/a")}})
    r = Router(reg, store)
    assert r.execute("llm", "t", lambda p: p.generate([])).model_id == "model/a"
    # swap at runtime — no redeploy
    store.set(RoutingConfig(routing={"llm": {"t": TaskRoute(default="model/b")}}))
    assert r.execute("llm", "t", lambda p: p.generate([])).model_id == "model/b"


def test_media_pipeline_runs_offline():
    reg = build_registry()
    store = _store({
        "image": {"default": TaskRoute(default="mock/image")},
        "video": {"default": TaskRoute(default="mock/video")},
        "tts": {"default": TaskRoute(default="mock/tts")},
        "music": {"default": TaskRoute(default="mock/music")},
    })
    r = Router(reg, store)
    img = r.execute("image", "default", lambda p: p.generate("a sunset"))
    vid = r.execute("video", "default", lambda p: p.generate("a sunset", seconds=4))
    tts = r.execute("tts", "default", lambda p: p.synthesize("Hello there"))
    mus = r.execute("music", "default", lambda p: p.generate("soft piano"))
    for out in (img, vid, tts, mus):
        assert Path(out.result.uri).exists()    # a real file was produced


if __name__ == "__main__":
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for fn in fns:
        fn()
        print(f"PASS {fn.__name__}")
    print(f"\n{len(fns)} tests passed.")
