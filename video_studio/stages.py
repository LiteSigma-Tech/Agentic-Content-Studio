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


# --- LLM prompt enricher ----------------------------------------------------
# One short LLM call converts a template string into a richer, modality-specific
# prompt before it reaches the image/video/music model.  Falls back to the
# original string on any failure so the pipeline stays non-blocking.

_ENRICH_IMAGE = """\
You are an expert prompt engineer for photorealistic AI image models (FLUX, Stable Diffusion).
Rewrite the prompt below to be richer and more precise. Add:
- Exact camera framing (e.g. "medium close-up, 50mm lens")
- Lighting quality and direction (e.g. "soft overcast key light from camera-left")
- Color palette and mood
- Surface textures and depth-of-field details
- Any cinematic or photographic terminology that improves realism
Preserve every character name, physical description, and the core scene intent exactly.
Output ONLY the enhanced prompt — no preamble, no explanation, no quotes."""

_ENRICH_VIDEO = """\
You are an expert prompt engineer for AI video generation models.
Rewrite the prompt below to be richer and more cinematic. Add:
- Camera movement (e.g. "slow push-in", "handheld pan left")
- How subjects move and interact during the shot
- Lighting changes or atmospheric dynamics over time
- Pacing and energy (e.g. "urgent pace", "languid and dreamy")
Keep it under 120 words.
Output ONLY the enhanced prompt — no preamble, no explanation, no quotes."""


def _enrich_prompt(ctx: StageContext, raw: str, modality: str = "image") -> str:
    """LLM-rewrite a template prompt into a richer one optimised for the modality."""
    system = _ENRICH_IMAGE if modality == "image" else _ENRICH_VIDEO
    try:
        res = ctx.gw.llm(
            "script_writing",
            [{"role": "user", "content": f"{system}\n\nOriginal prompt:\n{raw}"}],
            json_mode=False,
        )
        enriched = res.text.strip().strip('"').strip("'")
        # Discard if the model returned something suspiciously short or refused
        return enriched if len(enriched) > 40 else raw
    except Exception:
        return raw


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


# Minimum lengths that make image/video generation viable.
_MIN_CHAR_DESC  = 200   # ~35 words — enough for a consistent reference sheet
_MIN_SHOT_DESC  = 350   # ~55 words — 4-6 sentences covering full visual scene


# --- stages -----------------------------------------------------------------
def _script_critique(episode: Episode, characters: list[Character]) -> str | None:
    """Return a critique string if output is too thin; None if quality passes."""
    issues = []
    all_shots = [sh for sc in episode.scenes for sh in sc.shots]

    thin_chars = [ch.name for ch in characters if len(ch.description) < _MIN_CHAR_DESC]
    if thin_chars:
        issues.append(
            f"Character descriptions too short (need ≥{_MIN_CHAR_DESC} chars / ~35 words each). "
            f"Each must cover: age, body type, hair colour+length+texture, skin tone, full outfit "
            f"in detail, one memorable feature, personality in one sentence. "
            f"Thin characters: {', '.join(thin_chars)}")

    thin_shots = [sh.id for sh in all_shots if len(sh.description) < _MIN_SHOT_DESC]
    if thin_shots:
        issues.append(
            f"Shot descriptions too short (need ≥{_MIN_SHOT_DESC} chars / ~55 words, 4-6 sentences). "
            f"Each must cover: location+props+decor, lighting quality+direction+colour-temp, "
            f"camera framing, precise character positions+body language, action, emotional atmosphere. "
            f"Thin shots: {', '.join(thin_shots[:8])}")

    no_dialogue = [sh.id for sh in all_shots if not sh.dialogue]
    if len(no_dialogue) > len(all_shots) // 2:
        issues.append(
            f"More than half the shots have no dialogue — add conversational back-and-forth "
            f"to: {', '.join(no_dialogue[:5])}")

    if len(episode.scenes) < 2:
        issues.append("Need at least 2 distinct scenes in different locations.")

    return " | ".join(issues) if issues else None


