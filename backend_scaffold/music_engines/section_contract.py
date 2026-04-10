
SECTION_NAMES = ("intro", "verse", "chorus", "outro")
LEGACY_MOTION_MAP = {
    "lift": "rise",
    "glide": "drive",
    "pulse": "drive",
    "resolve": "fall",
    "low": "low",
    "rise": "rise",
    "drive": "drive",
    "explode": "explode",
    "fall": "fall",
}
DEFAULT_SECTION_DYNAMICS = {
    "intro": {"energy": 0.54, "density": 0.34, "drums": 0.26, "motion": "rise"},
    "verse": {"energy": 0.68, "density": 0.58, "drums": 0.56, "motion": "drive"},
    "chorus": {"energy": 0.95, "density": 0.88, "drums": 0.90, "motion": "explode"},
    "outro": {"energy": 0.48, "density": 0.28, "drums": 0.22, "motion": "fall"},
}
DEFAULT_SECTION_BARS = {"intro": 2, "verse": 4, "chorus": 4, "outro": 2}
DEFAULT_STRUCTURE = ["intro", "verse", "chorus", "verse", "chorus", "outro"]
STYLE_PRESETS = {
    "default": {"genreHint": "modern song", "vibeHint": "balanced, modern, dynamic", "vocalTone": "balanced", "sectionDynamics": {}},
    "lofi": {"genreHint": "lofi chill song", "vibeHint": "dusty, warm, intimate, relaxed", "vocalTone": "soft", "sectionDynamics": {
        "intro": {"energy": 0.28, "density": 0.22, "drums": 0.12, "motion": "low"},
        "verse": {"energy": 0.42, "density": 0.36, "drums": 0.22, "motion": "drive"},
        "chorus": {"energy": 0.56, "density": 0.44, "drums": 0.32, "motion": "rise"},
        "outro": {"energy": 0.24, "density": 0.16, "drums": 0.08, "motion": "fall"},}},
    "cinematic": {"genreHint": "cinematic anthem", "vibeHint": "wide, emotional, dramatic, trailer-ready", "vocalTone": "wide", "sectionDynamics": {
        "intro": {"energy": 0.34, "density": 0.28, "drums": 0.10, "motion": "rise"},
        "verse": {"energy": 0.58, "density": 0.48, "drums": 0.30, "motion": "drive"},
        "chorus": {"energy": 0.98, "density": 0.88, "drums": 0.64, "motion": "explode"},
        "outro": {"energy": 0.30, "density": 0.20, "drums": 0.10, "motion": "fall"},}},
    "trap": {"genreHint": "modern trap song", "vibeHint": "dark, glossy, confident, hard-hitting", "vocalTone": "confident", "sectionDynamics": {
        "intro": {"energy": 0.40, "density": 0.30, "drums": 0.22, "motion": "rise"},
        "verse": {"energy": 0.70, "density": 0.62, "drums": 0.70, "motion": "drive"},
        "chorus": {"energy": 0.98, "density": 0.92, "drums": 0.92, "motion": "explode"},
        "outro": {"energy": 0.36, "density": 0.22, "drums": 0.18, "motion": "fall"},}},
    "edm": {"genreHint": "festival edm track", "vibeHint": "bright, huge, euphoric, club-ready", "vocalTone": "anthemic", "sectionDynamics": {
        "intro": {"energy": 0.32, "density": 0.20, "drums": 0.16, "motion": "rise"},
        "verse": {"energy": 0.62, "density": 0.52, "drums": 0.58, "motion": "drive"},
        "chorus": {"energy": 1.00, "density": 0.94, "drums": 0.96, "motion": "explode"},
        "outro": {"energy": 0.28, "density": 0.16, "drums": 0.12, "motion": "fall"},}},
}

def floatish_gt1(value):
    try:
        return float(value) > 1.0
    except Exception:
        return False

def clamp_float(value, lo=0.0, hi=1.0, default=0.0):
    try:
        v = float(value)
    except Exception:
        v = default
    return max(lo, min(hi, v))

def clamp_int(value, lo, hi, default):
    try:
        v = int(round(float(value)))
    except Exception:
        v = default
    return max(lo, min(hi, v))

def normalize_motion(value, fallback="drive"):
    text = str(value or fallback or "drive").strip().lower()
    return LEGACY_MOTION_MAP.get(text, fallback if fallback in LEGACY_MOTION_MAP.values() else "drive")

def get_style_preset(style_preset):
    key = str(style_preset or "default").strip().lower()
    return STYLE_PRESETS.get(key, STYLE_PRESETS["default"])

