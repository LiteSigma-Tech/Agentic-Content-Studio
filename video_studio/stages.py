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
import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

from .gateway_client import Gateway
from .genres import template_for
from .models import Character, Episode, Line, Project, Scene, Shot
from .render import build_manifest, render_mp4
from .store import ProjectStore


class PipelineCancelled(Exception):
    """Raised by a stage when a stop has been requested; pipeline resets the stage to pending."""


@dataclass
class StageContext:
    gw: Gateway
    store: ProjectStore
    media_dir: Path
    cancel_check: Callable[[], bool] | None = field(default=None)


# --- Prompt loader -----------------------------------------------------------
# All prompts are overridable via environment variables so they can be tuned
# without touching source code.  Set the corresponding env var in .env and the
# pipeline picks it up on next startup.  Templates that contain {placeholders}
# are still formatted at call-time with runtime values.

def _env_prompt(key: str, default: str) -> str:
    """Return the env var value if non-empty, otherwise the hardcoded default."""
    val = os.environ.get(key, "")
    return val if val.strip() else default


# --- LLM prompt enricher ----------------------------------------------------
# One short LLM call converts a template string into a richer, modality-specific
# prompt before it reaches the image/video/music model.  Falls back to the
# original string on any failure so the pipeline stays non-blocking.

_ENRICH_IMAGE = _env_prompt("PROMPT_ENRICH_IMAGE", """\
You are an expert prompt engineer for photorealistic AI image models (FLUX, Stable Diffusion).
Rewrite the prompt below to be richer and more precise. Add:
- Exact camera framing (e.g. "medium close-up, 50mm lens")
- Lighting quality and direction (e.g. "soft overcast key light from camera-left")
- Color palette and mood
- Surface textures and depth-of-field details
- Any cinematic or photographic terminology that improves realism
Preserve every character name, physical description, and the core scene intent exactly.
CRITICAL: End with "No text, no watermarks, no captions, no subtitles, no labels, no logos."
Output ONLY the enhanced prompt — no preamble, no explanation, no quotes.""")

_ENRICH_VIDEO = _env_prompt("PROMPT_ENRICH_VIDEO", """\
You are an expert prompt engineer for AI video generation models.
You will receive a scene description. Your job is to PRESERVE every narrative detail and ADD a concise cinematic layer on top.

Rules — strictly follow all of them:
1. Keep EVERY original detail: who is present, what they do, where they are, props, mood.
2. Do NOT summarise, compress, or omit any original content.
3. ADD only: one specific camera movement, how characters physically move, one atmospheric/lighting note.
4. Additions should be brief — one sentence each at most.
5. End the output with "No text, no watermarks, no captions, no subtitles."
6. Output ONLY the enhanced prompt — no preamble, no labels, no quotes.""")

_NO_TEXT = _env_prompt(
    "PROMPT_NO_TEXT",
    "No text, no watermarks, no captions, no subtitles, no labels, no logos.",
)

# --- Script-writing prompt templates ----------------------------------------
# Static parts are env-loadable; templates with {placeholders} are formatted
# at call-time so runtime values (genre, style_prompt, etc.) are injected then.

_CHAR_EXAMPLE = _env_prompt("PROMPT_CHAR_EXAMPLE", (
    '"Maya is a sharp 34-year-old South Asian woman, 5\'6" with a lean runner\'s build. '
    "She has thick black hair cut in a blunt jaw-length bob. Dark brown eyes behind square "
    "tortoiseshell glasses. She wears a tailored burgundy blazer over a white fitted shirt, "
    "high-waisted charcoal trousers, and block-heel ankle boots. A silver watch on her left "
    'wrist. Precise and guarded — she rarely smiles first but when she does it transforms her face."'
))

_SHOT_EXAMPLE = _env_prompt("PROMPT_SHOT_EXAMPLE", (
    '"A cluttered open-plan kitchen, mid-morning. Pale winter light floods through a large window '
    "above the sink, casting long soft shadows across white subway tiles and a worn oak island. "
    "Maya stands at the counter gripping a coffee mug with both hands, back half-turned to the room. "
    "Jamie leans against the refrigerator, arms crossed, watching. The space between them feels "
    "charged — a single dirty plate in the sink the only sign of last night. "
    'Camera holds in a wide two-shot; the empty island between them feels enormous."'
))

