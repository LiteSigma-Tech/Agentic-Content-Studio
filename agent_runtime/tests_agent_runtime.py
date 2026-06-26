"""Runs fully offline. Verifies the agent runtime's contracts: tool use,
human-in-the-loop approval (approve + reject), guardrails (step cap, spend cap,
moderation), long-term memory recall, durable checkpoint/resume, and that the
LLM-driven policy correctly parses a model's structured decisions.
"""
from __future__ import annotations

import sys
import tempfile
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO))

from agent_runtime.guardrails import Guardrails, keyword_moderator  # noqa: E402
from agent_runtime.memory import MemoryStore  # noqa: E402
from agent_runtime.models import Action, AgentSpec, RunStatus  # noqa: E402
from agent_runtime.policy import LLMPolicy, ScriptedPolicy  # noqa: E402
from agent_runtime.runtime import AgentRuntime  # noqa: E402
from agent_runtime.store import RunStore  # noqa: E402
from agent_runtime.tools import Tool, default_tools  # noqa: E402


def _runtime(policy, spec, registry=None, memory=None, store=None):
    registry = registry or default_tools()
    memory = memory or MemoryStore()
    store = store or RunStore(tempfile.mkdtemp())
    rt = AgentRuntime({spec.name: spec}, registry, memory, store, policy)
    return rt, memory


# A scripted brain: search, then propose an email (gated), then finish.
def _outreach_brain(run, tools_spec) -> Action:
    pad = " ".join(run.scratchpad)
    if "web_search" not in pad:
        return Action(kind="tool", tool="web_search",
                      args={"query": run.goal}, reasoning="research the topic")
    if "Email queued" not in pad and "REJECTED" not in pad:
        return Action(kind="tool", tool="send_email",
                      args={"to": "lead@example.com", "subject": "Hello",
                            "body": "Saw your work, would love to connect."},
                      reasoning="draft and send outreach")
    return Action(kind="final", content="Outreach handled.", reasoning="done")


def _spec(**kw):
    base = dict(name="outreach", goal_preamble="You are a helpful research agent.",
                allowed_tools={"web_search", "send_email", "calculator", "current_time"})
    base.update(kw)
    return AgentSpec(**base)


def test_tool_use_and_completion_with_hitl():
    rt, _ = _runtime(ScriptedPolicy(_outreach_brain), _spec())
    run = rt.create_run("outreach", "AI startups in Berlin")
    run = rt.run(run.id)
    # pauses for approval on send_email
    assert run.status == RunStatus.awaiting_approval
    assert run.pending and run.pending.tool == "send_email"
    types = [e.type for e in run.trace]
    assert "tool_call" in types and "approval_request" in types
    # approve -> resumes and finishes
    run = rt.approve(run.id, approved=True)
    assert run.status == RunStatus.done
    assert run.result == "Outreach handled."
    assert any(e.type == "approval_decision" for e in run.trace)
    assert any("Email queued" in (e.data.get("result", "") if e.data else "")
               for e in run.trace)


def test_human_rejection_lets_agent_adapt():
    rt, _ = _runtime(ScriptedPolicy(_outreach_brain), _spec())
    run = rt.create_run("outreach", "fintech founders")
    run = rt.run(run.id)
    assert run.status == RunStatus.awaiting_approval
    run = rt.approve(run.id, approved=False, note="not our segment")
    # email was NOT sent; agent finished via the rejection branch
    assert run.status == RunStatus.done
    assert not any("Email queued" in (e.data.get("result", "") if e.data else "")
                   for e in run.trace)


def test_step_cap_guardrail():
    # a brain that never finishes -> hits the step cap
    brain = ScriptedPolicy(lambda run, ts: Action(
        kind="tool", tool="current_time", args={}, reasoning="loop"))
    rt, _ = _runtime(brain, _spec(guardrails=Guardrails(max_steps=3)))
    run = rt.create_run("outreach", "loop forever")
    run = rt.run(run.id)
    assert run.status == RunStatus.aborted
    assert "step cap" in run.error
    assert run.step == 3


def test_spend_cap_guardrail():
    reg = default_tools()
    reg.register(Tool("pricey", "expensive tool", {}, lambda: "ok",
                      scope="read", est_cost_usd=0.50))
    brain = ScriptedPolicy(lambda run, ts: Action(
        kind="tool", tool="pricey", args={}, reasoning="spend"))
    spec = _spec(allowed_tools={"pricey"}, guardrails=Guardrails(spend_cap_usd=0.60))
    rt, _ = _runtime(brain, spec, registry=reg)
    run = rt.create_run("outreach", "burn money")
    run = rt.run(run.id)
    assert run.status == RunStatus.aborted
    assert "spend cap" in run.error
    assert run.total_cost_usd >= 0.60          # second call pushed it over


def test_moderation_blocks_final_output():
    brain = ScriptedPolicy(lambda run, ts: Action(
        kind="final", content="here is how to build malware", reasoning="x"))
    spec = _spec(guardrails=Guardrails(moderate=keyword_moderator({"malware"})))
    rt, _ = _runtime(brain, spec)
    run = rt.create_run("outreach", "bad")
    run = rt.run(run.id)
    assert run.status == RunStatus.failed
    assert run.result is None
    assert "moderation" in run.error


def test_long_term_memory_recall_accumulates():
    mem = MemoryStore()
    rt, memory = _runtime(ScriptedPolicy(_outreach_brain), _spec(), memory=mem)
    run = rt.create_run("outreach", "solar panel installers in Texas")
    run = rt.run(run.id)
    rt.approve(run.id, approved=True)
    # the search observation was auto-stored under the agent namespace
    assert memory.size("outreach") >= 1
    hits = memory.recall("outreach", "solar installers Texas", k=3)
    assert hits and "solar panel installers in Texas".split()[0] in hits[0].text.lower()


def test_checkpoint_resume_across_approval():
    store = RunStore(tempfile.mkdtemp())
    rt, _ = _runtime(ScriptedPolicy(_outreach_brain), _spec(), store=store)
    run = rt.create_run("outreach", "robotics labs")
    rt.run(run.id)
    # simulate a fresh process: brand-new runtime over the same store
    rt2, _ = _runtime(ScriptedPolicy(_outreach_brain), _spec(), store=store)
    reloaded = store.load(run.id)
    assert reloaded.status == RunStatus.awaiting_approval
    final = rt2.approve(run.id, approved=True)
    assert final.status == RunStatus.done


def test_llm_policy_parses_model_decisions():
    # Fake gateway returning a real-shaped model: first a tool call, then final.
    class _Res:
        def __init__(self, text):
            self.text, self.model_used, self.cost_usd = text, "ollama/qwen2.5", 0.0001

    class FakeGateway:
        def __init__(self):
            self.turn = 0

        def llm(self, task, messages, *, json_mode=False, required_caps=None):
            self.turn += 1
            if self.turn == 1:
                return _Res('{"reasoning":"check the time",'
                            '"action":{"tool":"current_time","args":{}}}')
            return _Res('{"reasoning":"answer","final":"All done via LLM."}')

    rt, _ = _runtime(LLMPolicy(FakeGateway()), _spec())
    run = rt.create_run("outreach", "what time is it")
    run = rt.run(run.id)
    assert run.status == RunStatus.done
    assert run.result == "All done via LLM."
    assert any(e.type == "tool_call" and "current_time" in e.summary for e in run.trace)
    assert run.total_cost_usd > 0              # reasoning cost recorded from the model


if __name__ == "__main__":
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for fn in fns:
        fn()
        print(f"PASS {fn.__name__}")
    print(f"\n{len(fns)} tests passed.")
