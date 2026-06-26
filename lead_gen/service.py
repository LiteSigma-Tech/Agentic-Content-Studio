"""LeadGenService — orchestrates the funnel end to end:

  source -> enrich -> dedupe -> score/qualify -> compliance gate -> outreach (HITL) -> export

Outreach is delegated to the Agent Runtime (B2): each send is an agent run that
pauses for human approval. Lead state is in-memory here for a runnable demo; in
production it's Postgres + the durable run store.
"""
from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from agent_runtime.guardrails import Guardrails  # noqa: E402
from agent_runtime.memory import MemoryStore  # noqa: E402
from agent_runtime.models import AgentSpec  # noqa: E402
from agent_runtime.policy import ScriptedPolicy  # noqa: E402
from agent_runtime.runtime import AgentRuntime  # noqa: E402
from agent_runtime.store import RunStore  # noqa: E402

from .compliance import SuppressionList, contactability
from .models import ICP, Lead, LeadStatus, OutreachRecord, SequenceStep
from .outreach import make_outreach_registry, outreach_brain
from .providers import LeadProvider, MockLeadProvider
from .scoring import qualify


class LeadGenService:
    def __init__(self, provider: LeadProvider | None = None,
                 runs_root: str = "/tmp/leadgen_runs"):
        self.provider = provider or MockLeadProvider()
        self.icp = ICP()
        self.leads: dict[str, Lead] = {}
        self.suppression = SuppressionList()
        self.outreach: dict[str, OutreachRecord] = {}   # run_id -> record

        # Outreach runtime (B2) with a compliance-aware, approval-gated send tool.
        registry = make_outreach_registry(self.suppression, on_sent=self._mark_sent)
        spec = AgentSpec(name="outreach",
                         goal_preamble="You send approved, compliant outreach only.",
                         allowed_tools={"send_email"},
                         guardrails=Guardrails(max_steps=5, spend_cap_usd=1.0))
        self.runtime = AgentRuntime({"outreach": spec}, registry, MemoryStore(),
                                    RunStore(runs_root), ScriptedPolicy(outreach_brain))

    # --- funnel -------------------------------------------------------------
    def set_icp(self, icp: ICP) -> None:
        self.icp = icp

    def source(self, n: int = 20) -> int:
        for lead in self.provider.search(n):
            self.leads[lead.id] = lead
        return self._enrich_and_dedupe()

    def _enrich_and_dedupe(self) -> int:
        seen: dict[str, str] = {}            # dedupe_key -> kept lead id
        removed = []
        for lid, lead in list(self.leads.items()):
            lead.email = lead.email.strip().lower()
            lead.dedupe_key = lead.email or f"{lead.name}|{lead.company}".lower()
            if lead.status == LeadStatus.sourced:
                lead.status = LeadStatus.enriched
            if lead.dedupe_key in seen:
                removed.append(lid)
            else:
                seen[lead.dedupe_key] = lid
        for lid in removed:
            del self.leads[lid]
        return len(self.leads)

    def score_and_qualify(self) -> dict:
        for lead in self.leads.values():
            qualify(lead, self.icp)
        q = [l for l in self.leads.values() if l.status == LeadStatus.qualified]
        return {"total": len(self.leads), "qualified": len(q),
                "disqualified": len(self.leads) - len(q)}

    # --- compliance ---------------------------------------------------------
    def apply_compliance(self) -> dict:
        contactable, blocked = [], []
        for lead in self.leads.values():
            if lead.status != LeadStatus.qualified:
                continue
            ok, reason = contactability(lead, self.suppression)
            if ok:
                contactable.append(lead)
            else:
                lead.status = LeadStatus.suppressed
                lead.reasons.append(f"compliance: {reason}")
                blocked.append({"id": lead.id, "email": lead.email, "reason": reason})
        return {"contactable": [l.id for l in contactable], "blocked": blocked}

    def contactable_leads(self) -> list[Lead]:
        return [l for l in self.leads.values() if l.status == LeadStatus.qualified
                and contactability(l, self.suppression)[0]]

    # --- outreach (via the agent runtime) -----------------------------------
    def _draft(self, lead: Lead, step: SequenceStep) -> dict:
        first = lead.name.split()[0] if lead.name else "there"
        return {"to": lead.email,
                "subject": step.subject_template.format(first_name=first, company=lead.company),
                "body": step.body_template.format(first_name=first, company=lead.company)}

    def propose_outreach(self, lead_id: str, step: SequenceStep | None = None) -> dict:
        lead = self.leads[lead_id]
        ok, reason = contactability(lead, self.suppression)
        if not ok:
            raise ValueError(f"lead not contactable: {reason}")
        draft = self._draft(lead, step or SequenceStep())
        run = self.runtime.create_run("outreach", json.dumps(draft))
        run = self.runtime.run(run.id)        # pauses awaiting approval
        self.outreach[run.id] = OutreachRecord(
            lead_id=lead.id, email=lead.email, run_id=run.id,
            status="proposed", subject=draft["subject"])
        return {"run_id": run.id, "status": run.status.value, "draft": draft}

    def approve_outreach(self, run_id: str, approved: bool, note: str = "") -> dict:
        run = self.runtime.approve(run_id, approved, note)
        rec = self.outreach[run_id]
        sent = any("queued" in (e.data.get("result", "") if e.data else "").lower()
                   for e in run.trace)
        if sent:
            rec.status = "sent"
            self.leads[rec.lead_id].status = LeadStatus.contacted
        elif approved:
            rec.status = "blocked"            # approved but compliance tool refused
        else:
            rec.status = "rejected"
        rec.note = note
        return {"run_id": run_id, "run_status": run.status.value,
                "outreach_status": rec.status, "result": run.result}

    def _mark_sent(self, email: str) -> None:
        for lead in self.leads.values():
            if lead.email == email.lower():
                lead.status = LeadStatus.contacted

    def unsubscribe(self, email: str) -> None:
        self.suppression.add_email(email, reason="unsubscribe")
        for lead in self.leads.values():
            if lead.email == email.lower():
                lead.status = LeadStatus.unsubscribed

    # --- export -------------------------------------------------------------
    def export(self, out_dir: str, qualified_only: bool = True) -> dict:
        d = Path(out_dir)
        d.mkdir(parents=True, exist_ok=True)
        rows = [l for l in self.leads.values()
                if not qualified_only or l.status in
                (LeadStatus.qualified, LeadStatus.contacted, LeadStatus.replied)]
        cols = ["id", "name", "title", "company", "industry", "region",
                "employees", "email", "score", "status", "source", "consent_basis"]
        csv_path = d / "leads.csv"
        with csv_path.open("w", newline="") as f:
            w = csv.writer(f)
            w.writerow(cols)
            for l in rows:
                w.writerow([getattr(l, c).value if hasattr(getattr(l, c), "value")
                            else getattr(l, c) for c in cols])
        json_path = d / "leads.json"
        json_path.write_text(json.dumps([l.model_dump(mode="json") for l in rows], indent=2))
        return {"count": len(rows), "csv": str(csv_path), "json": str(json_path)}
