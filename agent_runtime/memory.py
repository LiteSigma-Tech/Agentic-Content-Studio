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
