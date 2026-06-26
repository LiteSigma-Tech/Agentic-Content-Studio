"""Compliance layer — the gate that decides who may lawfully be contacted.

Conservative defaults (this is a flag, not legal advice; rules vary by
jurisdiction and must be reviewed by counsel):
  - Suppressed (do-not-contact / prior unsubscribe) -> never contact.
  - Invalid / missing email -> not contactable.
  - EU/EEA/UK regions -> require explicit opt-in consent.
  - Other regions -> allow opt-in or legitimate-interest, but always with a
    working opt-out (the sequence body includes a STOP/unsubscribe line).
  - Unknown consent basis -> not contactable anywhere.
"""
from __future__ import annotations

import re

from .models import ConsentBasis, Lead

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

# Regions requiring explicit opt-in (illustrative subset of EU/EEA + UK).
_OPT_IN_REQUIRED = {
    "DE", "FR", "IE", "NL", "ES", "IT", "BE", "AT", "SE", "DK", "FI", "PT",
    "PL", "GR", "CZ", "NO", "IS", "GB", "UK",
}


class SuppressionList:
    def __init__(self) -> None:
        self._emails: dict[str, str] = {}    # email -> reason
        self._domains: dict[str, str] = {}   # domain -> reason

    def add_email(self, email: str, reason: str = "unsubscribe") -> None:
        self._emails[email.lower().strip()] = reason

    def add_domain(self, domain: str, reason: str = "do_not_contact") -> None:
        self._domains[domain.lower().strip()] = reason

    def reason_for(self, email: str) -> str | None:
        e = email.lower().strip()
        if e in self._emails:
            return self._emails[e]
        dom = e.split("@")[-1] if "@" in e else ""
        return self._domains.get(dom)


def valid_email(email: str) -> bool:
    return bool(_EMAIL_RE.match(email or ""))


def contactability(lead: Lead, suppression: SuppressionList) -> tuple[bool, str]:
    if not valid_email(lead.email):
        return False, "invalid or missing email"
    sup = suppression.reason_for(lead.email)
    if sup:
        return False, f"suppressed ({sup})"
    if lead.consent_basis == ConsentBasis.unknown:
        return False, "no lawful basis (unknown consent)"
    if lead.region.upper() in _OPT_IN_REQUIRED and lead.consent_basis != ConsentBasis.opt_in:
        return False, f"{lead.region} requires explicit opt-in"
    return True, "ok"


def contactability_email(email: str, suppression: SuppressionList) -> tuple[bool, str]:
    """Lightweight check used by the send tool as defense-in-depth."""
    if not valid_email(email):
        return False, "invalid email"
    sup = suppression.reason_for(email)
    return (False, f"suppressed ({sup})") if sup else (True, "ok")
