"""Genre templates. Each genre shapes the script prompt (tone, structure,
pacing), the global visual style, and — importantly — which gateway LLM *task*
the script runs under. Kids' content routes through the `kids_content` task,
which the gateway gates on the `moderation_ok` capability so only vetted-safe
models can produce it.
"""
from __future__ import annotations

from dataclasses import dataclass

from .models import Genre


@dataclass(frozen=True)
class GenreTemplate:
    genre: Genre
    tone: str
    beats: list[str]              # structural beats -> one shot each in the offline skeleton
    shot_seconds: float
    style_prompt: str             # appended to every image/video prompt
    llm_task: str                 # gateway routing task
    required_caps: frozenset      # extra capabilities the LLM must declare
    safety_notes: str


_TEMPLATES = {
    Genre.drama: GenreTemplate(
        genre=Genre.drama,
        tone="grounded, emotionally weighty, naturalistic dialogue",
        beats=["establishing exterior", "quiet tension between leads",
               "confrontation", "turning point", "aftermath / resolution"],
        shot_seconds=6.0,
        style_prompt="photorealistic live action, cinematic film still, shallow depth of field, muted desaturated color grade, naturalistic available light, real human actors",
        llm_task="script_writing",
        required_caps=frozenset(),
        safety_notes="Adult themes allowed; standard content moderation.",
    ),
    Genre.romance: GenreTemplate(
        genre=Genre.romance,
        tone="warm, tender, longing, character-driven",
        beats=["meet-cute", "growing connection", "obstacle / misunderstanding",
               "grand gesture", "happy resolution"],
        shot_seconds=6.0,
        style_prompt="photorealistic live action, cinematic film still, soft warm golden-hour lighting, gentle bokeh, intimate framing, real human actors",
        llm_task="script_writing",
        required_caps=frozenset(),
        safety_notes="Romantic but non-explicit by default.",
    ),
    Genre.comedy: GenreTemplate(
        genre=Genre.comedy,
        tone="upbeat, punchy, quick comic timing, witty banter",
        beats=["cold open hook", "setup of the bit", "escalation",
               "comedic peak", "button / tag"],
        shot_seconds=4.5,
        style_prompt="photorealistic live action, bright high-key studio lighting, vivid saturated colors, lively dynamic framing, real human actors, no illustration no cartoon",
        llm_task="script_writing",
        required_caps=frozenset(),
        safety_notes="Keep humor inclusive; avoid punching down.",
    ),
    Genre.kids_cartoon: GenreTemplate(
        genre=Genre.kids_cartoon,
        tone="cheerful, simple, gentle, clearly age-appropriate; short sentences",
        beats=["friendly introduction", "a small fun problem",
               "kind friends help out", "happy solution", "warm goodbye lesson"],
        shot_seconds=4.0,
        style_prompt="2D cartoon, rounded friendly shapes, bright primary colors, simple backgrounds",
        llm_task="kids_content",         # gateway gates this on moderation_ok
        required_caps=frozenset({"moderation_ok"}),
        safety_notes=("Strictly age-appropriate. No violence, fear, romance, or "
                      "unsafe behavior. Routed through a moderation-vetted model."),
    ),
    Genre.thriller: GenreTemplate(
        genre=Genre.thriller,
        tone="tense, paranoid, relentless — escalating dread punctuated by sudden shocks",
        beats=["unsettling setup", "mounting threat revealed", "protagonist cornered",
               "desperate gambit", "shocking resolution"],
        shot_seconds=4.5,
        style_prompt="photorealistic thriller, high-contrast chiaroscuro, deep shadows, cool desaturated palette, shallow depth of field, handheld urgency, real human actors",
        llm_task="script_writing",
        required_caps=frozenset(),
        safety_notes="Suspense and peril OK; no graphic gore or torture.",
    ),
    # Genre.horror: GenreTemplate(
    #     genre=Genre.horror,
    #     tone="creeping dread, psychological unease, sudden terror — silence weaponised",
    #     beats=["false sense of safety", "first wrong sign", "isolation or trap",
    #            "terrifying reveal", "survival or doom"],
    #     shot_seconds=5.0,
    #     style_prompt="photorealistic horror, extreme chiaroscuro, near-black shadows, cold sickly green-grey palette, dutch angles and negative space, unsettling framing, real human actors",
    #     llm_task="script_writing",
    #     required_caps=frozenset(),
    #     safety_notes="Atmospheric horror OK; no graphic gore, torture, or sexualised violence.",
    # ),
    Genre.sci_fi: GenreTemplate(
        genre=Genre.sci_fi,
        tone="wonder and unease in equal measure — big ideas, intimate human stakes",
        beats=["world-establishing moment", "discovery or anomaly", "impossible choice",
               "climactic confrontation", "new equilibrium"],
        shot_seconds=6.0,
        style_prompt="photorealistic science fiction, sleek futuristic environments, volumetric neon-lit fog, HDR contrast, hard chrome and glass surfaces, real actors in practical sets with CG extension",
        llm_task="script_writing",
        required_caps=frozenset(),
        safety_notes="Standard content moderation.",
    ),
    # Genre.fantasy: GenreTemplate(
    #     genre=Genre.fantasy,
    #     tone="epic, mythic, emotionally grounded — wonder without irony",
    #     beats=["ordinary world upended", "call to adventure accepted", "trials and allies",
    #            "darkest hour", "triumphant transformation"],
    #     shot_seconds=6.5,
    #     style_prompt="photorealistic high fantasy, painterly golden-hour light, rich jewel-tone palette, epic scale landscapes and architecture, practical period-fantasy costumes, no modern elements",
    #     llm_task="script_writing",
    #     required_caps=frozenset(),
    #     safety_notes="Standard content moderation.",
    # ),
    Genre.action: GenreTemplate(
        genre=Genre.action,
        tone="kinetic, relentless, visceral — every beat punches harder than the last",
        beats=["explosive opening", "hero establishes stakes", "ambush or setback",
               "all-out confrontation", "hard-won victory"],
        shot_seconds=3.5,
        style_prompt="photorealistic action cinema, high-contrast punchy grade, dynamic handheld and drone angles, motion blur, practical stunt work, real human actors",
        llm_task="script_writing",
        required_caps=frozenset(),
        safety_notes="Action violence OK; no graphic gore or torture.",
    ),
    Genre.documentary: GenreTemplate(
        genre=Genre.documentary,
        tone="earnest, curious, revelatory — truth stranger than fiction",
        beats=["provocative opening question", "expert testimony", "compelling evidence",
               "counter-argument", "resonant conclusion"],
        shot_seconds=7.0,
        style_prompt="photorealistic documentary, natural available light, talking-head medium shots, observational b-roll, handheld vérité, no staged theatrical blocking",
        llm_task="script_writing",
        required_caps=frozenset(),
        safety_notes="Standard content moderation.",
    ),
    # Genre.mystery: GenreTemplate(
    #     genre=Genre.mystery,
    #     tone="cerebral, atmospheric, quietly menacing — every detail a potential clue",
    #     beats=["crime or puzzle introduced", "first false lead", "hidden connection surfaces",
    #            "protagonist at risk", "elegant reveal"],
    #     shot_seconds=5.5,
    #     style_prompt="photorealistic neo-noir mystery, overcast diffused light, muted olive and amber palette, shallow focus on telling details, slow deliberate camera moves, real human actors",
    #     llm_task="script_writing",
    #     required_caps=frozenset(),
    #     safety_notes="Standard content moderation.",
    # ),
    Genre.musical: GenreTemplate(
        genre=Genre.musical,
        tone="joyful, emotionally heightened, theatrically expressive",
        beats=["ordinary world breaks into song", "dream or aspiration number",
               "conflict expressed through dance", "emotional ballad turning point",
               "ensemble finale"],
        shot_seconds=5.0,
        style_prompt="photorealistic theatrical film, bold saturated colour, sweeping Steadicam choreography, theatrical studio lighting, real actors performing practical dance and song",
        llm_task="script_writing",
        required_caps=frozenset(),
        safety_notes="Standard content moderation.",
    ),
    Genre.crime: GenreTemplate(
        genre=Genre.crime,
        tone="morally murky, world-weary, taut — nobody's hands are clean",
        beats=["crime established", "investigation or heist planning", "double-cross or complication",
               "dangerous confrontation", "pyrrhic resolution"],
        shot_seconds=5.5,
        style_prompt="photorealistic crime drama, neon-wet-street noir, hard side-lighting, desaturated blue-grey-amber palette, wide anamorphic lens, real human actors",
        llm_task="script_writing",
        required_caps=frozenset(),
        safety_notes="Crime themes OK; no glorification of real-world harm.",
    ),
    Genre.western: GenreTemplate(
        genre=Genre.western,
        tone="laconic, mythic, elemental — landscape as character",
        beats=["lone arrival", "simmering grievance", "powder-keg moment",
               "showdown", "dust settles"],
        shot_seconds=6.5,
        style_prompt="photorealistic western, golden-hour dusty light, wide anamorphic vistas, warm amber palette, sun-weathered textures, practical frontier costumes and sets, real human actors",
        llm_task="script_writing",
        required_caps=frozenset(),
        safety_notes="Period violence OK; avoid racial stereotyping.",
    ),
    Genre.historical: GenreTemplate(
        genre=Genre.historical,
        tone="stately, period-authentic, emotionally resonant — the weight of the era felt",
        beats=["era-establishing scene", "protagonist's position in society",
               "historical conflict erupts", "personal sacrifice", "legacy moment"],
        shot_seconds=6.0,
        style_prompt="photorealistic period drama, diffused natural and candlelight, authentic period costumes and sets, muted earth-tone palette, painterly composition, real human actors",
        llm_task="script_writing",
        required_caps=frozenset(),
        safety_notes="Standard content moderation; maintain period accuracy.",
    ),
    Genre.sitcom: GenreTemplate(
        genre=Genre.sitcom,
        tone="snappy, warm, character-driven — misunderstandings escalate to absurdity",
        beats=["status quo established", "misunderstanding ignited", "snowballing chaos",
               "farcical peak", "warm reset"],
        shot_seconds=4.0,
        style_prompt="photorealistic multi-camera sitcom, bright even studio lighting, warm whites, clean medium and two-shot framing, no handheld, real human actors",
        llm_task="script_writing",
        required_caps=frozenset(),
        safety_notes="Keep humor inclusive; avoid punching down.",
    ),
    Genre.reality_tv: GenreTemplate(
        genre=Genre.reality_tv,
        tone="confessional, dramatic, voyeuristic — manufactured spontaneity",
        beats=["cast introduction and alliance-forming", "challenge or twist revealed",
               "backstage scheming", "elimination or confrontation", "cliffhanger"],
        shot_seconds=4.5,
        style_prompt="photorealistic reality TV, flat even production lighting, handheld confessional close-ups, wide observational shots, real human cast",
        llm_task="script_writing",
        required_caps=frozenset(),
        safety_notes="Standard content moderation.",
    ),
    Genre.educational: GenreTemplate(
        genre=Genre.educational,
        tone="clear, engaging, authoritative — complex ideas made vivid and accessible",
        beats=["hook with surprising fact", "core concept introduced", "real-world example",
               "common misconception addressed", "takeaway and call to action"],
        shot_seconds=7.0,
        style_prompt="photorealistic educational video, clean bright studio lighting, clear mid-shots of presenter, relevant props and on-screen demonstrations, whiteboard or screen inserts",
        llm_task="script_writing",
        required_caps=frozenset(),
        safety_notes="Factually accurate; standard content moderation.",
    ),
    Genre.animation: GenreTemplate(
        genre=Genre.animation,
        tone="dynamic, expressive, visually inventive — character over spectacle",
        beats=["world and protagonist established", "inciting disruption",
               "team-up or transformation sequence", "climactic confrontation",
               "satisfying resolution with growth"],
        shot_seconds=4.5,
        style_prompt="stylized animation, bold outlines, vibrant saturated palette, fluid expressive motion, cinematic camera angles, no live-action elements",
        llm_task="script_writing",
        required_caps=frozenset(),
        safety_notes="Standard content moderation.",
    ),
}


def template_for(genre: Genre) -> GenreTemplate:
    return _TEMPLATES[genre]