def write_script(project: Project, ctx: StageContext) -> tuple[str, float]:
    tpl = template_for(project.genre)
    project.style_prompt = tpl.style_prompt

    _json_shape = (
        '{"title":"...","logline":"...","characters":[{"name":"...","description":"..."}],'
        '"scenes":[{"id":"...","setting":"...","shots":[{"id":"...","description":"...",'
        '"seconds":5,"characters":["..."],"dialogue":[{"character":"...","text":"..."}]}]}]}'
    )

    _char_example = (
        '"Maya is a sharp 34-year-old South Asian woman, 5\'6" with a lean runner\'s build. '
        "She has thick black hair cut in a blunt jaw-length bob. Dark brown eyes behind square "
        "tortoiseshell glasses. She wears a tailored burgundy blazer over a white fitted shirt, "
        "high-waisted charcoal trousers, and block-heel ankle boots. A silver watch on her left "
        'wrist. Precise and guarded — she rarely smiles first but when she does it transforms her face."'
    )

    _shot_example = (
        '"A cluttered open-plan kitchen, mid-morning. Pale winter light floods through a large window '
        "above the sink, casting long soft shadows across white subway tiles and a worn oak island. "
        "Maya stands at the counter gripping a coffee mug with both hands, back half-turned to the room. "
        "Jamie leans against the refrigerator, arms crossed, watching. The space between them feels "
        "charged — a single dirty plate in the sink the only sign of last night. "
        'Camera holds in a wide two-shot; the empty island between them feels enormous."'
    )

    _detail_rules = (
        f"DETAIL STANDARDS — enforced by an automated quality gate:\n\n"
        f"CHARACTER descriptions must be ≥{_MIN_CHAR_DESC} characters (~35 words) and cover ALL of:\n"
        f"  age · body type · hair (colour, length, texture) · skin tone · facial features\n"
        f"  full outfit (every garment + footwear) · one memorable distinguishing detail · personality\n"
        f"  Example of a PASSING description: {_char_example}\n\n"
        f"SHOT descriptions must be ≥{_MIN_SHOT_DESC} characters (~55 words, 4-6 sentences) covering ALL of:\n"
        f"  location name + set details (furniture, props, decor) · lighting quality+direction+colour-temp\n"
        f"  camera framing (e.g. 'tight two-shot', 'wide establishing') · precise character positions\n"
        f"  the specific action · emotional atmosphere\n"
        f"  Example of a PASSING description: {_shot_example}\n\n"
        f"Visual style for ALL shots: {tpl.style_prompt}\n"
    )

    _dialogue_rules = (
        "DIALOGUE RULES — mandatory:\n"
        "  • Characters must have REAL first names (e.g. Alex, Jamie, Dr. Chen).\n"
        "    NEVER use 'Speaker', 'Voiceover', 'Narrator', 'Host', or 'Presenter'.\n"
        "  • Dialogue is CONVERSATIONAL — characters respond, question, disagree, laugh, react.\n"
        "    No monologues longer than 2 sentences. Each dialogue shot needs ≥2 characters.\n"
        "  • Lines must sound like real speech, not scripted voiceover.\n"
    )

    # If concept is a detailed script (> 300 chars), adapt it into a conversation.
    if len(project.concept) > 300:
        prompt = (
            f"You are a senior TV writer adapting source material into a detailed episode JSON "
            f"for an AI video pipeline.\n"
            f"Genre: {project.genre.value}. Tone: {tpl.tone}. Safety: {tpl.safety_notes}\n\n"
            f"SOURCE MATERIAL:\n{project.concept}\n\n"
            "Complete ALL three tasks in full before outputting JSON:\n\n"
            "TASK 1 — CHARACTERS: Invent 2-3 named characters (real first names only) who will "
            "DISCUSS the topic. Give each a contrasting role that creates natural tension "
            "(e.g. sceptic vs enthusiast, student vs expert). "
            "Write a FULL physical description for each — see DETAIL STANDARDS below.\n\n"
            "TASK 2 — SHOTS: Adapt the content into 8-10 shots across 2-3 DISTINCT scenes "
            "(different locations). Each shot: full visual description + back-and-forth dialogue. "
            "See DETAIL STANDARDS and DIALOGUE RULES below.\n\n"
            + _detail_rules + "\n"
            + _dialogue_rules +
            "\nTASK 3 — OUTPUT: Respond ONLY with valid JSON matching this exact shape:\n"
            + _json_shape
        )
    else:
        prompt = (
            f"You are a professional TV writer creating a fully realised episode for an AI video pipeline.\n"
            f"Genre: {project.genre.value}. Premise: {project.concept}\n"
            f"Tone: {tpl.tone}\n"
            f"Narrative beats (cover every one): {', '.join(tpl.beats)}.\n"
            f"Safety: {tpl.safety_notes}\n\n"
            "Complete ALL three tasks in full before outputting JSON:\n\n"
            "TASK 1 — CHARACTERS: Define 2-4 characters with real first names. "
            "Write a FULL physical description for each — see DETAIL STANDARDS below.\n\n"
            "TASK 2 — SHOTS: Write 7-10 shots across 2-3 DISTINCT scenes (different locations), "
            "covering every beat. Each shot: full visual description + back-and-forth dialogue. "
            "See DETAIL STANDARDS and DIALOGUE RULES below.\n\n"
            + _detail_rules + "\n"
            + _dialogue_rules +
            "\nTASK 3 — OUTPUT: Respond ONLY with valid JSON matching this exact shape:\n"
            + _json_shape
        )
    override = project.prompt_overrides.get("write_script", "")
    if override:
        prompt += f"\n\nREVIEWER NOTES — incorporate these changes:\n{override}"

    project.script_prompt = prompt
    res = ctx.gw.llm(tpl.llm_task, [{"role": "user", "content": prompt}],
                     json_mode=True, required_caps=tpl.required_caps)

    parsed = _extract_json(res.text)
    built = _parse_episode(parsed, project) if parsed else None

    # Quality gate: up to 2 retries, each with pointed per-field feedback.
    for _pass in range(2):
        if built is None:
            break
        critique = _script_critique(*built)
        if not critique:
            break
        res = ctx.gw.llm(
            tpl.llm_task,
            [{"role": "user", "content": prompt},
             {"role": "assistant", "content": res.text},
             {"role": "user", "content":
              f"QUALITY GATE FAILED (pass {_pass + 1}/2). "
              f"Rewrite the COMPLETE JSON from scratch — fix every issue listed:\n\n{critique}\n\n"
              f"Remember: character descriptions ≥{_MIN_CHAR_DESC} chars, "
              f"shot descriptions ≥{_MIN_SHOT_DESC} chars, "
              f"≥2 distinct scenes, back-and-forth dialogue on most shots."}],
            json_mode=True, required_caps=tpl.required_caps)
        parsed_retry = _extract_json(res.text)
        built_retry = _parse_episode(parsed_retry, project) if parsed_retry else None
        if built_retry is not None:
            built = built_retry

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
        base = f"Character reference sheet: {desc}. Style: {tpl.style_prompt}"
        if override:
            base += f". Reviewer direction: {override}"
        enriched = _enrich_prompt(ctx, base, "image")
        ch.image_prompt = enriched
        res = ctx.gw.image("default", enriched)
        ch.reference_uri, model, cost = res.uri, res.model_used, cost + res.cost_usd
        ctx.store.save(project)   # checkpoint per character
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
        base = (f"{sh.description}. Characters present: {char_details}. "
                f"Style: {project.style_prompt}")
        override = project.prompt_overrides.get("generate_keyframes", "")
        if override:
            base += f". Reviewer direction: {override}"
        enriched = _enrich_prompt(ctx, base, "image")
        # For single-character shots pass the reference sheet as init_image so
        # the model can anchor appearance; skip for multi-character (complex).
        init_img = char_ref.get(sh.characters[0]) if len(sh.characters) == 1 else None
        sh.keyframe_prompt = enriched
        res = ctx.gw.image("default", enriched, init_image=init_img)
        sh.keyframe_uri, model, cost = res.uri, res.model_used, cost + res.cost_usd
        ctx.store.save(project)   # checkpoint per shot
    return model or "n/a", cost


