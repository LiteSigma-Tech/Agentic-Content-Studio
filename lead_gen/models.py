"""Lead generation domain models.

Note the compliance-first fields on Lead: every lead carries its `source` and a
`consent_basis`, because lawful outreach depends on them. The funnel never
treats a contact as reachable without checking these (see compliance.py).
"""
from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum

from pydantic import BaseModel, Field


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class ConsentBasis(str, Enum):
    opt_in = "opt_in"                      # explicit consent (required in EU/UK/EEA)
    legitimate_interest = "legitimate_interest"   # allowed in some regions w/ opt-out
    unknown = "unknown"                    # conservative default -> not contactable


class LeadStatus(str, Enum):
    sourced = "sourced"
    enriched = "enriched"
    qualified = "qualified"
    disqualified = "disqualified"
    suppressed = "suppressed"              # blocked by compliance
    contacted = "contacted"
    replied = "replied"
    unsubscribed = "unsubscribed"


class ICP(BaseModel):
    """Ideal Customer Profile — the targeting + scoring definition."""
    industries: list[str] = Field(default_factory=list)
    regions: list[str] = Field(default_factory=list)
    titles: list[str] = Field(default_factory=list)        # target role keywords
    keywords: list[str] = Field(default_factory=list)
    min_employees: int = 0
    max_employees: int = 10_000_000
    qualify_threshold: int = 50


class Lead(BaseModel):
    id: str
    name: str = ""
    title: str = ""
    company: str = ""
    industry: str = ""
    region: str = ""
    employees: int = 0
    email: str = ""
    source: str = ""                       # provenance (which provider/list)
    consent_basis: ConsentBasis = ConsentBasis.unknown
    score: int = 0
    status: LeadStatus = LeadStatus.sourced
    reasons: list[str] = Field(default_factory=list)       # qualify/compliance notes
    dedupe_key: str = ""
    created_at: str = Field(default_factory=_now)


class SequenceStep(BaseModel):
    channel: str = "email"
    delay_days: int = 0
    subject_template: str = "Quick question, {first_name}"
    body_template: str = ("Hi {first_name}, I came across {company} and thought "
                          "our work might be relevant. Open to a quick chat?\n\n"
                          "If not, reply STOP and I won't follow up.")


class OutreachRecord(BaseModel):
    lead_id: str
    email: str
    run_id: str = ""                       # the agent run that proposed the send
    status: str = "proposed"               # proposed | sent | rejected | blocked
    subject: str = ""
    note: str = ""
    ts: str = Field(default_factory=_now)
