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
        if sh.dialogue_audio_uri or not sh.dialogue:
            continue
        text = " ".join(ln.text for ln in sh.dialogue if ln.text).strip() or "..."
        speaker = sh.dialogue[0].character
        voice_id = project.voice_cast.get(speaker, "vo_narrator")

        # Route through the gateway (real TTS provider would return audio here).
        res = ctx.gw.tts("default", text, voice_id=voice_id,
                         required_caps=tpl.required_caps)
        model, cost = res.model_used, cost + res.cost_usd

        dst = out_dir / f"dlg_{sh.id}.wav"
        if synth.is_real_audio(res.uri):
            dst.write_bytes(Path(res.uri).read_bytes())
        else:
            seconds = synth.estimate_speech_seconds(text, sh.seconds)
            synth.synth_speech(text, voices.get(voice_id), seconds, dst)
        sh.dialogue_audio_uri = str(dst)
    return model or "n/a", cost


def generate_music(project: Project, ctx: StageContext) -> tuple[str, float]:
    if project.music_uri:
        return "cached", 0.0
    tpl = template_for(project.genre)
    total = sum(sh.seconds for sh in project.all_shots()) or 5.0
    res = ctx.gw.music("default",
                       f"{tpl.tone} background score for '{project.title}'",
                       seconds=total, required_caps=tpl.required_caps)
    dst = _audio_dir(ctx) / "music_bed.wav"
    if synth.is_real_audio(res.uri):
        dst.write_bytes(Path(res.uri).read_bytes())
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
