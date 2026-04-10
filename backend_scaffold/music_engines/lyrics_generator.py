
try:
    from .section_contract import apply_style_preset, build_section_plan
except ImportError:
    from section_contract import apply_style_preset, build_section_plan

def _line_bank(prompt: str, title: str, vibe: str, style: str):
    seed = f"{title}. {prompt}. {vibe}. {style}".strip()
    core = [part.strip() for part in seed.replace(";", ".").split(".") if part.strip()]
    if not core:
        core = [title or "untitled", vibe or "moving forward"]
    return core

def generate_lyrics(payload):
    payload = apply_style_preset(payload)
    title = str(payload.get("title") or "Untitled track").strip()
    vibe = str(payload.get("vibe") or payload.get("genre") or "modern").strip()
    style = str(payload.get("stylePreset") or "default").strip()
    lines = _line_bank(str(payload.get("prompt") or ""), title, vibe, style)
    plan = payload.get("sectionPlan") or build_section_plan(payload)
    per_name_counts = {}
    out = {}
    for section in plan:
        name = section.get("name", "verse")
        per_name_counts[name] = per_name_counts.get(name, 0) + 1
        tag = f"{name}_{per_name_counts[name]}"
        if name == "intro":
            text = f"{title}\n{lines[0]}\nwe step into the light"
        elif name == "verse":
            text = f"{lines[0]}\n{lines[min(1, len(lines)-1)]}\nkeep the rhythm moving tonight"
        elif name == "chorus":
            text = f"{title}, lift it up\nturn the pressure into fire\n{vibe}"
        else:
            text = f"{title}\nlet it fade and settle down\nwe carry the spark home"
        out[tag] = text.strip()
    return out

def flatten_lyrics_for_payload(payload):
    payload = apply_style_preset(payload)
    generated = generate_lyrics(payload)
    return "\n\n".join(generated.values())