# Supports placeholders: {min_char_desc}, {char_example}, {min_shot_desc}, {shot_example}, {style_prompt}
_DETAIL_RULES_TMPL = _env_prompt("PROMPT_DETAIL_RULES", (
    "DETAIL STANDARDS — enforced by an automated quality gate:\n\n"
    "CHARACTER descriptions must be ≥{min_char_desc} characters (~35 words) and cover ALL of:\n"
    "  age · body type · hair (colour, length, texture) · skin tone · facial features\n"
    "  full outfit (every garment + footwear) · one memorable distinguishing detail · personality\n"
    "  Example of a PASSING description: {char_example}\n\n"
    "SHOT descriptions must be ≥{min_shot_desc} characters (~55 words, 4-6 sentences) covering ALL of:\n"
    "  location name + set details (furniture, props, decor) · lighting quality+direction+colour-temp\n"
    "  camera framing (e.g. 'tight two-shot', 'wide establishing') · precise character positions\n"
    "  the specific action · emotional atmosphere\n"
    "  Example of a PASSING description: {shot_example}\n\n"
    "Visual style for ALL shots: {style_prompt}\n"
))

_DIALOGUE_RULES = _env_prompt("PROMPT_DIALOGUE_RULES", (
    "DIALOGUE RULES — mandatory:\n"
    "  • Characters must have REAL first names (e.g. Alex, Jamie, Dr. Chen).\n"
    "    NEVER use 'Speaker', 'Voiceover', 'Narrator', 'Host', or 'Presenter'.\n"
    "  • Dialogue is CONVERSATIONAL — characters respond, question, disagree, laugh, react.\n"
    "    No monologues longer than 2 sentences. Each dialogue shot needs ≥2 characters.\n"
    "  • Lines must sound like real speech, not scripted voiceover.\n"
    "  • Keep each line under 12 words so it fits within the shot's 'seconds' budget.\n"
))

_SHOT_DURATION_RULES = _env_prompt("PROMPT_SHOT_DURATION_RULES", (
    "SHOT DURATION RULES — enforced by code:\n"
    "  • The 'seconds' field for every shot MUST be between 4 and 8 (hard limits).\n"
    "  • At 150 wpm a speaker delivers ~2.5 words/second. "
    "A 5-second shot fits ~12 words of dialogue across ALL characters combined.\n"
    "  • Never write more words of dialogue than the 'seconds' value × 2.5 allows.\n"
    "  • Do NOT create 'call to action', 'logo card', or 'title card' shots — "
    "graphic overlays are added in post and cannot be rendered by the video model.\n"
))


def _target_duration_block(target_s: int, avg_shot_s: float) -> str:
    n = max(3, round(target_s / avg_shot_s))
    per = round(target_s / n)
    per = max(4, min(8, per))
    lo, hi = max(3, n - 1), n + 1
    return (
        f"TARGET RUNTIME — hard constraint enforced by the pipeline:\n"
        f"  • Total video must be {target_s} seconds (±5 s).\n"
        f"  • Write {lo}–{hi} shots with 'seconds' values summing to ≤{target_s}.\n"
        f"  • Set each shot's 'seconds' to approximately {per} "
        f"(adjust by ±1 across shots to hit the total exactly).\n"
        f"  • This overrides any default shot-count guidance elsewhere in this prompt.\n"
    )

# Preambles for the two write_script paths (adapt existing vs create from scratch).
_SCRIPT_ADAPT_PREAMBLE = _env_prompt("PROMPT_SCRIPT_ADAPT_PREAMBLE", (
    "You are a senior TV writer adapting source material into a detailed episode JSON "
    "for an AI video pipeline."
))

