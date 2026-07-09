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


class BedrockLLMProvider(LiteLLMProvider if False else object):
    """AWS Bedrock via LiteLLM. Supports Claude, Titan, Llama, Mistral on Bedrock.

    Auth is standard AWS credential chain — set AWS_ACCESS_KEY_ID +
    AWS_SECRET_ACCESS_KEY + AWS_BEDROCK_REGION, or rely on an IAM role
    (ECS task role / EC2 instance profile) with no explicit credentials needed.

    Common model IDs for routing.yaml:
      bedrock/claude-haiku    -> anthropic.claude-haiku-4-5-20251001-v1:0
      bedrock/claude-sonnet   -> anthropic.claude-sonnet-4-6
      bedrock/claude-opus     -> anthropic.claude-opus-4-8
    """

    _MODELS = {
        "bedrock/claude-haiku":  ("bedrock/us.anthropic.claude-haiku-4-5-20251001-v1:0",  0.0008, 0.004,  7),
        "bedrock/claude-sonnet": ("bedrock/us.anthropic.claude-sonnet-4-6",               0.003,  0.015,  9),
        "bedrock/claude-opus":   ("bedrock/us.anthropic.claude-opus-4-8",                 0.015,  0.075, 10),
    }

    def __init__(self, model_id: str, region: str, *, capabilities: set[str],
                 est_latency_s: float = 3.0):
        if model_id not in self._MODELS:
            raise ValueError(f"Unknown Bedrock model: {model_id}. Choose from: {list(self._MODELS)}")
        litellm_model, input_cost, output_cost, quality = self._MODELS[model_id]
        # Use average of input/output cost as a per-call estimate
        self.model_id = model_id
        self.litellm_model = litellm_model
        self.capabilities = set(capabilities)
        self.est_cost_usd = round((input_cost + output_cost) / 2, 6)
        self.est_latency_s = est_latency_s
        self.quality = quality
        self.api_base = None
        self._region = region

    def generate(self, messages, *, tools=None, json_mode=False) -> "LLMResult":
        try:
            import litellm
        except ImportError as e:
            raise ProviderError("litellm not installed; add `litellm` to requirements.txt") from e

        import os
        kwargs: dict = {
            "model": self.litellm_model,
            "messages": [{"role": m.role, "content": m.content} for m in messages],
            "aws_region_name": self._region,
        }
        # Explicit credentials (optional — IAM role works without these)
        key_id = os.getenv("AWS_ACCESS_KEY_ID")
        secret  = os.getenv("AWS_SECRET_ACCESS_KEY")
        session = os.getenv("AWS_SESSION_TOKEN")
        if key_id and secret:
            kwargs["aws_access_key_id"]     = key_id
            kwargs["aws_secret_access_key"] = secret
        if session:
            kwargs["aws_session_token"] = session

        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}
        if tools:
            kwargs["tools"] = tools

        try:
            resp = litellm.completion(**kwargs, request_timeout=840)
        except Exception as e:
            raise ProviderError(f"{self.model_id} call failed: {e}") from e

        choice = resp["choices"][0]["message"]["content"] or ""
        cost = float(getattr(resp, "_hidden_params", {}).get("response_cost", 0.0) or 0.0)
        return LLMResult(text=choice, model_id=self.model_id, cost_usd=cost)


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
            resp = litellm.completion(**kwargs, request_timeout=840)
        except Exception as e:  # network down, rate-limited, auth -> fall back
            raise ProviderError(f"{self.model_id} call failed: {e}") from e

        choice = resp["choices"][0]["message"]["content"] or ""
        cost = float(getattr(resp, "_hidden_params", {}).get("response_cost", 0.0) or 0.0)
        return LLMResult(text=choice, model_id=self.model_id, cost_usd=cost)
