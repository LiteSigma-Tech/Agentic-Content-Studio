"""Per-tenant token-bucket rate limiting.

A refilling bucket per tenant: each request takes a token; an empty bucket means
the caller is over their rate and gets refused (HTTP 429 at the edge). In-memory
here; Redis-backed in production so it works across instances.
"""
from __future__ import annotations

import time
from dataclasses import dataclass


class RateLimited(Exception):
    def __init__(self, retry_after: float):
        self.retry_after = retry_after
        super().__init__(f"rate limited; retry after {retry_after:.2f}s")


@dataclass
class _Bucket:
    tokens: float
    updated: float


class RateLimiter:
    def __init__(self, rate_per_s: float = 5.0, burst: int = 10):
        self.rate = rate_per_s
        self.burst = burst
        self._buckets: dict[str, _Bucket] = {}

    def check(self, tenant_id: str, cost: float = 1.0) -> None:
        now = time.monotonic()
        b = self._buckets.get(tenant_id) or _Bucket(self.burst, now)
        b.tokens = min(self.burst, b.tokens + (now - b.updated) * self.rate)
        b.updated = now
        if b.tokens < cost:
            self._buckets[tenant_id] = b
            raise RateLimited((cost - b.tokens) / self.rate)
        b.tokens -= cost
        self._buckets[tenant_id] = b
