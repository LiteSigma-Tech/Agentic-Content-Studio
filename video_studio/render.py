"""Assembly + render.

`build_manifest` produces the timeline / edit-decision-list (the structured
artifact that drives final rendering). `render_mp4` turns it into a real .mp4
with ffmpeg: it uses each shot's actual clip when that clip is a valid video,
and otherwise applies a cinematic Ken Burns effect to the keyframe image so
the pipeline always yields a watchable file even without a video provider.
"""
from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

from .models import Project

_PALETTE = ["0x1f2a44", "0x3b2a4a", "0x14342b", "0x4a2a1f", "0x2a3a4a", "0x402a2a"]

# Output resolution and frame-rate.  720p gives a clean, watchable result.
_W, _H, _FPS = 1280, 720, 24

# Cross-fade duration (seconds) between shots when rendering from keyframes.
_XFADE_DURATION = 0.4


def _has_ffmpeg() -> bool:
    return shutil.which("ffmpeg") is not None and shutil.which("ffprobe") is not None


def _is_real_video(path: str | None) -> bool:
    if not path or not Path(path).exists():
        return False
    try:
        out = subprocess.run(
            ["ffprobe", "-v", "error", "-select_streams", "v:0",
             "-show_entries", "stream=codec_type", "-of", "csv=p=0", path],
            capture_output=True, text=True, timeout=20)
        return out.returncode == 0 and "video" in out.stdout
    except Exception:
        return False


def build_manifest(project: Project, out_dir: Path) -> str:
    """Timeline/EDL: ordered clips with start times. Saved as JSON."""
    timeline, t = [], 0.0
    for sc in project.episode.scenes:
        for sh in sc.shots:
            timeline.append({
                "shot_id": sh.id, "scene": sc.id, "start": round(t, 3),
                "seconds": sh.seconds, "clip_uri": sh.clip_uri,
                "keyframe_uri": sh.keyframe_uri, "transition": "cut",
                "description": sh.description,
            })
            t += sh.seconds
    manifest = {"project_id": project.id, "title": project.title,
                "genre": project.genre.value, "duration_s": round(t, 3),
                "style_prompt": project.style_prompt, "timeline": timeline}
    path = out_dir / "manifest.json"
    path.write_text(json.dumps(manifest, indent=2))
    return str(path)


def _slate(color: str, seconds: float, dst: Path) -> None:
    subprocess.run(
        ["ffmpeg", "-y", "-f", "lavfi",
         "-i", f"color=c={color}:s={_W}x{_H}:r={_FPS}:d={max(seconds, 0.5)}",
         "-c:v", "libx264", "-pix_fmt", "yuv420p", str(dst)],
        capture_output=True, check=True, timeout=60)


# Cinematic Ken Burns effects — cycled across shots for visual variety.
# Each entry is a (zoom_expr, x_expr, y_expr) tuple for the zoompan filter.
_KB_EFFECTS = [
    # slow zoom in, centred
    ("min(zoom+0.001,1.25)", "iw/2-(iw/zoom/2)", "ih/2-(ih/zoom/2)"),
    # slow zoom out from 1.25 → 1.0
    ("if(lte(zoom,1.0),1.25,max(zoom-0.001,1.0))", "iw/2-(iw/zoom/2)", "ih/2-(ih/zoom/2)"),
    # pan right while holding slight zoom
    ("1.2", "min(x+1.0,iw*(1-1/zoom))", "ih/2-(ih/zoom/2)"),
    # pan left
    ("1.2", "max(x-1.0,0)", "ih/2-(ih/zoom/2)"),
    # diagonal drift — top-left to bottom-right
    ("1.15", "min(x+0.6,iw*(1-1/zoom))", "min(y+0.4,ih*(1-1/zoom))"),
    # slow zoom in with slight upward tilt
    ("min(zoom+0.001,1.2)", "iw/2-(iw/zoom/2)", "max(ih/2-(ih/zoom/2)-0.5,0)"),
]


def _image_to_video(image_path: str, seconds: float, dst: Path,
                    effect_idx: int = 0) -> bool:
    """Animate a keyframe with a cinematic Ken Burns effect.

    Cycles through _KB_EFFECTS for visual variety across shots.
    Returns True on success, False if ffmpeg fails.
    """
    z_expr, x_expr, y_expr = _KB_EFFECTS[effect_idx % len(_KB_EFFECTS)]
    n_frames = int(max(seconds, 0.5) * _FPS)
    # Upscale 2× before zoompan so the filter has headroom to crop into
    src_w, src_h = _W * 2, _H * 2
    vf = (
        f"scale={src_w}:{src_h}:force_original_aspect_ratio=decrease,"
        f"pad={src_w}:{src_h}:(ow-iw)/2:(oh-ih)/2,setsar=1,"
        f"zoompan=z='{z_expr}':x='{x_expr}':y='{y_expr}'"
        f":d={n_frames}:s={_W}x{_H}:fps={_FPS},"
        f"setsar=1"
    )
    try:
        subprocess.run(
            ["ffmpeg", "-y", "-loop", "1", "-i", image_path,
             "-vf", vf,
             "-t", str(max(seconds, 0.5)),
             "-c:v", "libx264", "-preset", "fast", "-pix_fmt", "yuv420p", str(dst)],
            capture_output=True, check=True, timeout=180)
        return True
    except Exception:
        return False


