"""Routing configuration: the part that lets you 'switch however you like'.

Model selection lives in data (YAML / DB row), not code. Each task has a
default model plus an ordered fallback chain. A policy block controls cost
ceilings and ordering preference. Changing this config changes which model
the *next* job uses — no redeploy.
"""
from __future__ import annotations

from pathlib import Path

import yaml
from pydantic import BaseModel, Field


class TaskRoute(BaseModel):
    default: str
    fallbacks: list[str] = Field(default_factory=list)
    require: list[str] = Field(default_factory=list)  # required capability flags

    def ordered(self) -> list[str]:
        seen, out = set(), []
        for m in [self.default, *self.fallbacks]:
            if m not in seen:
                seen.add(m)
                out.append(m)
        return out


class Policy(BaseModel):
    # 0.0 => free-only (mock / local / open-weight). Raise to allow paid fallback.
    max_cost_per_job_usd: float = 0.0
    prefer: str = "route_order"  # route_order | cheapest | fastest | best_quality


class RoutingConfig(BaseModel):
    # modality -> task -> TaskRoute
    routing: dict[str, dict[str, TaskRoute]] = Field(default_factory=dict)
    policy: Policy = Field(default_factory=Policy)

    def route_for(self, modality: str, task: str) -> TaskRoute:
        tasks = self.routing.get(modality, {})
        if task in tasks:
            return tasks[task]
        if "default" in tasks:
            return tasks["default"]
        raise KeyError(f"No route for modality={modality!r} task={task!r}")


class ConfigStore:
    """Holds the live config. In production this is a DB row per tenant,
    hot-reloaded; here it's an in-memory object you can PUT to at runtime."""

    def __init__(self, cfg: RoutingConfig):
        self._cfg = cfg

    @classmethod
    def from_yaml(cls, path: str | Path) -> "ConfigStore":
        data = yaml.safe_load(Path(path).read_text())
        return cls(RoutingConfig(**data))

    def get(self) -> RoutingConfig:
        return self._cfg

    def set(self, cfg: RoutingConfig) -> None:
        self._cfg = cfg

    async def aget(self) -> "RoutingConfig":
        """Load config from DB if available, else return in-memory config."""
        try:
            from shared.database import get_pool, is_available
            if await is_available():
                pool = await get_pool()
                async with pool.acquire() as conn:
                    row = await conn.fetchrow("SELECT config_json FROM routing_config WHERE id=1")
                    if row:
                        return RoutingConfig.model_validate_json(row['config_json'])
        except Exception:
            pass
        return self._cfg

    async def aset(self, cfg: "RoutingConfig") -> None:
        """Update config in-memory and persist to DB."""
        self._cfg = cfg
        try:
            from shared.database import get_pool, is_available
            if await is_available():
                pool = await get_pool()
                async with pool.acquire() as conn:
                    await conn.execute(
                        """INSERT INTO routing_config(id, config_json, updated_at)
                           VALUES(1, $1, now())
                           ON CONFLICT(id) DO UPDATE SET config_json=$1, updated_at=now()""",
                        cfg.model_dump_json()
                    )
        except Exception:
            pass

    async def aseed_if_empty(self) -> None:
        """On startup: insert the YAML config if no DB row exists yet."""
        try:
            from shared.database import get_pool, is_available
            if not await is_available():
                return
            pool = await get_pool()
            async with pool.acquire() as conn:
                row = await conn.fetchrow("SELECT id FROM routing_config WHERE id=1")
                if not row:
                    await conn.execute(
                        "INSERT INTO routing_config(id, config_json) VALUES(1, $1)",
                        self._cfg.model_dump_json()
                    )
        except Exception:
            pass