_SCRIPT_CREATE_PREAMBLE = _env_prompt("PROMPT_SCRIPT_CREATE_PREAMBLE", (
    "You are a professional TV writer creating a fully realised episode for an AI video pipeline."
))


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
        enriched = enriched if len(enriched) > 40 else raw
        return f"{enriched} {_NO_TEXT}"
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
                genre_tpl  = template_for(project.genre)
                max_secs   = min(genre_tpl.shot_seconds * 2, 8.0)
                shots.append(Shot(id=sh.get("id", f"S{j}_{k}"),
                                  description=sh["description"],
                                  dialogue=dlg, characters=chars,
                                  seconds=max(4.0, min(max_secs, float(sh.get("seconds",
                                              genre_tpl.shot_seconds))))))
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

    long_shots = [sh.id for sh in all_shots if sh.seconds > 8.0]
    if long_shots:
        issues.append(
            f"Shot 'seconds' values exceed the 8s video model limit — set each to ≤8: "
            f"{', '.join(long_shots[:6])}")

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

    _detail_rules = _DETAIL_RULES_TMPL.format(
        min_char_desc=_MIN_CHAR_DESC,
        char_example=_CHAR_EXAMPLE,
        min_shot_desc=_MIN_SHOT_DESC,
        shot_example=_SHOT_EXAMPLE,
        style_prompt=tpl.style_prompt,
    )
    _dialogue_rules = _DIALOGUE_RULES

    _duration_block = (
        _target_duration_block(project.target_duration_s, tpl.shot_seconds)
        if project.target_duration_s else ""
    )

    # If the concept is already valid JSON matching our schema, use it directly.
    if len(project.concept) > 300:
        parsed_direct = _extract_json(project.concept)
        if parsed_direct:
            built_direct = _parse_episode(parsed_direct, project)
            if built_direct and not _script_critique(*built_direct):
                project.episode, project.characters = built_direct
                project.script_prompt = "passthrough — concept parsed directly as JSON"
                return "local/passthrough", 0.0

    # Detailed source material: adapt faithfully, preserving existing structure and characters.
    if len(project.concept) > 300:
        prompt = (
            f"{_SCRIPT_ADAPT_PREAMBLE}\n"
            f"Genre: {project.genre.value}. Tone: {tpl.tone}. Safety: {tpl.safety_notes}\n\n"
            f"SOURCE MATERIAL:\n{project.concept}\n\n"
            "Complete ALL three tasks in full before outputting JSON:\n\n"
            "TASK 1 — CHARACTERS: Preserve all named characters from the source material "
            "exactly as written. If none are defined, create 2-3 named characters (real first "
            "names only) with contrasting roles. Write a FULL physical description for each "
            "— see DETAIL STANDARDS below.\n\n"
            "TASK 2 — SHOTS: Convert the source material faithfully into 8-10 shots across "
            "2-3 DISTINCT scenes (different locations). Maintain the original narrative order "
            "and character names; expand descriptions to meet DETAIL STANDARDS below. "
            "Keep existing dialogue where present; add back-and-forth exchanges where missing.\n\n"
            + _detail_rules + "\n"
            + _dialogue_rules + "\n"
            + _SHOT_DURATION_RULES
            + ("\n" + _duration_block if _duration_block else "") +
            "\nTASK 3 — OUTPUT: Respond ONLY with valid JSON matching this exact shape:\n"
            + _json_shape
        )
    else:
        prompt = (
            f"{_SCRIPT_CREATE_PREAMBLE}\n"
            f"Genre: {project.genre.value}. Premise: {project.concept}\n"
            f"Tone: {tpl.tone}\n"
            f"Narrative beats (cover every one): {', '.join(tpl.beats)}.\n"
            f"Safety: {tpl.safety_notes}\n\n"
            "Complete ALL three tasks in full before outputting JSON:\n\n"
            "TASK 1 — CHARACTERS: Define 2-4 characters with real first names. "
            "Write a FULL physical description for each — see DETAIL STANDARDS below.\n\n"
            "TASK 2 — SHOTS: Write 7-10 shots across 2-3 DISTINCT scenes (different locations), "
            "covering every beat. Each shot: full visual description + back-and-forth dialogue. "
            "See DETAIL STANDARDS, DIALOGUE RULES, and SHOT DURATION RULES below.\n\n"
            + _detail_rules + "\n"
            + _dialogue_rules + "\n"
            + _SHOT_DURATION_RULES
            + ("\n" + _duration_block if _duration_block else "") +
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

    # Quality gate: up to 2 retries.
    # Fires when the initial parse failed (built is None) OR when it passed
    # parsing but failed the quality critique — so a bad first response always
    # gets at least one retry rather than falling straight to the skeleton.
    for _pass in range(2):
        critique = _script_critique(*built) if built is not None else "Response did not produce valid episode JSON. Rewrite it completely."
        if built is not None and not critique:
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
        base = (f"Character reference sheet: {desc}. Style: {tpl.style_prompt}. "
                f"Consistent appearance across all shots. {_NO_TEXT}")
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
        if ctx.cancel_check and ctx.cancel_check():
            raise PipelineCancelled()
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
                f"Style: {project.style_prompt}. "
                f"Character appearance must exactly match their description — same face, "
                f"hair, outfit, no deviations. {_NO_TEXT}")
        override = project.prompt_overrides.get("generate_keyframes", "")
        if override:
            base += f". Reviewer direction: {override}"
        enriched = _enrich_prompt(ctx, base, "image")
        # Pass first named character's reference as init_image so the model
        # anchors on a consistent face/outfit across all shots.
        init_img = char_ref.get(sh.characters[0]) if sh.characters else None
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

    # Shots that are primarily text/graphic cards (CTAs, logo cards, title cards)
    # cannot be rendered by a video diffusion model — they produce garbled glyphs.
    # Skip them here so the render stage falls back to holding the keyframe still.
    _TEXT_CARD = re.compile(
        r"(?i)(call[\s\-]+to[\s\-]+action|full[\s\-]*screen\s+(?:text|logo|card|title|graphic)|"
        r"\bapply\s+now\b|\bsign[\s\-]+up\s+now\b|headline\s+.{0,40}typography|"
        r"typography\s+.{0,40}headline|logo\s+.{0,30}centered|centered\s+.{0,30}logo|"
        r"\burl\b.{0,60}\btext\b|\btext\b.{0,60}\burl\b)"
    )

    pending = []
    for sh in project.all_shots():
        if sh.clip_uri:
            continue
        if _TEXT_CARD.search(sh.description):
            sh.clip_prompt = "[text-card — skipped for video generation, keyframe held as still]"
            continue
        # Use only the first sentence of each character description as a brief
        # visual anchor. The full appearance is already in the keyframe (init_image);
        # injecting hundreds of chars per character overloads the model and causes
        # odd spatial placement.
        if sh.characters:
            char_details = ", ".join(
                f"{n} ({(char_desc[n].split('.')[0])[:100]})" if n in char_desc else n
                for n in sh.characters)
        else:
            char_details = ""
        dialogue_lines = sh.dialogue or []
        timing_hint = ""
        if dialogue_lines:
            first_speaker = dialogue_lines[0].character
            first_line = dialogue_lines[0].text
            timing_hint = (
                f" Character action and facial expression begin changing immediately "
                f"within the first 0.5 seconds — do not hold a static pose. "
                f"{first_speaker} starts speaking or reacting within the first second: "
                f"\"{first_line[:60]}\". Reactions and lip movement are visible and "
                f"synchronised to the dialogue from the very first frame."
            )
        base = sh.description
        if char_details:
            base += (f". Characters present: {char_details}. "
                     f"Maintain exact character appearance — same face, hair, and outfit.")
        base += timing_hint
        base += f". Style: {project.style_prompt}. {_NO_TEXT}"
        override = project.prompt_overrides.get("generate_clips", "")
        if override:
            base += f". Reviewer direction: {override}"
        enriched = _enrich_prompt(ctx, base, "video")
        sh.clip_prompt = enriched
        pending.append(sh)

    _MAX_RETRIES = int(os.environ.get("CLIP_MAX_RETRIES", "2"))
    _batch_provider = getattr(ctx.gw, "_batch_video_provider", lambda: None)()
    _use_batch = _batch_provider is not None and hasattr(_batch_provider, "generate_batch")

    def _generate_one(sh):
        res = ctx.gw.video(
            "default", sh.clip_prompt,
            seconds=sh.seconds, init_image=sh.keyframe_uri,
            required_caps=tpl.required_caps)
        return sh, res

    for attempt in range(_MAX_RETRIES + 1):
        remaining = [sh for sh in pending if not sh.clip_uri]
        if not remaining:
            break
        if attempt > 0:
            ids = [sh.id for sh in remaining]
            print(f"[generate_clips] retry {attempt}/{_MAX_RETRIES} — {len(remaining)} shot(s) without clips: {ids}")

        if _use_batch:
            items = [(sh.clip_prompt, sh.seconds, sh.keyframe_uri) for sh in remaining]
            results = _batch_provider.generate_batch(items)
            for sh, result in zip(remaining, results):
                if isinstance(result, Exception):
                    print(f"[generate_clips] shot {sh.id} failed (attempt {attempt + 1}): {result}")
                else:
                    sh.clip_uri = result.uri
                    model = result.model_id
                    cost += result.cost_usd
                ctx.store.save(project)
        else:
            _PARALLEL = int(os.environ.get("CLIP_PARALLEL", str(len(remaining) or 1)))
            cancelled = False
            with ThreadPoolExecutor(max_workers=_PARALLEL) as pool:
                futures = {pool.submit(_generate_one, sh): sh for sh in remaining}
                for fut in as_completed(futures):
                    if ctx.cancel_check and ctx.cancel_check():
                        cancelled = True
                        break
                    sh = futures[fut]
                    try:
                        sh, res = fut.result()
                        sh.clip_uri, model = res.uri, res.model_used
                        cost += res.cost_usd
                    except Exception as e:
                        print(f"[generate_clips] shot {sh.id} failed (attempt {attempt + 1}): {e}")
                    ctx.store.save(project)
            if cancelled:
                raise PipelineCancelled()

    still_failed = [sh.id for sh in pending if not sh.clip_uri]
    if still_failed:
        raise RuntimeError(
            f"Clip generation failed after {_MAX_RETRIES + 1} attempt(s) for shots: {still_failed}"
        )
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
