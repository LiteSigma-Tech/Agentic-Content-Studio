"""Lead sourcing.

⚠️ Sourcing should use LICENSED data providers (Apollo/Clearbit-type APIs), not
scraping — scraping raises ToS, GDPR/CCPA, and CAN-SPAM exposure. The provider
interface keeps the source swappable so you can stay compliant and switch
vendors. This is a flag, not legal advice: have counsel review your data
sourcing before going live.

Offline, `MockLeadProvider` returns a fixed, representative catalogue (varied
regions, consent bases, a duplicate, an invalid email) so the funnel and the
compliance gates can be exercised deterministically.
"""
from __future__ import annotations

import uuid
from typing import Protocol

from .models import ConsentBasis, Lead


class LeadProvider(Protocol):
    def search(self, n: int) -> list[Lead]: ...


_CATALOGUE = [
    # strong US matches, lawful basis -> should qualify and be contactable
    dict(name="Dana Reyes", title="VP of Marketing", company="SolarBright",
         industry="Renewable Energy", region="US", employees=120,
         email="dana@solarbright.com", source="licensed_provider_a",
         consent_basis=ConsentBasis.legitimate_interest),
    dict(name="Marcus Lee", title="Head of Growth", company="Helios Co",
         industry="Renewable Energy", region="US", employees=300,
         email="marcus@helios.co", source="licensed_provider_a",
         consent_basis=ConsentBasis.opt_in),
    # EU lead WITHOUT opt-in -> qualifies on fit but NOT contactable
    dict(name="Sofia Klein", title="Marketing Director", company="GrünPower",
         industry="Renewable Energy", region="DE", employees=80,
         email="sofia@gruenpower.de", source="licensed_provider_b",
         consent_basis=ConsentBasis.legitimate_interest),
    # EU lead WITH opt-in -> contactable
    dict(name="Liam Walsh", title="CMO", company="EireWind",
         industry="Renewable Energy", region="IE", employees=210,
         email="liam@eirewind.ie", source="event_optin",
         consent_basis=ConsentBasis.opt_in),
    # off-ICP (wrong industry) -> should disqualify on score
    dict(name="Priya Nair", title="Office Manager", company="DentalPlus",
         industry="Healthcare", region="US", employees=15,
         email="priya@dentalplus.com", source="licensed_provider_a",
         consent_basis=ConsentBasis.legitimate_interest),
    # unknown consent -> not contactable anywhere (conservative)
    dict(name="Tom Becker", title="Sustainability Lead", company="WattWorks",
         industry="Renewable Energy", region="US", employees=500,
         email="tom@wattworks.com", source="scraped_unknown",
         consent_basis=ConsentBasis.unknown),
    # invalid email -> not contactable
    dict(name="Ava Stone", title="VP Marketing", company="SunPeak",
         industry="Renewable Energy", region="US", employees=90,
         email="ava(at)sunpeak", source="licensed_provider_a",
         consent_basis=ConsentBasis.opt_in),
    # duplicate of Dana (same email) -> deduped away
    dict(name="Dana Reyes", title="VP Marketing", company="SolarBright",
         industry="Renewable Energy", region="US", employees=120,
         email="dana@solarbright.com", source="licensed_provider_b",
         consent_basis=ConsentBasis.legitimate_interest),
]


class MockLeadProvider:
    def search(self, n: int) -> list[Lead]:
        out = []
        for row in _CATALOGUE[:n]:
            out.append(Lead(id=uuid.uuid4().hex[:10], **row))
        return out