def generate_clips(project: Project, ctx: StageContext) -> tuple[str, float]:
    from concurrent.futures import ThreadPoolExecutor, as_completed
    tpl = template_for(project.genre)
    cost, model = 0.0, ""

    # Parallelism matches the RunPod max-workers setting (default 2).
    # Shots that already have a clip_uri are skipped (resume support).
    _PARALLEL = int(__import__("os").environ.get("CLIP_PARALLEL", "2"))

    char_desc = {ch.name: ch.description for ch in project.characters if ch.description}

    pending = []
    for sh in project.all_shots():
        if sh.clip_uri:
            continue
        # Inline character physical descriptions so the video model can match
        # the designed appearance — same pattern as generate_keyframes.
        if sh.characters:
            char_details = ", ".join(
                f"{n} ({char_desc[n]})" if n in char_desc else n
                for n in sh.characters)
        else:
            char_details = ""
        base = sh.description
        if char_details:
            base += f". Characters present: {char_details}"
        base += f". Style: {project.style_prompt}"
        override = project.prompt_overrides.get("generate_clips", "")
        if override:
            base += f". Reviewer direction: {override}"
        enriched = _enrich_prompt(ctx, base, "video")
        sh.clip_prompt = enriched
        pending.append(sh)

    def _generate_one(sh):
        res = ctx.gw.video(
            "default", sh.clip_prompt,
            seconds=sh.seconds, init_image=sh.keyframe_uri,
            required_caps=tpl.required_caps)
        return sh, res

    with ThreadPoolExecutor(max_workers=_PARALLEL) as pool:
        futures = {pool.submit(_generate_one, sh): sh for sh in pending}
        for fut in as_completed(futures):
            sh = futures[fut]
            try:
                sh, res = fut.result()
                sh.clip_uri, model = res.uri, res.model_used
                cost += res.cost_usd
            except Exception as e:
                # Log failure but continue — failed clip stays None so a retry
                # run will pick it up, and the checkpoint below records progress.
                print(f"[generate_clips] shot {sh.id} failed: {e}")
            ctx.store.save(project)   # checkpoint after each shot completes

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
