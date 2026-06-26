"""Capability contracts shared by every provider.

The core idea of the gateway: product code asks for a *capability*
(generate an image, synthesize speech) and never names a concrete model.
Every provider — free hosted, self-hosted open-weight, or paid — implements
the same modality interface, so they are fully interchangeable.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol, runtime_checkable


# --- Capability flags -------------------------------------------------------
# Declared by providers; used by the router (and the UI) to only offer a model
# for tasks it can actually perform.
class Cap:
    FUNCTION_CALLING = "function_calling"
    JSON_MODE = "json"
    VISION = "vision"
    LONG_CONTEXT = "long_context"
    MODERATION_OK = "moderation_ok"      # vetted as safe for kids' content
    MULTI_SPEAKER = "multi_speaker"
    VOICE_CLONING = "voice_cloning"
    IMAGE_INIT = "image_init"            # video model accepts an init image


# --- Result / asset types ---------------------------------------------------
@dataclass
class LLMMessage:
    role: str
    content: str


@dataclass
class LLMResult:
    text: str
    model_id: str = ""
    cost_usd: float = 0.0
    tokens_out: int = 0


@dataclass
class MediaAsset:
    """A produced media file. `uri` points at object storage in production."""
    uri: str
    mime: str
    model_id: str = ""
    cost_usd: float = 0.0
    meta: dict = field(default_factory=dict)


# --- Provider protocols (one per modality) ----------------------------------
@runtime_checkable
class LLMProvider(Protocol):
    model_id: str
    capabilities: set[str]
    est_cost_usd: float
    est_latency_s: float
    quality: int

    def generate(
        self, messages: list[LLMMessage], *, tools: list | None = None,
        json_mode: bool = False,
    ) -> LLMResult: ...


@runtime_checkable
class ImageProvider(Protocol):
    model_id: str
    capabilities: set[str]
    est_cost_usd: float
    est_latency_s: float
    quality: int

    def generate(self, prompt: str, *, width: int = 1024, height: int = 576) -> MediaAsset: ...


@runtime_checkable
class VideoProvider(Protocol):
    model_id: str
    capabilities: set[str]
    est_cost_usd: float
    est_latency_s: float
    quality: int

    def generate(
        self, prompt: str, *, seconds: float = 5.0, fps: int = 24,
        init_image: str | None = None,
    ) -> MediaAsset: ...


@runtime_checkable
class TTSProvider(Protocol):
    model_id: str
    capabilities: set[str]
    est_cost_usd: float
    est_latency_s: float
    quality: int

    def synthesize(self, text: str, *, voice_id: str = "default") -> MediaAsset: ...


@runtime_checkable
class MusicProvider(Protocol):
    model_id: str
    capabilities: set[str]
    est_cost_usd: float
    est_latency_s: float
    quality: int

    def generate(self, prompt: str, *, seconds: float = 15.0) -> MediaAsset: ...


MODALITIES = ("llm", "image", "video", "tts", "music")
