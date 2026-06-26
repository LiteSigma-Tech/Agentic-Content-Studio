#!/usr/bin/env python3
"""End-to-end demo: one narrated flow through every slice, fully offline.

  platform_core (auth + RBAC + metering)
      → model_gateway (free-first routing)
          → audio_studio/video_studio (concept → finished A/V episode)
          → lead_gen on agent_runtime (compliant funnel + approval-gated outreach)
      → metering rollup for the tenant

Run from the repo root:  python demo_e2e.py
"""
from __future__ import annotations

import sys
import tempfile
from pathlib import Path

REPO = Path(__file__).resolve().parent
sys.path.insert(0, str(REPO))

from platform_core.metering import UsageMeter                      # noqa: E402
from platform_core.rbac import Perm                                # noqa: E402
from platform_core.tenancy import TenantStore                      # noqa: E402

from model_gateway import ConfigStore, build_registry             # noqa: E402

from video_studio.gateway_client import InProcessGateway          # noqa: E402
from video_studio.pipeline import create_project                  # noqa: E402
from video_studio.store import ProjectStore                       # noqa: E402
from video_studio.models import Genre                             # noqa: E402
from audio_studio.pipeline import full_pipeline                   # noqa: E402

from lead_gen.models import ICP                                   # noqa: E402
from lead_gen.service import LeadGenService                       # noqa: E402

ROUTING = str(REPO / "routing.yaml")


def line(c="─"):
    print(c * 64)


def head(n, title):
    line(); print(f"  STEP {n} · {title}"); line()


def main():
    meter = UsageMeter()

    # 1 ── platform: a tenant + an authenticated principal ──────────────────
    head(1, "Platform — tenant, auth, permissions")
    store = TenantStore()
    tenant = store.create_tenant("Helios Studios", plan="pro", cost_cap_usd=50.0)
    store.create_user(tenant.id, "ops@helios.studio", "pw", role="admin")
    me = store.auth_bearer(store.login("ops@helios.studio", "pw"))
    print(f"  tenant={tenant.id}  principal={me.subject}  role={me.role}")
    for p in (Perm.STUDIO_RUN, Perm.LEADS_WRITE, Perm.OUTREACH_APPROVE):
        print(f"    can {p:<18} → {me.can(p)}")
    assert me.can(Perm.STUDIO_RUN) and me.can(Perm.OUTREACH_APPROVE)

    # 2 ── gateway: free-first routing ──────────────────────────────────────
    head(2, "Model Gateway — free-first routing")
    cfg = ConfigStore.from_yaml(ROUTING).get()
    reg = build_registry()
    print(f"  policy.max_cost_per_job_usd = {cfg.policy.max_cost_per_job_usd}  (0 = free-only)")
    for mod in ("llm", "image", "video", "tts", "music"):
        models = [p.model_id for p in reg.list(mod)]
        print(f"    {mod:<6} → {', '.join(models)}")

    # 3 ── studio: concept → finished audio-visual episode ──────────────────
    head(3, "Studio — concept → finished A/V (11 stages)")
    assert me.can(Perm.STUDIO_RUN), "RBAC: principal needs studio.run"
    pstore = ProjectStore(tempfile.mkdtemp())
    pipe = full_pipeline(InProcessGateway(ROUTING), pstore)
    proj = create_project("A shy turtle learns to share with forest friends",
                          Genre.kids_cartoon, title="Pip Learns To Share", store=pstore)
    out = pipe.run(proj.id)
    done = sum(1 for s in out.pipeline.stages if s.status.value == "done")
    print(f"  '{out.title}' [{out.genre.value}] — {done}/{len(out.pipeline.stages)} stages done")
    print(f"  final A/V: {out.final_av_uri}")
    print(f"  voices: {out.voice_cast}")
    meter.record(tenant.id, "job", 1, out.pipeline.total_cost_usd)   # roll up to the tenant
    print(f"  metered studio job → ${out.pipeline.total_cost_usd:.2f}")

    # 4 ── lead gen: compliant funnel + approval-gated outreach ─────────────
    head(4, "Lead Gen — funnel, compliance gate, HITL outreach")
    assert me.can(Perm.LEADS_WRITE), "RBAC: principal needs leads.write"
    svc = LeadGenService(runs_root=tempfile.mkdtemp())
    svc.set_icp(ICP(industries=["Renewable Energy"], regions=["US", "IE", "DE"],
                    titles=["vp", "head", "cmo", "director", "growth"],
                    keywords=["solar", "wind", "energy"], qualify_threshold=50))
    n = svc.source(20)
    q = svc.score_and_qualify()
    comp = svc.apply_compliance()
    print(f"  sourced(unique)={n}  qualified={q['qualified']}  contactable={len(comp['contactable'])}")
    for b in comp["blocked"]:
        print(f"    blocked {b['email']:<24} → {b['reason']}")

    lead = svc.contactable_leads()[0]
    prop = svc.propose_outreach(lead.id)
    print(f"  proposed outreach to {lead.email} → status={prop['status']} (paused for a human)")
    assert prop["status"] == "awaiting_approval"
    assert me.can(Perm.OUTREACH_APPROVE), "RBAC: principal needs outreach.approve"
    res = svc.approve_outreach(prop["run_id"], approved=True)
    print(f"  human approved → outreach={res['outreach_status']}")
    meter.record(tenant.id, "outreach", 1, 0.0)

    # 5 ── metering rollup ──────────────────────────────────────────────────
    head(5, "Metering — tenant rollup")
    summ = meter.summary(tenant)
    print(f"  tenant={summ['tenant_id']} plan={summ['plan']}")
    print(f"  total_cost=${summ['total_cost_usd']:.2f} / cap ${summ['cost_cap_usd']:.2f}"
          f"  · jobs={summ['jobs']}/{summ['job_cap']}")
    print(f"  by_kind={summ['by_kind']}")

    line("═")
    print("  ✔ end-to-end flow complete — every slice exercised, $0.00 on free models")
    line("═")


if __name__ == "__main__":
    main()
