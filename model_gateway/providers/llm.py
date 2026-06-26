"""LLM providers.

`LiteLLMProvider` is the real, free-first path: LiteLLM gives one
OpenAI-compatible interface across local Ollama models AND 100+ hosted
providers (OpenRouter free tier, Groq, etc.). You only ever talk to LiteLLM.

`EchoLLMProvider` is a dependency-free mock so the gateway runs offline with no
GPU and no API keys — useful for dev, tests, and CI. Swap to LiteLLM models in
routing.yaml once Ollama or a hosted key is available.
"""
from __future__ import annotations

from ..errors import ProviderError
from ..interfaces import Cap, LLMMessage, LLMResult


class EchoLLMProvider:
    """Offline mock. Deterministic, free, always available."""

    def __init__(self, model_id: str = "mock/echo-llm"):
        self.model_id = model_id
        self.capabilities = {Cap.FUNCTION_CALLING, Cap.JSON_MODE, Cap.MODERATION_OK}
        self.est_cost_usd = 0.0
        self.est_latency_s = 0.05
        self.quality = 1

    def generate(self, messages, *, tools=None, json_mode=False) -> LLMResult:
        last = messages[-1].content if messages else ""
        text = '{"ok": true}' if json_mode else f"[echo:{self.model_id}] {last}"
        return LLMResult(text=text, model_id=self.model_id, cost_usd=0.0,
                         tokens_out=len(text.split()))


class LiteLLMProvider:
    """Real provider via the litellm library. Example model strings:
        'ollama/qwen2.5:32b'        (local, free)
        'openrouter/qwen/qwen-2.5-72b-instruct:free'
        'groq/llama-3.3-70b-versatile'
    """

    def __init__(
        self,
        model_id: str,
        litellm_model: str,
        *,
        capabilities: set[str],
        est_cost_usd: float = 0.0,
        est_latency_s: float = 3.0,
        quality: int = 5,
        api_base: str | None = None,
    ):
        self.model_id = model_id
        self.litellm_model = litellm_model
        self.capabilities = set(capabilities)
        self.est_cost_usd = est_cost_usd
        self.est_latency_s = est_latency_s
        self.quality = quality
        self.api_base = api_base

    def generate(self, messages, *, tools=None, json_mode=False) -> LLMResult:
        try:
            import litellm  # optional dependency
        except ImportError as e:
            raise ProviderError("litellm not installed; `pip install litellm`") from e

        kwargs = {
            "model": self.litellm_model,
            "messages": [{"role": m.role, "content": m.content} for m in messages],
        }
        if self.api_base:
            kwargs["api_base"] = self.api_base
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}
        if tools:
            kwargs["tools"] = tools

        try:
            resp = litellm.completion(**kwargs)
        except Exception as e:  # network down, rate-limited, auth -> fall back
            raise ProviderError(f"{self.model_id} call failed: {e}") from e

        choice = resp["choices"][0]["message"]["content"] or ""
        cost = float(getattr(resp, "_hidden_params", {}).get("response_cost", 0.0) or 0.0)
        return LLMResult(text=choice, model_id=self.model_id, cost_usd=cost)
