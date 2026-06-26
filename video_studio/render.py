"""Assembly + render.

`build_manifest` produces the timeline / edit-decision-list (the structured
artifact that drives final rendering). `render_mp4` turns it into a real .mp4
with ffmpeg: it uses each shot's actual clip when that clip is a valid video,
and otherwise generates a colored slate of the right duration — so the pipeline
yields a real, watchable file even fully offline with mock clips.
"""
from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

from .models import Project

_PALETTE = ["0x1f2a44", "0x3b2a4a", "0x14342b", "0x4a2a1f", "0x2a3a4a", "0x402a2a"]
_W, _H, _FPS = 320, 180, 24


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
         "-i", f"color=c={color}:s={_W}x{_H}:r={_FPS}:d={max(seconds,0.5)}",
         "-c:v", "libx264", "-pix_fmt", "yuv420p", str(dst)],
        capture_output=True, check=True, timeout=60)


def render_mp4(project: Project, out_dir: Path) -> tuple[str | None, bool]:
    """Returns (final_uri, used_real_clips). final_uri is None if ffmpeg absent."""
    if not _has_ffmpeg():
        return None, False

    parts_dir = out_dir / "_parts"
    parts_dir.mkdir(exist_ok=True)
    seg_paths, used_real = [], False

    for i, sh in enumerate(project.all_shots()):
        seg = parts_dir / f"seg_{i:03d}.mp4"
        if _is_real_video(sh.clip_uri):
            # re-encode the real clip to uniform params for safe concatenation
            subprocess.run(
                ["ffmpeg", "-y", "-i", sh.clip_uri, "-t", str(sh.seconds),
                 "-vf", f"scale={_W}:{_H}", "-r", str(_FPS),
                 "-c:v", "libx264", "-pix_fmt", "yuv420p", str(seg)],
                capture_output=True, check=True, timeout=120)
            used_real = True
        else:
            _slate(_PALETTE[i % len(_PALETTE)], sh.seconds, seg)
        seg_paths.append(seg)

    if not seg_paths:
        return None, False

    listing = parts_dir / "concat.txt"
    listing.write_text("".join(f"file '{p.resolve()}'\n" for p in seg_paths))
    final = out_dir / "final.mp4"
    subprocess.run(
        ["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(listing),
         "-c:v", "libx264", "-pix_fmt", "yuv420p", str(final)],
        capture_output=True, check=True, timeout=180)
    return str(final), used_real
