"""ffmpeg-backed audio helpers.

Mirrors the video render approach: if the gateway returns a real audio file
(real TTS/music provider), it's used as-is; otherwise a real placeholder is
synthesized so the whole audio chain — dialogue, music bed, ducked mix, and
A/V mux — produces an actual playable file fully offline.
"""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

from .voices import Voice

_SR = 44100


def has_ffmpeg() -> bool:
    return shutil.which("ffmpeg") is not None and shutil.which("ffprobe") is not None


def is_real_audio(path: str | None) -> bool:
    if not path or not Path(path).exists():
        return False
    try:
        out = subprocess.run(
            ["ffprobe", "-v", "error", "-select_streams", "a:0",
             "-show_entries", "stream=codec_type", "-of", "csv=p=0", path],
            capture_output=True, text=True, timeout=20)
        return out.returncode == 0 and "audio" in out.stdout
    except Exception:
        return False


def estimate_speech_seconds(text: str, cap: float) -> float:
    words = max(1, len(text.split()))
    return max(0.8, min(cap, words / 2.5))   # ~150 wpm, clamped to the shot length


def _ff(args: list[str]) -> None:
    subprocess.run(["ffmpeg", "-y", *args], capture_output=True, check=True, timeout=180)


def synth_speech(text: str, voice: Voice, seconds: float, dst: Path) -> None:
    """Placeholder speech: a soft tremolo tone at the voice's timbre frequency.
    Real TTS output replaces this when a TTS provider is configured."""
    expr = (f"sine=frequency={voice.base_freq}:duration={seconds:.2f},"
            f"tremolo=f=5:d=0.6,volume=0.6,"
            f"aformat=sample_rates={_SR}:channel_layouts=stereo")
    _ff(["-f", "lavfi", "-i", expr, "-ac", "2", "-ar", str(_SR), str(dst)])


def synth_music(seconds: float, dst: Path) -> None:
    """Placeholder music bed: a quiet low drone. Real music model output
    replaces this when a music provider is configured."""
    expr = (f"sine=frequency=110:duration={seconds:.2f},"
            f"volume=0.25,aformat=sample_rates={_SR}:channel_layouts=stereo")
    _ff(["-f", "lavfi", "-i", expr, "-ac", "2", "-ar", str(_SR), str(dst)])


def mix_master(music: str, dialogue: list[tuple[float, str]], total_s: float,
               dst: Path) -> None:
    """Place each shot's dialogue at its timeline offset, duck the music
    underneath it (sidechain compression), and mix to a single master track."""
    inputs = ["-i", music]
    for _, path in dialogue:
        inputs += ["-i", path]

    if not dialogue:
        _ff([*inputs, "-t", f"{total_s:.2f}", "-ac", "2", "-ar", str(_SR), str(dst)])
        return

    parts, labels = [], []
    for idx, (start_s, _) in enumerate(dialogue, start=1):
        ms = int(start_s * 1000)
        parts.append(f"[{idx}]adelay={ms}|{ms}[d{idx}]")
        labels.append(f"[d{idx}]")
    parts.append(f"{''.join(labels)}amix=inputs={len(dialogue)}:normalize=0:"
                 f"duration=longest,apad[dlg]")
    # duck the music under the dialogue, then mix the two
    parts.append("[0]volume=0.7[mbed]")
    parts.append("[mbed][dlg]sidechaincompress=threshold=0.05:ratio=6:"
                 "attack=20:release=300[duck]")
    parts.append("[duck][dlg]amix=inputs=2:normalize=0[mix]")
    filt = ";".join(parts)

    try:
        _ff([*inputs, "-filter_complex", filt, "-map", "[mix]",
             "-t", f"{total_s:.2f}", "-ac", "2", "-ar", str(_SR), str(dst)])
    except subprocess.CalledProcessError:
        # robust fallback: simple mix without sidechain ducking
        simple = ";".join([*parts[:len(dialogue)],
                           f"{''.join(labels)}amix=inputs={len(dialogue)}:normalize=0[dlg]",
                           "[0]volume=0.4[mbed]",
                           "[mbed][dlg]amix=inputs=2:normalize=0[mix]"])
        _ff([*inputs, "-filter_complex", simple, "-map", "[mix]",
             "-t", f"{total_s:.2f}", "-ac", "2", "-ar", str(_SR), str(dst)])


def mux_av(video: str, audio: str, dst: Path) -> None:
    _ff(["-i", video, "-i", audio, "-c:v", "copy", "-c:a", "aac", "-b:a", "160k",
         "-map", "0:v:0", "-map", "1:a:0", "-shortest", str(dst)])
