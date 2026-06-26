# Agent Runtime (B2)

The agentic backbone of the platform — a stateful, tool-using agent loop with
human-in-the-loop approval, long-term memory, guardrails, full run tracing, and
durable checkpoint/resume. The Lead Generation service (B3) and other autonomous
features are built on top of this; it's a self-contained equivalent of a
LangGraph agent with checkpointing, mapping directly onto LangGraph/Temporal in
production.

Runs fully offline. The agent's "brain" (the policy) is pluggable: a real
**LLMPolicy** drives via the Model Gateway, while a deterministic
**ScriptedPolicy** runs the offline demo/tests — the runtime mechanics are
identical either way.

## What the runtime does, per step

```
ask policy → think → (call a tool | finish)
                         │
       tool ────────────┤
                         ├─ needs approval? → PAUSE (human-in-the-loop) → approve/reject
                         └─ run tool → observe → auto-store to long-term memory
finish → moderate output → done
guardrails (step cap, spend cap, moderation) enforced around every step
checkpoint after every step → durable & resumable
```

Every step is appended to an **auditable trace** (think / tool_call /
tool_result / approval_request / approval_decision / final / guardrail).

## Key properties (all covered by tests)

- **Permissioned tools.** Each tool declares a scope and arg schema; an agent is
  granted a subset of tool names and the runtime refuses anything else.
- **Human-in-the-loop.** Side-effecting tools (`requires_approval=True`, e.g.
  `send_email`) pause the run; `approve(approved=True)` resumes and executes,
  `approve(approved=False)` feeds the rejection back so the agent adapts.
- **Guardrails.** Per-run **step cap**, **spend cap** (reasoning + tool cost; pairs
  with the gateway's free-only policy), and an **output moderation** hook (a
  stricter `kids_moderator` is provided for child-directed agents).
- **Long-term memory.** Every observation is auto-stored, namespaced per agent,
  and recallable by similarity. Offline uses bag-of-words cosine; production
  swaps in pgvector + a real embedding model behind the same interface.
- **Durable.** Runs are checkpointed every step, so a run paused for approval (or
  crashed) resumes in a fresh process from exactly where it stopped.

## Run it

```bash
pip install -r ../requirements.txt
python tests_agent_runtime.py                # 8 offline tests
uvicorn agent_runtime.api:app --reload       # from repo root; docs at /docs
```

```bash
RID=$(curl -s localhost:8000/v1/agents/researcher/runs \
  -H 'content-type: application/json' -d '{"goal":"solar installers in Austin"}' | jq -r .id)
curl -s localhost:8000/v1/runs/$RID/run                      # -> awaiting_approval (send_email)
curl -s localhost:8000/v1/runs/$RID/approve -H 'content-type: application/json' -d '{"approved":true}'
curl -s localhost:8000/v1/runs/$RID/trace                    # full auditable step trace
```

Set `AGENT_LLM_POLICY=1` to use the real LLMPolicy (needs a tool-calling model
configured in the gateway). `demo_output/sample_run_trace.json` is a captured run.

## How the brain is pluggable

```python
LLMPolicy(gateway)        # prompts gateway LLM (agent_reasoning, needs function_calling),
                          # parses {"reasoning":..,"action":{tool,args}} | {"final":..}
ScriptedPolicy(fn)        # deterministic fn(run, tools) -> Action, for tests/offline
```

`test_llm_policy_parses_model_decisions` proves LLMPolicy correctly drives the
runtime when given a real-shaped model (a stub returning tool-call then final
JSON), so it works as soon as you point the gateway at Ollama/OpenRouter/etc.

## Files

```
agent_runtime/
  tools.py        # ToolRegistry + permissioned, typed built-in tools
  memory.py       # long-term memory (offline cosine; pgvector in prod)
  guardrails.py   # step cap, spend cap, moderation hooks (+ kids_moderator)
  models.py       # Action, AgentSpec, AgentRun, TraceEvent
  store.py        # durable run store (checkpoint / resume)
  policy.py       # LLMPolicy + ScriptedPolicy
  runtime.py      # the agent loop: tools, HITL, guardrails, memory, tracing
  api.py          # FastAPI: create / run / approve / status / trace
  tests_agent_runtime.py
demo_output/      # a captured run trace
```

## Where this leaves the build

Four slices now compose: **Model Gateway** → **Video Studio (B4)** → **Audio
Studio (B5)**, and the **Agent Runtime (B2)** as the autonomy backbone. Natural
next: **Lead Generation (B3)** — sourcing/enrichment/scoring/outreach built as
agents on this runtime, with the approval gate guarding every send. Still ahead
after that: platform pillars (auth, durable queue/Temporal, metering) and the
frontend.
