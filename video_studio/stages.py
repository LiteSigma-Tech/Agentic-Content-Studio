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
                                  seconds=max(4.0, float(sh.get("seconds",
                                              template_for(project.genre).shot_seconds)))))
            scenes.append(Scene(id=sc.get("id", f"SC{j}"),
                                setting=sc.get("setting", ""), shots=shots))
        if not scenes:
            return None
        ep = Episode(number=1, title=data.get("title", project.title),
                     logline=data.get("logline", ""), scenes=scenes)
        # Use top-level characters array (with descriptions) when the LLM provides it.
        char_defs = {c["name"]: c.get("description", "")
                     for c in data.get("characters", []) if "name" in c}
        chars = [Character(name=n, description=char_defs.get(n, "")) for n in sorted(names)] or \
                [Character(name="Lead")]
        return ep, chars
    except Exception:
        return None


# --- stages -----------------------------------------------------------------
def _script_critique(episode: Episode, characters: list[Character]) -> str | None:
    """Return a critique string if descriptions are too thin; None if quality is fine."""
    issues = []
    thin_chars = [ch.name for ch in characters if len(ch.description) < 50]
    if thin_chars:
        issues.append(
            f"Characters need fuller physical descriptions (age, build, hair, clothing, "
            f"distinguishing features): {', '.join(thin_chars)}")
    thin_shots = [sh.id for sc in episode.scenes for sh in sc.shots
                  if len(sh.description) < 80]
    if thin_shots:
        issues.append(
            f"Shots need richer self-contained visual descriptions "
            f"(setting, lighting, positions, action, mood): {', '.join(thin_shots[:6])}")
    return " | ".join(issues) if issues else None


def write_script(project: Project, ctx: StageContext) -> tuple[str, float]:
    tpl = template_for(project.genre)
    project.style_prompt = tpl.style_prompt

    _json_shape = (
        '{"title":"...","logline":"...","characters":[{"name":"...","description":"..."}],'
        '"scenes":[{"id":"...","setting":"...","shots":[{"id":"...","description":"...",'
        '"seconds":5,"characters":["..."],"dialogue":[{"character":"...","text":"..."}]}]}]}'
    )

    # If concept is a detailed script (> 300 chars), convert it to shot JSON
    # instead of generating a new script from scratch.
    if len(project.concept) > 300:
        prompt = (
            f"You are a senior TV production assistant converting a script into a structured "
            f"episode JSON for an AI video pipeline.\n"
            f"Genre: {project.genre.value}. Safety: {tpl.safety_notes}\n\n"
            f"SCRIPT:\n{project.concept}\n\n"
            "Complete ALL three tasks before outputting JSON:\n\n"
            "TASK 1 — CHARACTERS: Identify every speaking or visible character. "
            "For each, write a detailed physical description covering age, build, hair colour and style, "
            "clothing, and any distinguishing features — enough for an AI image model to generate a "
            "consistent reference sheet across multiple shots.\n\n"
            "TASK 2 — SHOTS: Extract 8-15 key visual moments as shots. For each shot:\n"
            "  • Write a rich, self-contained visual description (3-5 sentences) covering exactly "
            "what the camera sees: setting details, lighting quality, character positions, "
            "actions, and emotional mood. Do NOT reference earlier shots — every description "
            "must work in isolation for image generation.\n"
            "  • Set seconds=5.\n"
            "  • Preserve dialogue exactly as written in the script.\n"
            "  • Group shots into scenes by location/setting.\n\n"
            "TASK 3 — OUTPUT: Respond ONLY with valid JSON matching this exact shape:\n"
            + _json_shape
        )
    else:
        prompt = (
            f"You are a professional TV writer creating a fully realised episode for an AI video pipeline.\n"
            f"Genre: {project.genre.value}. Premise: {project.concept}\n"
            f"Tone: {tpl.tone}\n"
            f"Narrative beats to cover in order: {', '.join(tpl.beats)}.\n"
            f"Safety: {tpl.safety_notes}\n\n"
            "Complete ALL three tasks before outputting JSON:\n\n"
            "TASK 1 — CHARACTERS: Define 2-4 characters. For each, write a detailed physical "
            "description covering age, build, hair colour and style, clothing, and any distinguishing "
            "features — enough for an AI image model to generate a consistent reference sheet.\n\n"
            "TASK 2 — SHOTS: Write 5-8 shots across 1-3 scenes so every beat above is covered by "
            "at least one shot. For each shot:\n"
            "  • Write a rich, self-contained visual description (3-5 sentences) covering exactly "
            "what the camera sees: setting details, lighting quality, character positions, "
            "actions, and emotional mood. Do NOT reference earlier shots — every description "
            "must work in isolation for image generation.\n"
            f"  • Visual style to reflect: {tpl.style_prompt}\n"
            "  • Set seconds=5.\n"
            "  • Write natural, character-specific dialogue.\n\n"
            "TASK 3 — OUTPUT: Respond ONLY with valid JSON matching this exact shape:\n"
            + _json_shape
        )
    override = project.prompt_overrides.get("write_script", "")
    if override:
        prompt += f"\n\nREVIEWER NOTES — incorporate these changes:\n{override}"

    res = ctx.gw.llm(tpl.llm_task, [{"role": "user", "content": prompt}],
                     json_mode=True, required_caps=tpl.required_caps)

    parsed = _extract_json(res.text)
    built = _parse_episode(parsed, project) if parsed else None

    # Quality gate: if descriptions are thin, retry once with targeted feedback.
    if built is not None:
        critique = _script_critique(*built)
        if critique:
            res2 = ctx.gw.llm(
                tpl.llm_task,
                [{"role": "user", "content": prompt},
                 {"role": "assistant", "content": res.text},
                 {"role": "user", "content":
                  f"Rejected — output was too thin. Fix these issues and rewrite the "
                  f"complete JSON from scratch:\n{critique}"}],
                json_mode=True, required_caps=tpl.required_caps)
            parsed2 = _extract_json(res2.text)
            built2 = _parse_episode(parsed2, project) if parsed2 else None
            if built2 is not None:
                built, res = built2, res2

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
        override = project.prompt_overrides.get("design_characters", "")
        char_prompt = f"Character reference sheet: {desc}. Style: {tpl.style_prompt}"
        if override:
            char_prompt += f". Additional direction: {override}"
        res = ctx.gw.image("default", char_prompt)
        ch.reference_uri, model, cost = res.uri, res.model_used, cost + res.cost_usd
    return model or "n/a", cost


