"""The six pipeline stages. Each stage:
  - is idempotent (skips work already present, so resume is cheap),
  - mutates the Project in place,
  - returns (model_used, cost_usd) for the stage record.

AI stages call the Model Gateway through the StageContext; assembly/render are
local. Script generation asks the LLM for a structured shot list; if the
configured model returns usable JSON it's used verbatim, otherwise a coherent
skeleton is synthesized from the genre beats so the whole pipeline still runs
end-to-end offline (richness scales with the LLM you plug in).
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path

from .gateway_client import Gateway
from .genres import template_for
from .models import Character, Episode, Line, Project, Scene, Shot
from .render import build_manifest, render_mp4
from .store import ProjectStore


@dataclass
class StageContext:
    gw: Gateway
    store: ProjectStore
    media_dir: Path


# --- helpers ----------------------------------------------------------------
def _extract_json(text: str) -> dict | None:
    t = re.sub(r"```(?:json)?", "", text).strip()
    start = t.find("{")
    if start == -1:
        return None
    depth = 0
    for i in range(start, len(t)):
        depth += (t[i] == "{") - (t[i] == "}")
        if depth == 0:
            try:
                return json.loads(t[start:i + 1])
            except Exception:
                return None
    return None


def _skeleton_episode(project: Project) -> tuple[Episode, list[Character]]:
    """Deterministic fallback shot list built from the genre's structural beats."""
    tpl = template_for(project.genre)
    cast = (["Pip", "Bo"] if project.genre.value == "kids_cartoon" else ["Avery", "Sam"])
    chars = [Character(name=c, description=f"{c}, a main character of '{project.title}'")
             for c in cast]
    shots = []
    for i, beat in enumerate(tpl.beats, 1):
        speaker = cast[i % len(cast)]
        shots.append(Shot(
            id=f"S{i}",
            description=f"{beat.capitalize()} — {project.concept}",
            dialogue=[Line(character=speaker, text=f"({beat})")],
            seconds=tpl.shot_seconds,
            characters=cast,
        ))
    ep = Episode(number=1, title=project.title,
                 logline=f"A {project.genre.value} episode: {project.concept}",
                 scenes=[Scene(id="SC1", setting="Establishing location", shots=shots)])
    return ep, chars


def _parse_episode(data: dict, project: Project) -> tuple[Episode, list[Character]] | None:
    try:
        scenes = []
        names: set[str] = set()
        for j, sc in enumerate(data["scenes"], 1):
            shots = []
            for k, sh in enumerate(sc.get("shots", []), 1):
                dlg = [Line(character=d["character"], text=d.get("text", ""))
                       for d in sh.get("dialogue", [])]
                chars = sh.get("characters", [d.character for d in dlg])
                names.update(chars)
                shots.append(Shot(id=sh.get("id", f"S{j}_{k}"),
                                  description=sh["description"],
                                  dialogue=dlg, characters=chars,
                                  seconds=float(sh.get("seconds",
                                                template_for(project.genre).shot_seconds))))
            scenes.append(Scene(id=sc.get("id", f"SC{j}"),
                                setting=sc.get("setting", ""), shots=shots))
        if not scenes:
            return None
        ep = Episode(number=1, title=data.get("title", project.title),
                     logline=data.get("logline", ""), scenes=scenes)
        chars = [Character(name=n) for n in sorted(names)] or \
                [Character(name="Lead")]
        return ep, chars
    except Exception:
        return None


# --- stages -----------------------------------------------------------------
def write_script(project: Project, ctx: StageContext) -> tuple[str, float]:
    tpl = template_for(project.genre)
    project.style_prompt = tpl.style_prompt
    prompt = (
        f"You are a TV writer. Write episode 1 of a {project.genre.value} series.\n"
        f"Premise: {project.concept}\nTone: {tpl.tone}\n"
        f"Structure it across these beats: {', '.join(tpl.beats)}.\n"
        f"Safety: {tpl.safety_notes}\n"
        "Respond ONLY with JSON of shape: {title, logline, scenes:[{id,setting,"
        "shots:[{id,description,seconds,characters:[..],dialogue:[{character,text}]}]}]}"
    )
    res = ctx.gw.llm(tpl.llm_task, [{"role": "user", "content": prompt}],
                     json_mode=True, required_caps=tpl.required_caps)

    parsed = _extract_json(res.text)
    built = _parse_episode(parsed, project) if parsed else None
    if built is None:
        built = _skeleton_episode(project)   # offline / non-JSON model fallback
    project.episode, project.characters = built
    return res.model_used, res.cost_usd


def design_characters(project: Project, ctx: StageContext) -> tuple[str, float]:
    """Generate one reference image per character, reused across all shots."""
    tpl = template_for(project.genre)
    cost, model = 0.0, ""
    for ch in project.characters:
        if ch.reference_uri:
            continue
        desc = ch.description or f"{ch.name}, a character in '{project.title}'"
        res = ctx.gw.image(
            "default",
            f"Character reference sheet: {desc}. Style: {tpl.style_prompt}")
        ch.reference_uri, model, cost = res.uri, res.model_used, cost + res.cost_usd
    return model or "n/a", cost


def generate_keyframes(project: Project, ctx: StageContext) -> tuple[str, float]:
    cost, model = 0.0, ""
    for sh in project.all_shots():
        if sh.keyframe_uri:
            continue
        cast = ", ".join(sh.characters) if sh.characters else "the cast"
        res = ctx.gw.image(
            "default",
            f"{sh.description}. Featuring {cast}. Style: {project.style_prompt}")
        sh.keyframe_uri, model, cost = res.uri, res.model_used, cost + res.cost_usd
    return model or "n/a", cost


def generate_clips(project: Project, ctx: StageContext) -> tuple[str, float]:
    tpl = template_for(project.genre)
    cost, model = 0.0, ""
    for sh in project.all_shots():
        if sh.clip_uri:
            continue
        res = ctx.gw.video(
            "default",
            f"{sh.description}. Style: {project.style_prompt}",
            seconds=sh.seconds, init_image=sh.keyframe_uri,
            required_caps=tpl.required_caps)
        sh.clip_uri, model, cost = res.uri, res.model_used, cost + res.cost_usd
    return model or "n/a", cost


def assemble(project: Project, ctx: StageContext) -> tuple[str, float]:
    project.manifest_uri = build_manifest(project, ctx.media_dir)
    return "local/assembler", 0.0


def render(project: Project, ctx: StageContext) -> tuple[str, float]:
    final_uri, used_real = render_mp4(project, ctx.media_dir)
    project.final_uri = final_uri
    return ("local/ffmpeg" if final_uri else "local/ffmpeg(absent)"), 0.0


# Ordered pipeline. (Audio mux is the next slice, B5.)
STAGES = [
    ("write_script", write_script),
    ("design_characters", design_characters),
    ("generate_keyframes", generate_keyframes),
    ("generate_clips", generate_clips),
    ("assemble", assemble),
    ("render", render),
]
