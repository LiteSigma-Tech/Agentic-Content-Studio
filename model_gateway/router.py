"""The router turns (modality, task) into an ordered list of eligible
providers and runs the first that succeeds, falling through the chain on
failure. Eligibility = in the route's chain, satisfies required capabilities,
and within the cost policy. This is where 'free-only' is enforced
(policy.max_cost_per_job_usd = 0) and where automatic fallback happens when a
free tier is throttled or down."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

from .config import ConfigStore
from .errors import NoEligibleProvider, ProviderError
from .registry import Registry


@dataclass
class Outcome:
    result: Any            # LLMResult or MediaAsset
    model_id: str          # provider that actually succeeded
    cost_usd: float
    attempts: list[str]    # models tried, in order (last one succeeded)


class Router:
    def __init__(self, registry: Registry, store: ConfigStore):
        self.registry = registry
        self.store = store

    def candidates(
        self, modality: str, task: str, required_caps: set[str] | None = None
    ) -> list[Any]:
        cfg = self.store.get()
        route = cfg.route_for(modality, task)
        required = set(route.require) | set(required_caps or set())

        chain = []
        for model_id in route.ordered():
            p = self.registry.get(modality, model_id)
            if p is None:
                continue  # configured but not registered -> skip silently
            if not required.issubset(p.capabilities):
                continue  # cannot do what this task needs
            if p.est_cost_usd > cfg.policy.max_cost_per_job_usd:
                continue  # outside cost policy (e.g. free-only)
            chain.append(p)

        prefer = cfg.policy.prefer
        if prefer == "cheapest":
            chain.sort(key=lambda p: p.est_cost_usd)
        elif prefer == "fastest":
            chain.sort(key=lambda p: p.est_latency_s)
        elif prefer == "best_quality":
            chain.sort(key=lambda p: p.quality, reverse=True)
        # "route_order" => keep the order declared in config

        return chain

    def execute(
        self,
        modality: str,
        task: str,
        call: Callable[[Any], Any],
        *,
        required_caps: set[str] | None = None,
    ) -> Outcome:
        chain = self.candidates(modality, task, required_caps)
        if not chain:
            raise NoEligibleProvider(
                f"No eligible provider for modality={modality!r} task={task!r} "
                f"(check routing, capabilities, and policy.max_cost_per_job_usd)"
            )

        attempts: list[str] = []
        last_err: Exception | None = None
        for provider in chain:
            attempts.append(provider.model_id)
            try:
                result = call(provider)
            except ProviderError as e:  # try the next in the fallback chain
                last_err = e
                continue
            cost = getattr(result, "cost_usd", provider.est_cost_usd)
            return Outcome(result=result, model_id=provider.model_id,
                           cost_usd=cost, attempts=attempts)

        raise ProviderError(
            f"All providers failed for {modality}/{task}: tried {attempts}. "
            f"Last error: {last_err}"
        )