def apply_style_preset(payload=None):
    payload = dict(payload or {})
    preset_key = str(payload.get("stylePreset") or "default").strip().lower()
    preset = get_style_preset(preset_key)
    merged = dict(payload)
    merged.setdefault("stylePreset", preset_key)
    merged.setdefault("stylePresetMeta", preset)
    if not str(merged.get("genre") or "").strip():
        merged["genre"] = preset.get("genreHint", "modern song")
    vibe = str(merged.get("vibe") or "").strip()
    preset_vibe = str(preset.get("vibeHint") or "").strip()
    merged["vibe"] = (f"{vibe}, {preset_vibe}" if vibe and preset_vibe and preset_vibe.lower() not in vibe.lower() else (vibe or preset_vibe))
    if "enableVocals" not in merged:
        merged["enableVocals"] = str(merged.get("mode") or "song") != "instrumental"
    incoming = merged.get("sectionDynamics") if isinstance(merged.get("sectionDynamics"), dict) else {}
    styled = {}
    for name in SECTION_NAMES:
        styled[name] = {**preset.get("sectionDynamics", {}).get(name, {}), **(incoming.get(name, {}) if isinstance(incoming, dict) else {})}
    merged["sectionDynamics"] = styled
    return merged

def normalize_section_dynamics(raw):
    incoming = raw or {}
    out = {}
    for name in SECTION_NAMES:
        base = DEFAULT_SECTION_DYNAMICS[name]
        current = incoming.get(name) if isinstance(incoming, dict) else {}
        if not isinstance(current, dict):
            current = {}
        out[name] = {
            "energy": clamp_float((current.get("energy", base["energy"]) / 100.0) if floatish_gt1(current.get("energy", base["energy"])) else current.get("energy", base["energy"]), 0.0, 1.0, base["energy"]),
            "density": clamp_float((current.get("density", base["density"]) / 100.0) if floatish_gt1(current.get("density", base["density"])) else current.get("density", base["density"]), 0.0, 1.0, base["density"]),
            "drums": clamp_float((current.get("drums", base["drums"]) / 100.0) if floatish_gt1(current.get("drums", base["drums"])) else current.get("drums", base["drums"]), 0.0, 1.0, base["drums"]),
            "motion": normalize_motion(current.get("motion", base["motion"]), base["motion"]),
        }
    return out

def normalize_section_bars(raw):
    incoming = raw or {}
    out = {}
    for name, default in DEFAULT_SECTION_BARS.items():
        out[name] = clamp_int(incoming.get(name, default), 1, 24 if name in ("verse", "chorus") else 16, default)
    return out

def normalize_structure(structure):
    items = [str(x).strip().lower() for x in (structure or []) if str(x).strip().lower() in SECTION_NAMES]
    return items or list(DEFAULT_STRUCTURE)

def beat_seconds(bpm):
    try:
        bpm_v = max(70.0, min(180.0, float(bpm)))
    except Exception:
        bpm_v = 118.0
    return 60.0 / bpm_v

def bars_to_seconds(bars, bpm):
    return max(1e-6, float(bars) * beat_seconds(bpm) * 4.0)

def section_descriptor(section):
    energy = section["energy"]
    density = section["density"]
    drums = section["drums"]
    motion = section["motion"]
    intensity = "low energy" if energy < 0.38 else "mid energy" if energy < 0.72 else "high energy"
    loudness = "soft dynamics" if energy < 0.35 else "controlled punch" if energy < 0.7 else "big loud lift"
    layering = "sparse arrangement" if density < 0.35 else "layered arrangement" if density < 0.72 else "dense layered arrangement"
    percussion = "minimal drums" if drums < 0.2 else "steady drums" if drums < 0.65 else "strong drums"
    motion_phrase = {
        "low": "static and restrained phrasing",
        "rise": "rising phrasing and lift",
        "drive": "forward-driving phrasing",
        "explode": "explosive payoff phrasing",
        "fall": "falling and resolving phrasing",
    }[motion]
    return intensity, loudness, layering, percussion, motion_phrase

def musicgen_prompt_for_section(section, payload=None):
    payload = apply_style_preset(payload)
    preset = payload.get("stylePresetMeta", {})
    genre = str(payload.get("genre") or payload.get("style") or preset.get("genreHint") or "modern song").strip()
    vibe = str(payload.get("vibe") or "").strip()
    title = str(payload.get("title") or "Untitled track").strip()
    intensity, loudness, layering, percussion, motion_phrase = section_descriptor(section)
    parts = [
        f"{section['name']} section of a {genre} song",
        intensity,
        loudness,
        layering,
        percussion,
        motion_phrase,
    ]
    if vibe:
        parts.append(vibe)
    if preset.get("genreHint"):
        parts.append(f"style preset {payload.get('stylePreset', 'default')}")
    parts.append(f"for the song '{title}'")
    return ", ".join(p for p in parts if p)

