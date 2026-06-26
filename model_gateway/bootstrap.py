"""Bootstraps a Registry with providers. Mocks are always registered so the
gateway runs offline. Real providers are registered when their backends are
configured (Ollama running, ComfyUI up, hosted API key set) — uncomment /
extend as needed, then point routing.yaml at their model_ids."""
from __future__ import annotations

import os

from .interfaces import Cap
from .providers.llm import EchoLLMProvider, LiteLLMProvider
from .providers.media import (
    ComfyUIImageProvider, ComfyUIVideoProvider, HttpMusicProvider,
    HttpTTSProvider, MockImageProvider, MockMusicProvider, MockTTSProvider,
    MockVideoProvider,
)
from .registry import Registry


def build_registry() -> Registry:
    reg = Registry()

    # --- Always-on offline mocks (free, est_cost 0.0) -----------------------
    reg.register("llm", EchoLLMProvider())
    reg.register("image", MockImageProvider())
    reg.register("video", MockVideoProvider())
    reg.register("tts", MockTTSProvider())
    reg.register("music", MockMusicProvider())

    # --- Real free/open providers (registered when backends are available) --
    # Local Ollama (truly free, self-hosted). Auto-registers if OLLAMA_HOST set.
    ollama_host = os.getenv("OLLAMA_HOST")
    if ollama_host:
        reg.register("llm", LiteLLMProvider(
            model_id="ollama/qwen2.5:32b", litellm_model="ollama/qwen2.5:32b",
            capabilities={Cap.FUNCTION_CALLING, Cap.JSON_MODE, Cap.MODERATION_OK},
            est_cost_usd=0.0, quality=7, api_base=ollama_host))

    # OpenRouter free-tier model (hosted, free, rate-limited).
    if os.getenv("OPENROUTER_API_KEY"):
        reg.register("llm", LiteLLMProvider(
            model_id="openrouter/qwen-2.5-72b:free",
            litellm_model="openrouter/qwen/qwen-2.5-72b-instruct:free",
            capabilities={Cap.FUNCTION_CALLING, Cap.JSON_MODE, Cap.LONG_CONTEXT},
            est_cost_usd=0.0, quality=8))

    # Self-hosted ComfyUI media backends.
    comfy = os.getenv("COMFYUI_URL")
    if comfy:
        reg.register("image", ComfyUIImageProvider(
            "comfyui/flux-schnell", f"{comfy}/generate/image",
            {Cap.MODERATION_OK}, est_cost_usd=0.0, quality=8))
        reg.register("video", ComfyUIVideoProvider(
            "comfyui/ltx-video", f"{comfy}/generate/video",
            {Cap.IMAGE_INIT, Cap.MODERATION_OK}, est_cost_usd=0.0, quality=6))
        reg.register("tts", HttpTTSProvider(
            "comfyui/kokoro", f"{comfy}/generate/tts",
            {Cap.MULTI_SPEAKER, Cap.MODERATION_OK}, est_cost_usd=0.0, quality=7))
        reg.register("music", HttpMusicProvider(
            "comfyui/musicgen", f"{comfy}/generate/music",
            {Cap.MODERATION_OK}, est_cost_usd=0.0, quality=5))

    return reg
