"""Per-tenant usage metering + quota enforcement.

Records every billable action (model calls, jobs) with its cost, keeps running
per-tenant totals, and enforces the tenant's spend/job quotas. This is where the
gateway's per-call cost capture and the runtime's spend caps roll up to a tenant
bill. In-memory here; a metering table + billing reconciliation in production.
"""
from __future__ import annotations

import time
from collections import defaultdict
from dataclasses import dataclass, field


class QuotaExceeded(Exception):
    pass


@dataclass
class UsageEvent:
    tenant_id: str
    kind: str            # e.g. "llm", "video", "job", "tts"
    qty: float
    cost_usd: float
    ts: float = field(default_factory=time.time)


class UsageMeter:
    def __init__(self):
        self.events: list[UsageEvent] = []
        self._cost: dict[str, float] = defaultdict(float)
        self._jobs: dict[str, int] = defaultdict(int)

    def record(self, tenant_id: str, kind: str, qty: float = 1.0,
               cost_usd: float = 0.0) -> UsageEvent:
        ev = UsageEvent(tenant_id, kind, qty, round(cost_usd, 6))
        self.events.append(ev)
        self._cost[tenant_id] = round(self._cost[tenant_id] + cost_usd, 6)
        if kind == "job":
            self._jobs[tenant_id] += int(qty)
        return ev

    def cost(self, tenant_id: str) -> float:
        return self._cost[tenant_id]

    def jobs(self, tenant_id: str) -> int:
        return self._jobs[tenant_id]

    def check_quota(self, tenant, *, add_cost: float = 0.0, add_jobs: int = 0) -> None:
        """Raise QuotaExceeded if the action would push the tenant past a cap.
        Call BEFORE performing the metered action."""
        if self._cost[tenant.id] + add_cost > tenant.cost_cap_usd:
            raise QuotaExceeded(
                f"spend quota exceeded: ${self._cost[tenant.id] + add_cost:.4f} "
                f"> ${tenant.cost_cap_usd:.2f}")
        if self._jobs[tenant.id] + add_jobs > tenant.job_cap:
            raise QuotaExceeded(
                f"job quota exceeded: {self._jobs[tenant.id] + add_jobs} > {tenant.job_cap}")

    def summary(self, tenant) -> dict:
        by_kind: dict[str, dict] = {}
        for e in self.events:
            if e.tenant_id != tenant.id:
                continue
            d = by_kind.setdefault(e.kind, {"count": 0, "cost_usd": 0.0})
            d["count"] += 1
            d["cost_usd"] = round(d["cost_usd"] + e.cost_usd, 6)
        return {
            "tenant_id": tenant.id, "plan": tenant.plan,
            "total_cost_usd": self.cost(tenant.id),
            "cost_cap_usd": tenant.cost_cap_usd,
            "cost_remaining_usd": round(tenant.cost_cap_usd - self.cost(tenant.id), 6),
            "jobs": self.jobs(tenant.id), "job_cap": tenant.job_cap,
            "by_kind": by_kind,
        }