def _xfade_concat(seg_paths: list[Path], durations: list[float],
                  out: Path) -> bool:
    """Chain segments with xfade cross-dissolve transitions.

    Falls back to plain concat if xfade fails (e.g. only one segment).
    """
    if len(seg_paths) <= 1:
        listing = out.parent / "_concat.txt"
        listing.write_text("".join(f"file '{p.resolve()}'\n" for p in seg_paths))
        try:
            subprocess.run(
                ["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(listing),
                 "-c:v", "libx264", "-pix_fmt", "yuv420p", str(out)],
                capture_output=True, check=True, timeout=300)
            return True
        except Exception:
            return False

    xd = min(_XFADE_DURATION, min(durations) * 0.4)   # cap at 40% of shortest clip
    inputs = []
    for p in seg_paths:
        inputs += ["-i", str(p)]

    # Build filter_complex xfade chain
    # offset_N = cumulative_duration_up_to_N - xd * N  (accounting for overlaps)
    prev_label = "0:v"
    filt_parts = []
    cumulative = 0.0
    for idx in range(1, len(seg_paths)):
        cumulative += durations[idx - 1] - xd
        out_label = f"v{idx}"
        filt_parts.append(
            f"[{prev_label}][{idx}:v]"
            f"xfade=transition=fade:duration={xd:.3f}:offset={cumulative:.3f}"
            f"[{out_label}]"
        )
        prev_label = out_label

    filt = ";".join(filt_parts)
    try:
        subprocess.run(
            ["ffmpeg", "-y", *inputs,
             "-filter_complex", filt,
             "-map", f"[{prev_label}]",
             "-c:v", "libx264", "-preset", "fast", "-pix_fmt", "yuv420p", str(out)],
            capture_output=True, check=True, timeout=300)
        return True
    except Exception:
        # Fall back to plain concat
        listing = out.parent / "_concat.txt"
        listing.write_text("".join(f"file '{p.resolve()}'\n" for p in seg_paths))
        try:
            subprocess.run(
                ["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(listing),
                 "-c:v", "libx264", "-pix_fmt", "yuv420p", str(out)],
                capture_output=True, check=True, timeout=300)
            return True
        except Exception:
            return False


def render_mp4(project: Project, out_dir: Path) -> tuple[str | None, bool]:
    """Returns (final_uri, used_real_clips). final_uri is None if ffmpeg absent."""
    if not _has_ffmpeg():
        return None, False

    parts_dir = out_dir / "_parts"
    parts_dir.mkdir(exist_ok=True)
    seg_paths, durations, used_real = [], [], False
    all_keyframe = True   # True when every shot came from a keyframe (enables xfade)

    for i, sh in enumerate(project.all_shots()):
        seg = parts_dir / f"seg_{i:03d}.mp4"
        if _is_real_video(sh.clip_uri):
            subprocess.run(
                ["ffmpeg", "-y", "-stream_loop", "-1", "-i", sh.clip_uri,
                 "-t", str(sh.seconds),
                 "-vf", f"scale={_W}:{_H}:force_original_aspect_ratio=decrease,"
                        f"pad={_W}:{_H}:(ow-iw)/2:(oh-ih)/2,setsar=1",
                 "-r", str(_FPS), "-c:v", "libx264", "-preset", "fast",
                 "-pix_fmt", "yuv420p", str(seg)],
                capture_output=True, check=True, timeout=120)
            used_real = True
            all_keyframe = False
        elif sh.keyframe_uri and Path(sh.keyframe_uri).exists():
            if not _image_to_video(sh.keyframe_uri, sh.seconds, seg, effect_idx=i):
                _slate(_PALETTE[i % len(_PALETTE)], sh.seconds, seg)
                all_keyframe = False
        else:
            _slate(_PALETTE[i % len(_PALETTE)], sh.seconds, seg)
            all_keyframe = False
        seg_paths.append(seg)
        durations.append(sh.seconds)

    if not seg_paths:
        return None, False

    final = out_dir / "final.mp4"

    # Use xfade only when every shot came from a keyframe AND there is no
    # dialogue audio.  xfade shortens the video by (n_cuts × _XFADE_DURATION)
    # which drifts the audio timeline out of sync when dialogue is present.
    has_dialogue = any(sh.dialogue_audio_uri for sh in project.all_shots())
    if all_keyframe and not has_dialogue and len(seg_paths) > 1:
        _xfade_concat(seg_paths, durations, final)
    else:
        listing = parts_dir / "concat.txt"
        listing.write_text("".join(f"file '{p.resolve()}'\n" for p in seg_paths))
        subprocess.run(
            ["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(listing),
             "-c:v", "libx264", "-pix_fmt", "yuv420p", str(final)],
            capture_output=True, check=True, timeout=300)

    return str(final) if final.exists() else None, used_real
