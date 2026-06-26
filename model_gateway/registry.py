"""Registry of available providers. Populated at startup; queried by the
router and exposed to the UI so it can show which models exist and what each
can do (capability flags drive the per-task model picker)."""
from __future__ import annotations

from collections import defaultdict
from typing import Any


class Registry:
    def __init__(self) -> None:
        # modality -> model_id -> provider instance
        self._by_modality: dict[str, dict[str, Any]] = defaultdict(dict)

    def register(self, modality: str, provider: Any) -> None:
        self._by_modality[modality][provider.model_id] = provider

    def get(self, modality: str, model_id: str) -> Any | None:
        return self._by_modality.get(modality, {}).get(model_id)

    def list(self, modality: str) -> list[Any]:
        return list(self._by_modality.get(modality, {}).values())

    def describe(self) -> dict:
        """Machine-readable catalogue for the frontend model picker."""
        out: dict[str, list[dict]] = {}
        for modality, providers in self._by_modality.items():
            out[modality] = [
                {
                    "model_id": p.model_id,
                    "capabilities": sorted(p.capabilities),
                    "est_cost_usd": p.est_cost_usd,
                    "est_latency_s": p.est_latency_s,
                    "quality": p.quality,
                    "free": p.est_cost_usd == 0.0,
                }
                for p in providers.values()
            ]
        return out