def generate_keyframes(project: Project, ctx: StageContext) -> tuple[str, float]:
    cost, model = 0.0, ""
    # Build lookup tables from the character roster produced by write_script.
    char_desc = {ch.name: ch.description for ch in project.characters if ch.description}
    char_ref  = {ch.name: ch.reference_uri for ch in project.characters if ch.reference_uri}
    for sh in project.all_shots():
        if sh.keyframe_uri:
            continue
        # Inline each character's physical description so the image model has
        # visual ground-truth rather than just a name.
        if sh.characters:
            char_details = ", ".join(
                f"{n} ({char_desc[n]})" if n in char_desc else n
                for n in sh.characters)
        else:
            char_details = "the cast"
        img_prompt = (f"{sh.description}. Characters present: {char_details}. "
                      f"Style: {project.style_prompt}")
        override = project.prompt_overrides.get("generate_keyframes", "")
        if override:
            img_prompt += f". Additional direction: {override}"
        # For single-character shots pass the reference sheet as init_image so
        # the model can anchor appearance; skip for multi-character (complex).
        init_img = char_ref.get(sh.characters[0]) if len(sh.characters) == 1 else None
        res = ctx.gw.image("default", img_prompt, init_image=init_img)
        sh.keyframe_uri, model, cost = res.uri, res.model_used, cost + res.cost_usd
    return model or "n/a", cost


def generate_clips(project: Project, ctx: StageContext) -> tuple[str, float]:
    tpl = template_for(project.genre)
    cost, model = 0.0, ""
    for sh in project.all_shots():
        if sh.clip_uri:
            continue
        clip_prompt = f"{sh.description}. Style: {project.style_prompt}"
        override = project.prompt_overrides.get("generate_clips", "")
        if override:
            clip_prompt += f". Additional direction: {override}"
        res = ctx.gw.video(
            "default", clip_prompt,
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
