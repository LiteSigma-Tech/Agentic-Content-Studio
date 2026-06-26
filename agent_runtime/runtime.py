"""The agent runtime.

A stateful loop: ask the policy for the next action; execute tools (auto-storing
results to long-term memory); pause for human approval on side-effecting tools;
enforce guardrails (step cap, spend cap, output moderation); checkpoint after
every step so the run is durable and resumable. Every step is recorded to an
auditable trace.

This is a self-contained equivalent of a LangGraph agent with checkpointing; the
loop logic maps directly onto a LangGraph/Temporal implementation in production.
"""
from __future__ import annotations

import uuid
from typing import Callable

from .memory import MemoryStore
from .models import Action, AgentRun, AgentSpec, PendingApproval, RunStatus
from .policy import Policy
from .store import RunStore
from .tools import ToolError, ToolRegistry


class AgentRuntime:
    def __init__(self, specs: dict[str, AgentSpec], registry: ToolRegistry,
                 memory: MemoryStore, store: RunStore, policy: Policy,
                 on_event: Callable[[AgentRun, str], None] | None = None):
        self.specs = specs
        self.registry = registry
        self.memory = memory
        self.store = store
        self.policy = policy
        self.on_event = on_event or (lambda r, e: None)

    # --- lifecycle ----------------------------------------------------------
    def create_run(self, agent: str, goal: str) -> AgentRun:
        spec = self.specs[agent]
        rid = uuid.uuid4().hex[:12]
        run = AgentRun(id=rid, agent=agent, goal=goal,
                       memory_namespace=spec.memory_namespace or agent)
        self.store.save(run)
        return run

    def run(self, run_id: str) -> AgentRun:
        run = self.store.load(run_id)
        if run.status in (RunStatus.done, RunStatus.failed, RunStatus.aborted):
            return run
        return self._drive(run)

    def approve(self, run_id: str, approved: bool, note: str = "") -> AgentRun:
        run = self.store.load(run_id)
        if run.status != RunStatus.awaiting_approval or not run.pending:
            raise RuntimeError("run is not awaiting approval")
        pa = run.pending
        run.log(type="approval_decision",
                summary=f"{'approved' if approved else 'rejected'} {pa.tool}",
                data={"tool": pa.tool, "args": pa.args, "approved": approved, "note": note})
        if approved:
            self._execute_tool(run, pa.tool, pa.args, approved=True)
        else:
            run.scratchpad.append(
                f"A human REJECTED calling {pa.tool} (note: {note or 'none'}). "
                "Choose a different approach or finish.")
        run.pending = None
        run.status = RunStatus.running
        self.store.save(run)
        return self._drive(run)

    # --- core loop ----------------------------------------------------------
    def _drive(self, run: AgentRun) -> AgentRun:
        spec = self.specs[run.agent]
        gr = spec.guardrails
        tools_spec = self.registry.describe(spec.allowed_tools)

        while True:
            if run.step >= gr.max_steps:
                run.status = RunStatus.aborted
                run.error = f"step cap reached ({gr.max_steps})"
                run.log(type="guardrail", summary=run.error)
                break

            action: Action = self.policy.next_action(run, spec.goal_preamble, tools_spec)
            run.step += 1
            run.total_cost_usd = round(run.total_cost_usd + action.cost_usd, 6)
            run.log(type="think", summary=action.reasoning or "(no reasoning)",
                    model=action.model, cost_usd=action.cost_usd)

            if run.total_cost_usd > gr.spend_cap_usd:
                run.status = RunStatus.aborted
                run.error = f"spend cap exceeded (${gr.spend_cap_usd})"
                run.log(type="guardrail", summary=run.error,
                        data={"total_cost_usd": run.total_cost_usd})
                break

            if action.kind == "final":
                ok, reason = gr.moderate(action.content)
                if not ok:
                    run.status = RunStatus.failed
                    run.error = f"output blocked by moderation ({reason})"
                    run.log(type="guardrail", summary=run.error)
                    break
                run.result = action.content
                run.status = RunStatus.done
                run.log(type="final", summary=action.content[:160])
                break

            # tool action
            tool = self.registry.get(action.tool)
            if action.tool not in spec.allowed_tools or tool is None:
                run.status = RunStatus.failed
                run.error = f"tool not permitted: {action.tool}"
                run.log(type="guardrail", summary=run.error)
                break

            if tool.requires_approval:
                run.pending = PendingApproval(tool=tool.name, args=action.args,
                                              reason=action.reasoning)
                run.status = RunStatus.awaiting_approval
                run.log(type="approval_request",
                        summary=f"{tool.name} needs human approval",
                        data={"tool": tool.name, "args": action.args})
                self.on_event(run, "awaiting_approval")
                self.store.save(run)
                return run                      # PAUSE for human-in-the-loop

            self._execute_tool(run, tool.name, action.args, approved=False,
                               reasoning=action.reasoning)
            self.store.save(run)                # checkpoint each step

        self.store.save(run)
        self.on_event(run, run.status.value)
        return run

    # --- tool execution -----------------------------------------------------
    def _execute_tool(self, run: AgentRun, name: str, args: dict, *,
                      approved: bool, reasoning: str = "") -> None:
        tool = self.registry.get(name)
        run.total_cost_usd = round(run.total_cost_usd + tool.est_cost_usd, 6)
        run.log(type="tool_call", summary=f"{name}({args})",
                data={"args": args, "approved": approved}, cost_usd=tool.est_cost_usd)
        try:
            result = tool.fn(**args)
            obs = f"{name} -> {result}"
            run.log(type="tool_result", summary=str(result)[:160], data={"result": result})
        except ToolError as e:
            obs = f"{name} ERROR: {e}"
            run.log(type="error", summary=str(e))
        run.scratchpad.append(obs)
        # auto-store every observation to long-term memory (namespaced per agent)
        self.memory.remember(run.memory_namespace, obs,
                             meta={"run": run.id, "tool": name})