def bark_style_for_section(section, style_preset=None, vocal_mode="hybrid"):
    vocal_mode = str(vocal_mode or "hybrid").strip().lower()
    preset = get_style_preset(style_preset)
    name = section["name"]
    energy = section["energy"]
    motion = section["motion"]
    tone = preset.get("vocalTone", "balanced")
    if name == "intro":
        base = "ambient spoken texture" if energy < 0.55 else "soft intimate lead-in"
    elif name == "verse":
        base = "rhythmic phrasing with clear cadence" if motion in ("drive", "rise") else "steady expressive phrasing"
    elif name == "chorus":
        base = "bigger emotional sustained hook"
    else:
        base = "fading minimal resolution"
    mode_hint = {"spoken": "spoken phrasing", "sing": "melodic singing", "hybrid": "spoken-to-sung phrasing"}.get(vocal_mode, "spoken-to-sung phrasing")
    return f"{base}, {tone} vocal tone, {mode_hint}".strip(", ")

def _chunk_lyrics(lyrics):
    lines = [line.strip() for line in str(lyrics or "").splitlines() if line.strip()]
    if not lines:
        return []
    chunks = []
    current = []
    count = 0
    for line in lines:
        current.append(line)
        count += len(line.split())
        if count >= 10:
            chunks.append(" ".join(current))
            current, count = [], 0
    if current:
        chunks.append(" ".join(current))
    return chunks

def bark_text_for_section(section, payload=None, chunk_index=0):
    payload = apply_style_preset(payload)
    chunks = _chunk_lyrics(payload.get("lyrics"))
    if chunks:
        chosen = chunks[chunk_index % len(chunks)]
    else:
        title = str(payload.get("title") or "Untitled track").strip()
        vibe = str(payload.get("vibe") or payload.get("genre") or "modern").strip()
        if section["name"] == "intro":
            chosen = f"{title}. {vibe}. we are just beginning."
        elif section["name"] == "verse":
            chosen = f"{title}. keep the rhythm moving and tell the story."
        elif section["name"] == "chorus":
            chosen = f"{title}. lift it higher and let the feeling bloom."
        else:
            chosen = f"{title}. let it fall away and fade into night."
    vocal_mode = str(payload.get('vocalMode') or 'hybrid').strip().lower()
    melody_hint = 'follow the section melody contour closely' if vocal_mode == 'sing' else ('start spoken then lift into melodic sustained phrasing' if vocal_mode == 'hybrid' else 'keep it speech-forward and intimate')
    return f"{bark_style_for_section(section, payload.get('stylePreset'), vocal_mode)}. {melody_hint}. {chosen}"[:280]

def build_section_plan(payload):
    payload = apply_style_preset(payload)
    bpm = payload.get("bpm", 118)
    section_bars = normalize_section_bars(payload.get("sectionBars"))
    dynamics = normalize_section_dynamics(payload.get("sectionDynamics"))
    structure = normalize_structure(payload.get("structure"))
    plan = []
    cursor = 0.0
    for idx, name in enumerate(structure):
        profile = dynamics[name]
        bars = section_bars[name]
        duration = bars_to_seconds(bars, bpm)
        section = {
            "index": idx,
            "name": name,
            "bars": bars,
            "energy": round(profile["energy"], 4),
            "density": round(profile["density"], 4),
            "drums": round(profile["drums"], 4),
            "motion": profile["motion"],
            "startSec": round(cursor, 4),
            "endSec": round(cursor + duration, 4),
            "durationSec": round(duration, 4),
        }
        section["prompt"] = musicgen_prompt_for_section(section, payload)
        section["barkStyle"] = bark_style_for_section(section, payload.get("stylePreset"), payload.get("vocalMode"))
        plan.append(section)
        cursor += duration
    return plan

def section_timings_from_plan(plan, crossfade_sec=0.12):
    timings = []
    cursor = 0.0
    for idx, section in enumerate(plan):
        start = cursor if idx == 0 else max(0.0, cursor - crossfade_sec)
        end = start + float(section.get("durationSec", 0.0))
        timings.append({
            "index": section.get("index", idx),
            "name": section.get("name", "section"),
            "startSec": round(start, 4),
            "endSec": round(end, 4),
            "bars": section.get("bars", 0),
            "durationSec": round(max(0.0, end - start), 4),
            "engine": section.get("engine", ""),
            "prompt": section.get("prompt", ""),
        })
        cursor = end
    return timings

def crossfade_concat(sample_lists, sample_rate, crossfade_sec=0.12):
    clips = [list(s or []) for s in sample_lists if s]
    if not clips:
        return []
    fade = max(0, int(sample_rate * max(0.0, crossfade_sec)))
    out = list(clips[0])
    for clip in clips[1:]:
        if not out:
            out = list(clip)
            continue
        if fade <= 0:
            out.extend(clip)
            continue
        actual = min(fade, len(out), len(clip))
        for i in range(actual):
            t = i / max(1, actual - 1)
            out[len(out) - actual + i] = out[len(out) - actual + i] * (1.0 - t) + clip[i] * t
        out.extend(clip[actual:])
    return out
