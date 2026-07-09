"""Long-term agent memory with semantic-ish recall.

Offline this uses a dependency-free bag-of-words cosine similarity so recall
works with no embedding model or vector DB. In production this interface backs
onto pgvector + a real embedding model (called through the Model Gateway) —
the `remember`/`recall` surface is identical, so swapping the backend needs no
agent changes. Memory is namespaced (typically per agent or per tenant) so it
accumulates across runs.
"""
from __future__ import annotations

import math
import re
from collections import Counter
from dataclasses import dataclass, field


def _vec(text: str) -> Counter:
    return Counter(re.findall(r"[a-z0-9]+", text.lower()))


def _cosine(a: Counter, b: Counter) -> float:
    if not a or not b:
        return 0.0
    dot = sum(a[t] * b[t] for t in a if t in b)
    na = math.sqrt(sum(v * v for v in a.values()))
    nb = math.sqrt(sum(v * v for v in b.values()))
    return dot / (na * nb) if na and nb else 0.0


@dataclass
class MemoryItem:
    text: str
    meta: dict = field(default_factory=dict)


class MemoryStore:
    def __init__(self) -> None:
        self._ns: dict[str, list[tuple[Counter, MemoryItem]]] = {}

    def remember(self, namespace: str, text: str, meta: dict | None = None) -> None:
        self._ns.setdefault(namespace, []).append((_vec(text), MemoryItem(text, meta or {})))

    def recall(self, namespace: str, query: str, k: int = 3) -> list[MemoryItem]:
        qv = _vec(query)
        scored = [(_cosine(qv, v), item) for v, item in self._ns.get(namespace, [])]
        scored.sort(key=lambda x: x[0], reverse=True)
        return [item for score, item in scored[:k] if score > 0]

    def size(self, namespace: str) -> int:
        return len(self._ns.get(namespace, []))

    async def aremember(self, namespace: str, text: str, meta: dict | None = None) -> None:
        """Store in memory and persist to Postgres."""
        self.remember(namespace, text, meta)  # always update in-memory
        import json
        try:
            from shared.database import get_pool, is_available
            if await is_available():
                pool = await get_pool()
                async with pool.acquire() as conn:
                    await conn.execute(
                        "INSERT INTO agent_memory(namespace, text, meta_json) VALUES($1, $2, $3)",
                        namespace, text, json.dumps(meta or {})
                    )
        except Exception:
            pass

    async def aload_namespace(self, namespace: str) -> int:
        """Hydrate a namespace from Postgres into memory. Returns count of items loaded."""
        import json
        try:
            from shared.database import get_pool, is_available
            if not await is_available():
                return 0
            pool = await get_pool()
            async with pool.acquire() as conn:
                rows = await conn.fetch(
                    "SELECT text, meta_json FROM agent_memory WHERE namespace=$1 ORDER BY created_at",
                    namespace
                )
            existing_texts = {item.text for _, item in self._ns.get(namespace, [])}
            for row in rows:
                if row['text'] not in existing_texts:
                    vec = _vec(row['text'])
                    item = MemoryItem(row['text'], json.loads(row['meta_json']))
                    self._ns.setdefault(namespace, []).append((vec, item))
            return len(rows)
        except Exception:
            return 0
