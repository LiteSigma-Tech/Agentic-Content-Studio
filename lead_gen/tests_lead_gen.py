"""Runs fully offline. Verifies the lead funnel, the compliance gates that
decide contactability, outreach through the agent runtime's approval gate,
defense-in-depth on send, unsubscribe -> suppression, and CRM export.
"""
from __future__ import annotations

import sys
import tempfile
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO))

from lead_gen.models import ICP, ConsentBasis, LeadStatus  # noqa: E402
from lead_gen.service import LeadGenService  # noqa: E402

ICP_SOLAR = ICP(industries=["Renewable Energy"], regions=["US", "IE", "DE"],
                titles=["vp", "head", "cmo", "director", "growth"],
                keywords=["solar", "wind", "energy"], qualify_threshold=50)


def _svc():
    s = LeadGenService(runs_root=tempfile.mkdtemp())
    s.set_icp(ICP_SOLAR)
    return s


def test_funnel_source_enrich_dedupe_qualify():
    s = _svc()
    n = s.source(20)
    # the duplicate Dana (same email) is removed -> 7 unique from the 8-row catalogue
    assert n == 7
    summary = s.score_and_qualify()
    assert summary["qualified"] >= 4          # the renewable-energy fits
    # the off-ICP healthcare lead is disqualified
    healthcare = next(l for l in s.leads.values() if l.industry == "Healthcare")
    assert healthcare.status == LeadStatus.disqualified


def test_compliance_blocks_eu_without_optin_and_unknown_consent():
    s = _svc()
    s.source(20)
    s.score_and_qualify()
    result = s.apply_compliance()
    blocked = {b["email"]: b["reason"] for b in result["blocked"]}
    # EU (DE) legitimate-interest lead is blocked; needs opt-in
    assert any("opt-in" in r for r in blocked.values())
    # unknown-consent lead is blocked
    assert any("unknown consent" in r for r in blocked.values())
    # invalid-email lead is blocked
    assert any("invalid" in r for r in blocked.values())
    # the EU opt-in lead (IE) IS contactable
    ie = next(l for l in s.leads.values() if l.region == "IE")
    assert ie.id in result["contactable"]


def test_outreach_requires_approval_then_sends():
    s = _svc()
    s.source(20); s.score_and_qualify(); s.apply_compliance()
    lead = s.contactable_leads()[0]
    prop = s.propose_outreach(lead.id)
    assert prop["status"] == "awaiting_approval"     # HITL gate (from B2)
    assert "STOP" in prop["draft"]["body"] or "stop" in prop["draft"]["body"].lower()
    res = s.approve_outreach(prop["run_id"], approved=True)
    assert res["outreach_status"] == "sent"
    assert s.leads[lead.id].status == LeadStatus.contacted


def test_rejected_outreach_does_not_send():
    s = _svc()
    s.source(20); s.score_and_qualify(); s.apply_compliance()
    lead = s.contactable_leads()[0]
    prop = s.propose_outreach(lead.id)
    res = s.approve_outreach(prop["run_id"], approved=False, note="wrong segment")
    assert res["outreach_status"] == "rejected"
    assert s.leads[lead.id].status != LeadStatus.contacted


def test_defense_in_depth_suppressed_after_proposal_cannot_send():
    s = _svc()
    s.source(20); s.score_and_qualify(); s.apply_compliance()
    lead = s.contactable_leads()[0]
    prop = s.propose_outreach(lead.id)
    # lead unsubscribes AFTER the draft was proposed but BEFORE approval
    s.unsubscribe(lead.email)
    res = s.approve_outreach(prop["run_id"], approved=True)
    # even though a human approved, the send tool refuses -> blocked, not sent
    assert res["outreach_status"] == "blocked"
    assert s.leads[lead.id].status == LeadStatus.unsubscribed


def test_unsubscribe_makes_lead_non_contactable():
    s = _svc()
    s.source(20); s.score_and_qualify()
    lead = next(l for l in s.leads.values() if l.email == "marcus@helios.co")
    s.unsubscribe(lead.email)
    s.apply_compliance()
    assert lead.id not in [l.id for l in s.contactable_leads()]


def test_propose_to_noncontactable_raises():
    s = _svc()
    s.source(20); s.score_and_qualify(); s.apply_compliance()
    eu = next(l for l in s.leads.values() if l.region == "DE")
    try:
        s.propose_outreach(eu.id)
        assert False, "should refuse non-contactable lead"
    except ValueError as e:
        assert "not contactable" in str(e)


def test_export_writes_csv_and_json():
    s = _svc()
    s.source(20); s.score_and_qualify()
    out = s.export(tempfile.mkdtemp())
    assert out["count"] >= 4
    assert Path(out["csv"]).exists() and Path(out["json"]).exists()
    header = Path(out["csv"]).read_text().splitlines()[0]
    assert "consent_basis" in header and "score" in header


if __name__ == "__main__":
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for fn in fns:
        fn()
        print(f"PASS {fn.__name__}")
    print(f"\n{len(fns)} tests passed.")
