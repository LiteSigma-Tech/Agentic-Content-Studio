"""ICP scoring + qualification.

Rules-based and deterministic so it's testable and explainable (each lead gets
`reasons`). In production this is augmented by an LLM (via the Model Gateway,
agent_reasoning task) for fuzzy fit — the score/threshold interface is the same.
"""
from __future__ import annotations

from .models import ICP, Lead, LeadStatus


def score_lead(lead: Lead, icp: ICP) -> tuple[int, list[str]]:
    score, reasons = 0, []

    if any(i.lower() == lead.industry.lower() for i in icp.industries):
        score += 30
        reasons.append(f"+30 industry match ({lead.industry})")
    if any(t.lower() in lead.title.lower() for t in icp.titles):
        score += 30
        reasons.append("+30 title match")
    if not icp.regions or lead.region in icp.regions:
        score += 15
        reasons.append(f"+15 region in target ({lead.region})")
    if icp.min_employees <= lead.employees <= icp.max_employees:
        score += 15
        reasons.append(f"+15 company size {lead.employees}")
    blob = f"{lead.company} {lead.industry} {lead.title}".lower()
    if any(k.lower() in blob for k in icp.keywords):
        score += 10
        reasons.append("+10 keyword match")

    return min(score, 100), reasons


def qualify(lead: Lead, icp: ICP) -> Lead:
    lead.score, reasons = score_lead(lead, icp)
    lead.reasons = reasons
    if lead.score >= icp.qualify_threshold:
        lead.status = LeadStatus.qualified
    else:
        lead.status = LeadStatus.disqualified
        lead.reasons.append(f"below threshold ({lead.score} < {icp.qualify_threshold})")
    return lead
