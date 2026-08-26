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


def synth_music(seconds: float, dst: Path, genre: str = "comedy") -> None:
    """Genre-aware algorithmic music bed using ffmpeg lavfi.

    Not AI-generated, but far better than a drone: layered harmonic tones,
    a rhythmic pulse, and gentle stereo movement. Used when musicgen is
    unavailable; replace by configuring REPLICATE_API_TOKEN + routing.
    """
    dur = max(seconds, 1.0)

    # Genre presets: (root_hz, chord_ratios, bpm, vol)
    presets = {
        "comedy":      (261.63, [1, 1.25, 1.5, 2.0], 138, 0.22),   # C major, upbeat
        "drama":       (146.83, [1, 1.189, 1.498, 2.0], 72, 0.18),  # D minor, slow
        "romance":     (196.00, [1, 1.25, 1.498, 2.0], 84, 0.18),   # G major, gentle
        "kids_cartoon":(261.63, [1, 1.25, 1.5, 1.782], 150, 0.20),  # C major, bright
    }
    root, ratios, bpm, vol = presets.get(genre, presets["comedy"])
    beat_hz = bpm / 60.0

    # Build one sine source per chord tone + a bass root an octave down
    sources, labels = [], []
    freqs = [root / 2] + [root * r for r in ratios]   # bass + chord tones
    for i, freq in enumerate(freqs):
        lbl = f"s{i}"
        # Slight detuning per voice for warmth; rhythmic tremolo on chord tones
        if i == 0:
            expr = (f"sine=frequency={freq:.2f}:duration={dur:.2f},"
                    f"volume={vol * 0.7:.3f}")
        else:
            tremolo_depth = 0.35 if i > 1 else 0.15
            expr = (f"sine=frequency={freq * (1 + i * 0.0003):.3f}:duration={dur:.2f},"
                    f"tremolo=f={beat_hz:.2f}:d={tremolo_depth:.2f},"
                    f"volume={vol / len(freqs):.3f}")
        sources += ["-f", "lavfi", "-i", expr]
        labels.append(f"[{i}:a]")

    # Mix all tones, add gentle stereo panning via aecho, fade in/out
    mix = (f"{''.join(labels)}amix=inputs={len(freqs)}:normalize=0[mix];"
           f"[mix]aecho=0.8:0.9:40|60:0.15|0.1[echo];"
           f"[echo]afade=t=in:st=0:d=1.5,afade=t=out:st={max(dur-2,0):.1f}:d=1.5[out]")

    _ff([*sources,
         "-filter_complex", mix,
         "-map", "[out]",
         "-ac", "2", "-ar", str(_SR),
         "-t", str(dur), str(dst)])


def mix_master(music: str, dialogue: list[tuple[float, str]], total_s: float,
               dst: Path) -> None:
    """Place each shot's dialogue at its timeline offset and mix with the music bed.

    Bug-fix notes:
    - amix=inputs=N:normalize=0 divides each input by N (straight average).
      For N sequential clips we compensate with volume=N so each clip plays
      at its original loudness.
    - The final amix=inputs=2 similarly needs volume=2 compensation.
    - We skip sidechain compression (it was masking the attenuation bug);
      instead music sits at a fixed 0.35 — clear, simple, always audible.
    """
    inputs = ["-i", music]
    for _, path in dialogue:
        inputs += ["-i", path]

    if not dialogue:
        _ff([*inputs, "-t", f"{total_s:.2f}", "-ac", "2", "-ar", str(_SR), str(dst)])
        return

    n = len(dialogue)
    parts, labels = [], []

    # Delay each dialogue clip to its shot's start offset on the timeline
    for idx, (start_s, _) in enumerate(dialogue, start=1):
        ms = int(start_s * 1000)
        parts.append(f"[{idx}]adelay={ms}|{ms}[d{idx}]")
        labels.append(f"[d{idx}]")

    # Combine all delayed dialogue clips.
    # amix with normalize=0 divides by N; multiply back with volume=N so each
    # clip that is active plays at its original (pre-mix) loudness.
    parts.append(
        f"{''.join(labels)}amix=inputs={n}:normalize=0:"
        f"duration=longest,apad,volume={n:.1f}[dlg]"
    )

    # Music bed at 35% so conversation is clearly dominant
    parts.append("[0]volume=0.35[mbed]")

    # Final mix: music + dialogue.  volume=2 compensates for amix's ÷2.
    parts.append("[mbed][dlg]amix=inputs=2:normalize=0,volume=2[mix]")

    filt = ";".join(parts)
    try:
        _ff([*inputs, "-filter_complex", filt, "-map", "[mix]",
             "-t", f"{total_s:.2f}", "-ac", "2", "-ar", str(_SR), str(dst)])
    except subprocess.CalledProcessError:
        # Fallback: merge music + dialogue with explicit gains
        fb = ";".join([
            *parts[:n],                                          # adelay lines
            f"{''.join(labels)}amix=inputs={n}:normalize=0,volume={n:.1f}[dlg]",
            "[0]volume=0.35[mbed]",
            "[mbed][dlg]amix=inputs=2:normalize=0,volume=2[mix]",
        ])
        _ff([*inputs, "-filter_complex", fb, "-map", "[mix]",
             "-t", f"{total_s:.2f}", "-ac", "2", "-ar", str(_SR), str(dst)])


def _silence(ms: int, dst: Path) -> None:
    """Write a short silent WAV clip of the given duration."""
    _ff(["-f", "lavfi", "-i",
         f"anullsrc=r={_SR}:cl=stereo,atrim=duration={ms / 1000:.3f}",
         "-ac", "2", "-ar", str(_SR), str(dst)])


def concat_audio(parts: list[Path], dst: Path,
                 gaps_ms: list[int] | None = None) -> None:
    """Concatenate per-line audio clips with optional silence gaps between them.

    gaps_ms[i] is the gap in milliseconds inserted between parts[i] and parts[i+1].
    If omitted, clips are joined with no gap (backward-compatible).
    """
    if len(parts) == 1:
        _ff(["-i", str(parts[0]), "-ac", "2", "-ar", str(_SR), str(dst)])
        return
    if not gaps_ms:
        listing = dst.with_suffix(".concat.txt")
        listing.write_text("".join(f"file '{p.resolve()}'\n" for p in parts))
        _ff(["-f", "concat", "-safe", "0", "-i", str(listing),
             "-ac", "2", "-ar", str(_SR), str(dst)])
        return
    # Interleave silence clips between the audio lines
    full: list[Path] = []
    for i, part in enumerate(parts):
        full.append(part)
        if i < len(parts) - 1:
            ms = gaps_ms[i] if i < len(gaps_ms) else 200
            sil = dst.parent / f"sil_{dst.stem}_{i}.wav"
            _silence(ms, sil)
            full.append(sil)
    listing = dst.with_suffix(".concat.txt")
    listing.write_text("".join(f"file '{p.resolve()}'\n" for p in full))
    _ff(["-f", "concat", "-safe", "0", "-i", str(listing),
         "-ac", "2", "-ar", str(_SR), str(dst)])


def mux_av(video: str, audio: str, dst: Path) -> None:
    _ff(["-i", video, "-i", audio, "-c:v", "copy", "-c:a", "aac", "-b:a", "160k",
         "-map", "0:v:0", "-map", "1:a:0", "-shortest", str(dst)])
