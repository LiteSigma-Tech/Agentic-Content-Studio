"""Lightweight observability: a request-scoped context (request id + tenant),
a structured event log, and a timed-span helper. Maps onto OpenTelemetry +
a tracing backend in production; the structured events here are the same shape
you'd export as spans/logs.
"""
from __future__ import annotations

import time
import uuid
from contextlib import contextmanager
from contextvars import ContextVar

try:
    from shared.logging_config import get_logger as _get_struct_logger
    _slog = _get_struct_logger("platform_core.events")
except Exception:
    _slog = None

_request_id: ContextVar[str] = ContextVar("request_id", default="-")
_tenant_id: ContextVar[str] = ContextVar("tenant_id", default="-")


def new_request_id() -> str:
    rid = "req_" + uuid.uuid4().hex[:12]
    _request_id.set(rid)
    return rid


def set_tenant(tenant_id: str) -> None:
    _tenant_id.set(tenant_id)


def context() -> dict:
    return {"request_id": _request_id.get(), "tenant_id": _tenant_id.get()}


class EventLog:
    """Structured, queryable event sink (stdout JSON in prod; in-memory here)."""

    def __init__(self, capacity: int = 5000):
        self.events: list[dict] = []
        self.capacity = capacity

    def emit(self, event: str, **fields) -> dict:
        rec = {"ts": round(time.time(), 3), "event": event, **context(), **fields}
        self.events.append(rec)
        if len(self.events) > self.capacity:
            self.events = self.events[-self.capacity:]
        if _slog:
            try:
                _slog.info(event, **fields)
            except Exception:
                pass
        return rec

    @contextmanager
    def span(self, name: str, **fields):
        start = time.perf_counter()
        self.emit(f"{name}.start", **fields)
        try:
            yield
        except Exception as e:
            self.emit(f"{name}.error", error=f"{type(e).__name__}: {e}",
                      ms=round((time.perf_counter() - start) * 1000, 2))
            raise
        self.emit(f"{name}.end", ms=round((time.perf_counter() - start) * 1000, 2), **fields)

    def tail(self, n: int = 50) -> list[dict]:
        return self.events[-n:]
