"""Bootstraps a Registry with providers. Mocks are always registered so the
gateway runs offline. Real providers are registered when their backends are
configured (Ollama running, ComfyUI up, hosted API key set) — uncomment /
extend as needed, then point routing.yaml at their model_ids."""
from __future__ import annotations

import os

from .interfaces import Cap
from .providers.llm import BedrockLLMProvider, EchoLLMProvider, LiteLLMProvider
from .providers.media import (
    ComfyUIImageProvider, ComfyUIVideoProvider, HttpMusicProvider,
    HttpTTSProvider, MockImageProvider, MockMusicProvider, MockTTSProvider,
    MockVideoProvider, ReplicateImageProvider, ReplicateVideoProvider,
    ReplicateTTSProvider, ReplicateMusicProvider,
    HuggingFaceImageProvider, HuggingFaceTTSProvider, HuggingFaceMusicProvider,
    DeepgramTTSProvider,
    KlingVideoProvider, HunyuanVideoProvider, MochiVideoProvider,
    RunwayMLVideoProvider, LumaVideoProvider,
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
            model_id="ollama/qwen2.5:7b", litellm_model="ollama/qwen2.5:7b",
            capabilities={Cap.FUNCTION_CALLING, Cap.JSON_MODE, Cap.MODERATION_OK},
            est_cost_usd=0.0, quality=7, api_base=ollama_host))

    # OpenRouter free-tier model (hosted, free, rate-limited).
    if os.getenv("OPENROUTER_API_KEY"):
        reg.register("llm", LiteLLMProvider(
            model_id="openrouter/qwen-2.5-72b:free",
            litellm_model="openrouter/qwen/qwen-2.5-72b-instruct:free",
            capabilities={Cap.FUNCTION_CALLING, Cap.JSON_MODE, Cap.LONG_CONTEXT},
            est_cost_usd=0.0, quality=8))

    # AWS Bedrock — Claude models for prod/staging. Registers when
    # AWS_BEDROCK_REGION is set. Uses IAM role if no explicit key/secret.
    bedrock_region = os.getenv("AWS_BEDROCK_REGION")
    if bedrock_region:
        reg.register("llm", BedrockLLMProvider(
            "bedrock/claude-haiku", bedrock_region,
            capabilities={Cap.FUNCTION_CALLING, Cap.JSON_MODE, Cap.MODERATION_OK, Cap.VISION},
            est_latency_s=1.5))
        reg.register("llm", BedrockLLMProvider(
            "bedrock/claude-sonnet", bedrock_region,
            capabilities={Cap.FUNCTION_CALLING, Cap.JSON_MODE, Cap.MODERATION_OK, Cap.VISION, Cap.LONG_CONTEXT},
            est_latency_s=3.0))
        reg.register("llm", BedrockLLMProvider(
            "bedrock/claude-opus", bedrock_region,
            capabilities={Cap.FUNCTION_CALLING, Cap.JSON_MODE, Cap.MODERATION_OK, Cap.VISION, Cap.LONG_CONTEXT},
            est_latency_s=6.0))

    # Deepgram TTS — free tier, high quality, no rate-limit issues.
    deepgram_key = os.getenv("DEEPGRAM_API_KEY")
    if deepgram_key:
        reg.register("tts", DeepgramTTSProvider(deepgram_key))

    # Hugging Face Inference API — free tier, image only via router endpoint.
    # TTS/music models are not supported by router.huggingface.co/hf-inference.
    hf_token = os.getenv("HF_API_TOKEN")
    if hf_token:
        reg.register("image", HuggingFaceImageProvider(
            "hf/flux-schnell", "black-forest-labs/FLUX.1-schnell",
            hf_token, {Cap.MODERATION_OK},
            est_cost_usd=0.0, est_latency_s=15.0, quality=7))
        # HF as free LLM fallback (Mistral-7B via hf-inference router)
        reg.register("llm", LiteLLMProvider(
            model_id="hf/mistral-7b",
            litellm_model="huggingface/mistralai/Mistral-7B-Instruct-v0.3",
            capabilities={Cap.JSON_MODE},
            est_cost_usd=0.0, est_latency_s=8.0, quality=5,
            api_base="https://router.huggingface.co/hf-inference/v1"))

    # Replicate — hosted GPU inference, pay per run.
    # Model slugs: visit replicate.com to confirm they're still live.
    replicate_token = os.getenv("REPLICATE_API_TOKEN")
    if replicate_token:
        reg.register("image", ReplicateImageProvider(
            "replicate/flux-schnell", "black-forest-labs/flux-schnell",
            replicate_token, {Cap.MODERATION_OK},
            est_cost_usd=0.005, est_latency_s=10.0, quality=8))
        # Video providers — registered best-quality first so routing.yaml
        # "route_order" naturally falls through in quality order.
        reg.register("video", KlingVideoProvider(
            "replicate/kling", "kwai-kolors/kling-video",
            replicate_token, {Cap.IMAGE_INIT, Cap.MODERATION_OK},
            est_cost_usd=0.028, est_latency_s=90.0, quality=8))
        reg.register("video", HunyuanVideoProvider(
            "replicate/hunyuan", "tencent/hunyuan-video",
            replicate_token, {Cap.MODERATION_OK},
            est_cost_usd=0.035, est_latency_s=180.0, quality=8))
        reg.register("video", MochiVideoProvider(
            "replicate/mochi", "genmoai/mochi-1",
            replicate_token, {Cap.MODERATION_OK},
            est_cost_usd=0.015, est_latency_s=120.0, quality=7))
        reg.register("video", ReplicateVideoProvider(
            "replicate/animate-diff", "lucataco/animate-diff",
            replicate_token, {Cap.MODERATION_OK},
            est_cost_usd=0.05, est_latency_s=60.0, quality=7,
            version="beecf59c4aee8d81bf04f0381033dfa10dc16e845b4ae00d281e2fa377e48a9f"))
        reg.register("tts", ReplicateTTSProvider(
            "replicate/kokoro", "jaaari/kokoro-82m",
            replicate_token, {Cap.MULTI_SPEAKER, Cap.MODERATION_OK},
            est_cost_usd=0.005, est_latency_s=10.0, quality=7,
            version="f559560eb822dc509045f3921a1921234918b91739db4bf3daab2169b71c7a13"))
        reg.register("music", ReplicateMusicProvider(
            "replicate/musicgen", "meta/musicgen",
            replicate_token, {Cap.MODERATION_OK},
            est_cost_usd=0.01, est_latency_s=30.0, quality=7,
            version="671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedcfb"))

    # Runway Gen-4 Turbo — best quality, requires RUNWAYML_API_KEY.
    runway_key = os.getenv("RUNWAYML_API_KEY")
    if runway_key:
        reg.register("video", RunwayMLVideoProvider(runway_key, "gen4_turbo"))

    # Luma Dream Machine — cinematic quality, requires LUMAAI_API_KEY.
    luma_key = os.getenv("LUMAAI_API_KEY")
    if luma_key:
        reg.register("video", LumaVideoProvider(luma_key))

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
