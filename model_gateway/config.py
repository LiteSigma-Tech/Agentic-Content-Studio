"""Routing configuration: the part that lets you 'switch however you like'.

Model selection lives in data (YAML / DB row), not code. Each task has a
default model plus an ordered fallback chain. A policy block controls cost
ceilings and ordering preference. Changing this config changes which model
the *next* job uses — no redeploy.

Environment variable overrides
-------------------------------
Any default model can be overridden at runtime without touching routing.yaml
or redeploying. Set the relevant env var and restart the gateway.

  LLM_SCRIPT_WRITING_MODEL    overrides llm.script_writing.default
  LLM_AGENT_REASONING_MODEL   overrides llm.agent_reasoning.default
  LLM_KIDS_CONTENT_MODEL      overrides llm.kids_content.default
  IMAGE_MODEL                 overrides image.default.default
  VIDEO_MODEL                 overrides video.default.default
  TTS_MODEL                   overrides tts.default.default
  MUSIC_MODEL                 overrides music.default.default
  ROUTING_MAX_COST_USD        overrides policy.max_cost_per_job_usd
  ROUTING_PREFER              overrides policy.prefer

The YAML value is always the documented fallback so the file stays as the
source of truth — env vars are runtime overrides only.
"""
from __future__ import annotations

import os
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


def _env(name: str) -> str:
    """Read env var, strip whitespace and inline shell comments."""
    val = os.getenv(name) or ""
    return val.split("#")[0].strip()


# Maps env var name → (modality, task) in the routing config
_ROUTE_ENV_MAP: list[tuple[str, str, str]] = [
    ("LLM_SCRIPT_WRITING_MODEL",  "llm",   "script_writing"),
    ("LLM_AGENT_REASONING_MODEL", "llm",   "agent_reasoning"),
    ("LLM_KIDS_CONTENT_MODEL",    "llm",   "kids_content"),
    ("IMAGE_MODEL",               "image", "default"),
    ("VIDEO_MODEL",               "video", "default"),
    ("TTS_MODEL",                 "tts",   "default"),
    ("MUSIC_MODEL",               "music", "default"),
]


def apply_env_overrides(cfg: RoutingConfig) -> RoutingConfig:
    """Apply env var model overrides on top of the YAML/DB routing config.

    Called at gateway startup so env vars take effect without touching
    routing.yaml.  Only non-empty env vars are applied; unset vars leave
    the YAML default untouched.
    """
    changed = False

    for env_var, modality, task in _ROUTE_ENV_MAP:
        model = _env(env_var)
        if not model:
            continue
        route = cfg.routing.setdefault(modality, {}).get(task)
        if route is None:
            # Task not in config at all — create a minimal route
            cfg.routing[modality][task] = TaskRoute(default=model)
            changed = True
        elif route.default != model:
            # Prepend the env-specified model as the new default,
            # keeping the old default as the first fallback so it's
            # still tried if the env-specified model isn't registered.
            old_default = route.default
            route.default = model
            if old_default not in route.fallbacks:
                route.fallbacks = [old_default, *route.fallbacks]
            changed = True

    # Policy overrides
    max_cost = _env("ROUTING_MAX_COST_USD")
    if max_cost:
        try:
            cfg.policy.max_cost_per_job_usd = float(max_cost)
            changed = True
        except ValueError:
            pass

    prefer = _env("ROUTING_PREFER")
    if prefer in ("route_order", "cheapest", "fastest", "best_quality"):
        cfg.policy.prefer = prefer
        changed = True

    if changed:
        overrides = {e: _env(e) for e, _, _ in _ROUTE_ENV_MAP if _env(e)}
        if max_cost:
            overrides["ROUTING_MAX_COST_USD"] = max_cost
        if prefer:
            overrides["ROUTING_PREFER"] = prefer
        names = ", ".join(f"{k}={v}" for k, v in overrides.items())
        print(f"[gateway] env overrides applied: {names}")

    return cfg


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
