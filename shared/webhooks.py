"""Webhook registry and outbound delivery with HMAC signing and retry."""
from __future__ import annotations

import asyncio
import hashlib
import hmac as _hmac
import json
import time
import uuid

import httpx

_MAX_RETRIES = 3
_TIMEOUT = 10.0


class Webhook:
    def __init__(self, url: str, events: list[str], secret: str = ""):
        self.id = uuid.uuid4().hex[:12]
        self.url = url
        self.events = list(events)
        self.secret = secret
        self.created_at = time.time()

    def to_dict(self) -> dict:
        return {"id": self.id, "url": self.url, "events": self.events,
                "created_at": self.created_at}


class WebhookStore:
    """In-memory webhook registry. Re-register after restart."""

    def __init__(self):
        self._hooks: dict[str, Webhook] = {}

    def register(self, url: str, events: list[str], secret: str = "") -> Webhook:
        hook = Webhook(url, events, secret)
        self._hooks[hook.id] = hook
        return hook

    def list(self) -> list[Webhook]:
        return list(self._hooks.values())

    def get(self, hook_id: str) -> Webhook | None:
        return self._hooks.get(hook_id)

    def delete(self, hook_id: str) -> bool:
        return bool(self._hooks.pop(hook_id, None))

    def find_by_event(self, event: str) -> list[Webhook]:
        return [h for h in self._hooks.values() if event in h.events]


def _sign(payload: bytes, secret: str) -> str:
    return _hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()


async def deliver(hook: Webhook, event: str, payload: dict) -> bool:
    """POST payload to hook URL with HMAC signature. Retries up to 3 times."""
    body = json.dumps({"event": event, "ts": time.time(), "data": payload}).encode()
    headers = {"Content-Type": "application/json", "X-Webhook-Event": event}
    if hook.secret:
        headers["X-Webhook-Signature"] = f"sha256={_sign(body, hook.secret)}"

    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        for attempt in range(_MAX_RETRIES):
            try:
                resp = await client.post(hook.url, content=body, headers=headers)
                if resp.status_code < 500:
                    return True
            except Exception:
                pass
            if attempt < _MAX_RETRIES - 1:
                await asyncio.sleep(2 ** attempt)
    return False


async def deliver_event(store: WebhookStore, event: str, payload: dict) -> None:
    """Fire all registered hooks matching `event` concurrently."""
    hooks = store.find_by_event(event)
    if hooks:
        await asyncio.gather(
            *[deliver(h, event, payload) for h in hooks],
            return_exceptions=True,
        )
