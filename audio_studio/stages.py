"""Audio Studio stages. Same StageContext and (project, ctx) signature as the
video stages, so they compose into one pipeline and inherit the same durable
checkpoint/resume behaviour. They run after the (silent) video render and
produce the final audio-visual deliverable.

Each AI step calls the Model Gateway (tts / music modality); offline that
returns a stub, so the synth helpers generate real placeholder audio — but the
gateway routing (and its model/cost) is still recorded, so plugging in a real
TTS/music model needs no stage changes.
"""
from __future__ import annotations

from pathlib import Path

from video_studio.genres import template_for
from video_studio.models import Project
from video_studio.stages import StageContext

from . import synth, voices


def _audio_dir(ctx: StageContext) -> Path:
    d = ctx.media_dir / "audio"
    d.mkdir(parents=True, exist_ok=True)
    return d


def cast_voices(project: Project, ctx: StageContext) -> tuple[str, float]:
    if project.voice_cast:
        return "local/casting", 0.0
    names = [c.name for c in project.characters] or \
            sorted({ln.character for sh in project.all_shots() for ln in sh.dialogue})
    project.voice_cast = voices.cast_for(names, project.genre.value)
    return "local/casting", 0.0


def generate_dialogue(project: Project, ctx: StageContext) -> tuple[str, float]:
    tpl = template_for(project.genre)
    out_dir = _audio_dir(ctx)
    cost, model = 0.0, ""
    for sh in project.all_shots():
        if not sh.dialogue:
            continue
        # Skip only if the combined shot audio is already a valid WAV (RIFF header).
        if sh.dialogue_audio_uri:
            p = Path(sh.dialogue_audio_uri)
            if p.exists() and p.read_bytes()[:4] == b"RIFF":
                continue
            sh.dialogue_audio_uri = None  # clear stale/invalid URI

        # One TTS call per Line so each character speaks in their own voice.
        line_paths: list[Path] = []
        secs_per_line = sh.seconds / max(1, len(sh.dialogue))
        for i, ln in enumerate(sh.dialogue):
            if not ln.text.strip():
                continue
            voice_id = project.voice_cast.get(ln.character, "vo_narrator")
            res = ctx.gw.tts("default", ln.text, voice_id=voice_id,
                             required_caps=tpl.required_caps)
            model, cost = res.model_used, cost + res.cost_usd

            line_dst = out_dir / f"dlg_{sh.id}_L{i}.wav"
            if synth.is_real_audio(res.uri):
                synth._ff(["-i", res.uri, "-ac", "2", "-ar", str(synth._SR), str(line_dst)])
            else:
                seconds = synth.estimate_speech_seconds(ln.text, secs_per_line)
                synth.synth_speech(ln.text, voices.get(voice_id), seconds, line_dst)
            line_paths.append(line_dst)

        if not line_paths:
            continue
        dst = out_dir / f"dlg_{sh.id}.wav"
        synth.concat_audio(line_paths, dst)
        sh.dialogue_audio_uri = str(dst)
    return model or "n/a", cost


def generate_music(project: Project, ctx: StageContext) -> tuple[str, float]:
    if project.music_uri:
        p = Path(project.music_uri)
        if p.exists() and p.read_bytes()[:4] == b"RIFF":
            return "cached", 0.0
        project.music_uri = None  # re-generate if missing or wrong format
    tpl = template_for(project.genre)
    total = sum(sh.seconds for sh in project.all_shots()) or 5.0
    music_prompt = f"{tpl.tone} background score for '{project.title}'"
    override = project.prompt_overrides.get("generate_music", "")
    if override:
        music_prompt += f". Additional direction: {override}"
    res = ctx.gw.music("default", music_prompt,
                       seconds=total, required_caps=tpl.required_caps)
    dst = _audio_dir(ctx) / "music_bed.wav"
    if synth.is_real_audio(res.uri):
        # Convert to WAV — handles MP3/WAV from any music provider.
        synth._ff(["-i", res.uri, "-ac", "2", "-ar", str(synth._SR), str(dst)])
    else:
        synth.synth_music(total, dst)
    project.music_uri = str(dst)
    return res.model_used, res.cost_usd


def mix_audio(project: Project, ctx: StageContext) -> tuple[str, float]:
    """Place each shot's dialogue at its timeline offset, duck music under it,
    and mix to a single master track aligned to the video timeline."""
    dialogue, t = [], 0.0
    for sh in project.all_shots():
        if sh.dialogue_audio_uri:
            dialogue.append((t, sh.dialogue_audio_uri))
        t += sh.seconds
    total = t or 5.0
    dst = _audio_dir(ctx) / "master.wav"
    synth.mix_master(project.music_uri, dialogue, total, dst)
    project.master_audio_uri = str(dst)
    return "local/mixer", 0.0


def mux(project: Project, ctx: StageContext) -> tuple[str, float]:
    if not (project.final_uri and project.master_audio_uri):
        raise RuntimeError("mux requires a rendered video and a master audio track")
    dst = ctx.media_dir / "final_av.mp4"
    synth.mux_av(project.final_uri, project.master_audio_uri, dst)
    project.final_av_uri = str(dst)
    return "local/ffmpeg", 0.0


AUDIO_STAGES = [
    ("cast_voices", cast_voices),
    ("generate_dialogue", generate_dialogue),
    ("generate_music", generate_music),
    ("mix_audio", mix_audio),
    ("mux", mux),
]
