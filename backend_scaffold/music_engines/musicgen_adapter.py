import argparse, json, math, os, wave, struct
from array import array
from pathlib import Path

SAMPLE_RATE = 22050

NOTE_INDEX = {
    'C': 0, 'C#': 1, 'DB': 1, 'D': 2, 'D#': 3, 'EB': 3, 'E': 4, 'F': 5,
    'F#': 6, 'GB': 6, 'G': 7, 'G#': 8, 'AB': 8, 'A': 9, 'A#': 10, 'BB': 10, 'B': 11,
}
MAJOR = [0, 2, 4, 5, 7, 9, 11]
MINOR = [0, 2, 3, 5, 7, 8, 10]


def clamp(v, lo=-1.0, hi=1.0):
    return max(lo, min(hi, v))


def safe_title(text: str) -> str:
    return str(text or 'Untitled Track').replace('&', '').replace('<', '').replace('>', '')


def parse_bpm(value) -> float:
    try:
        bpm = float(str(value).strip())
        return max(70.0, min(180.0, bpm))
    except Exception:
        return 118.0


def parse_key(raw: str, mode_hint: str) -> tuple[str, list[int], int]:
    text = str(raw or '').strip().upper().replace('MINOR', 'M').replace('MAJOR', '')
    tonic = ''.join(ch for ch in text if ch.isalpha() or ch == '#')[:2] or 'A'
    tonic = tonic if tonic in NOTE_INDEX else tonic[:1]
    tonic = tonic if tonic in NOTE_INDEX else 'A'
    minorish = 'M' in text or 'DARK' in str(mode_hint or '').upper() or 'SAD' in str(mode_hint or '').upper()
    scale = MINOR if minorish else MAJOR
    return tonic, scale, NOTE_INDEX[tonic]


def midi_to_freq(midi: float) -> float:
    return 440.0 * (2.0 ** ((midi - 69.0) / 12.0))


def degree_to_freq(root_index: int, scale: list[int], degree: int, octave: int) -> float:
    offset = scale[degree % len(scale)]
    midi = 12 * (octave + 1) + ((root_index + offset) % 12)
    return midi_to_freq(midi)


def beat_seconds(bpm: float) -> float:
    return 60.0 / bpm


def add_sine(buf: array, start: int, length: int, freq: float, amp: float, attack: float = 0.01, release: float = 0.12, detune: float = 0.0):
    if length <= 0:
        return
    sr = SAMPLE_RATE
    attack_n = max(1, int(length * attack))
    release_n = max(1, int(length * release))
    sustain_n = max(0, length - attack_n - release_n)
    phase2 = 0.0
    for i in range(length):
        t = i / sr
        if i < attack_n:
            env = i / attack_n
        elif i < attack_n + sustain_n:
            env = 1.0
        else:
            env = max(0.0, 1.0 - (i - attack_n - sustain_n) / release_n)
        trem = 0.9 + 0.1 * math.sin(2 * math.pi * 3.0 * t)
        sample = (
            math.sin(2 * math.pi * freq * t)
            + 0.28 * math.sin(2 * math.pi * freq * 2.0 * t + 0.3)
            + 0.12 * math.sin(2 * math.pi * freq * 0.5 * t + 0.7)
        ) / 1.4
        if detune:
            phase2 += 2 * math.pi * (freq * (1.0 + detune)) / sr
            sample = (sample + 0.45 * math.sin(phase2)) / 1.45
        idx = start + i
        if 0 <= idx < len(buf):
            buf[idx] += sample * amp * env * trem


def add_noise_hit(buf: array, start: int, length: int, amp: float, bright: bool = False):
    if length <= 0:
        return
    seed = (start * 1103515245 + 12345) & 0x7FFFFFFF
    last = 0.0
    for i in range(length):
        seed = (1103515245 * seed + 12345) & 0x7FFFFFFF
        white = ((seed / 0x7FFFFFFF) * 2.0 - 1.0)
        n = white if bright else (0.75 * last + 0.25 * white)
        last = n
        env = max(0.0, 1.0 - i / length) ** (2.8 if bright else 1.9)
        idx = start + i
        if 0 <= idx < len(buf):
            buf[idx] += n * amp * env


def add_kick(buf: array, start: int, beat_dur: float, amp: float = 0.95):
    length = int(SAMPLE_RATE * min(0.35, beat_dur * 0.95))
    for i in range(length):
        t = i / SAMPLE_RATE
        env = math.exp(-7.5 * t)
        freq = 110.0 - 70.0 * min(1.0, t / 0.12)
        sample = math.sin(2 * math.pi * freq * t) + 0.18 * math.sin(2 * math.pi * freq * 0.5 * t)
        idx = start + i
        if 0 <= idx < len(buf):
            buf[idx] += sample * amp * env * 0.85


def add_snare(buf: array, start: int, beat_dur: float, amp: float = 0.75):
    length = int(SAMPLE_RATE * min(0.25, beat_dur * 0.7))
    add_noise_hit(buf, start, length, amp, bright=True)
    add_sine(buf, start, int(length * 0.6), 185.0, amp * 0.25, attack=0.001, release=0.85)


def add_hat(buf: array, start: int, beat_dur: float, amp: float = 0.22):
    length = int(SAMPLE_RATE * min(0.09, beat_dur * 0.25))
    add_noise_hit(buf, start, length, amp, bright=True)


def clamp_int(value, lo, hi):
    try:
        return max(lo, min(hi, int(round(float(value)))))
    except Exception:
        return lo


def parse_section_dynamics(payload: dict) -> dict:
    defaults = {
        'intro': {'energy': 54, 'density': 34, 'drums': 26, 'motion': 'lift'},
        'verse': {'energy': 68, 'density': 58, 'drums': 56, 'motion': 'glide'},
        'chorus': {'energy': 95, 'density': 88, 'drums': 90, 'motion': 'explode'},
        'outro': {'energy': 48, 'density': 28, 'drums': 22, 'motion': 'resolve'},
    }
    incoming = payload.get('sectionDynamics') or {}
    out = {}
    for name, base in defaults.items():
        raw = incoming.get(name) or {}
        out[name] = {
            'energy': clamp_int(raw.get('energy', base['energy']), 5, 100),
            'density': clamp_int(raw.get('density', base['density']), 5, 100),
            'drums': clamp_int(raw.get('drums', base['drums']), 0, 100),
            'motion': str(raw.get('motion', base['motion']) or base['motion']).strip().lower(),
        }
    return out


def parse_section_bars(payload: dict) -> dict:
    raw = payload.get('sectionBars') or {}
    return {
        'intro': clamp_int(raw.get('intro', 2), 1, 16),
        'verse': clamp_int(raw.get('verse', 4), 2, 24),
        'chorus': clamp_int(raw.get('chorus', 4), 2, 24),
        'outro': clamp_int(raw.get('outro', 2), 1, 16),
    }


def section_pattern(name: str, motion: str) -> list[int]:
    bank = {
        'intro': {
            'lift': [0, 2, 4, 2, 0, 2, 4, 6],
            'glide': [0, 1, 2, 4, 2, 1, 0, 1],
            'explode': [0, 2, 4, 6, 4, 2, 1, 0],
            'resolve': [4, 2, 1, 0, 1, 0, 6, 0],
            'pulse': [0, 0, 2, 2, 4, 4, 2, 1],
        },
        'verse': {
            'lift': [0, 1, 2, 4, 2, 1, 0, 1],
            'glide': [0, 2, 4, 5, 4, 2, 1, 0],
            'explode': [2, 4, 5, 7, 5, 4, 2, 1],
            'resolve': [4, 2, 1, 0, 2, 1, 0, 6],
            'pulse': [0, 2, 0, 4, 2, 5, 4, 2],
        },
        'chorus': {
            'lift': [4, 4, 5, 6, 4, 2, 1, 0],
            'glide': [4, 5, 6, 4, 5, 2, 1, 0],
            'explode': [4, 6, 7, 9, 7, 6, 4, 2],
            'resolve': [6, 4, 2, 1, 4, 2, 1, 0],
            'pulse': [4, 4, 5, 5, 6, 6, 4, 2],
        },
        'outro': {
            'lift': [4, 2, 1, 0, 1, 0, 6, 0],
            'glide': [4, 2, 0, 1, 0, 6, 4, 2],
            'explode': [7, 6, 4, 2, 4, 2, 1, 0],
            'resolve': [4, 2, 1, 0, 0, 6, 4, 0],
            'pulse': [4, 4, 2, 2, 1, 1, 0, 0],
        },
    }
    return bank.get(name, bank['verse']).get(motion, bank.get(name, bank['verse'])['glide'])


def render_section(section_name: str, section_bars: int, bpm: float, root_idx: int, scale: list[int], lead_buf: array, inst_buf: array, drums_buf: array, profile: dict | None = None):
    beat_dur = beat_seconds(bpm)
    bar_dur = beat_dur * 4.0
    section_start_s = len(inst_buf) / SAMPLE_RATE - (section_bars * bar_dur)
    progression = [0, 5, 3, 4] if scale is MAJOR else [0, 5, 6, 4]
    profile = profile or {}
    energy_pct = clamp_int(profile.get('energy', {'intro': 55, 'verse': 72, 'chorus': 96, 'outro': 58}.get(section_name, 75)), 5, 100)
    density_pct = clamp_int(profile.get('density', {'intro': 34, 'verse': 58, 'chorus': 88, 'outro': 28}.get(section_name, 55)), 5, 100)
    drum_pct = clamp_int(profile.get('drums', {'intro': 26, 'verse': 56, 'chorus': 90, 'outro': 22}.get(section_name, 55)), 0, 100)
    motion = str(profile.get('motion', 'glide') or 'glide').lower()
    pattern = section_pattern(section_name, motion)
    energy = 0.34 + (energy_pct / 100.0) * 0.82
    density = density_pct / 100.0
    drum_drive = drum_pct / 100.0
    start_sample = int(section_start_s * SAMPLE_RATE)

    for bar in range(section_bars):
        chord_degree = progression[bar % len(progression)]
        bar_start = start_sample + int(bar * bar_dur * SAMPLE_RATE)
        root_f = degree_to_freq(root_idx, scale, chord_degree, 2)
        third_f = degree_to_freq(root_idx, scale, chord_degree + 2, 3)
        fifth_f = degree_to_freq(root_idx, scale, chord_degree + 4, 3)
        pad_amp = 0.04 + 0.10 * energy
        add_sine(inst_buf, bar_start, int(bar_dur * SAMPLE_RATE), root_f, pad_amp * (0.95 if motion == 'resolve' else 1.0), attack=0.04, release=0.35, detune=0.003)
        add_sine(inst_buf, bar_start, int(bar_dur * SAMPLE_RATE), third_f, pad_amp * 0.78, attack=0.04, release=0.35, detune=-0.002)
        add_sine(inst_buf, bar_start, int(bar_dur * SAMPLE_RATE), fifth_f, pad_amp * 0.74, attack=0.04, release=0.35, detune=0.001)
        if density > 0.62 or motion in ('explode', 'pulse'):
            upper_f = degree_to_freq(root_idx, scale, chord_degree + (6 if motion == 'explode' else 5), 4)
            add_sine(inst_buf, bar_start, int(bar_dur * SAMPLE_RATE), upper_f, 0.035 + 0.05 * density, attack=0.01, release=0.25, detune=0.006)

        kick_beats = {0}
        if drum_drive >= 0.4:
            kick_beats.add(2)
        if drum_drive >= 0.75 or motion in ('explode', 'pulse'):
            kick_beats.update({1, 3})
        snare_beats = {1, 3} if drum_drive >= 0.18 else {3}
        hat_steps = 4 if drum_drive < 0.4 else 8
        if drum_drive > 0.78: hat_steps = 16

        for beat in range(4):
            beat_start = bar_start + int(beat * beat_dur * SAMPLE_RATE)
            bass_deg = chord_degree if beat in (0, 2) else (chord_degree + 4)
            bass_len = int(beat_dur * (0.92 if density > 0.65 else 0.82) * SAMPLE_RATE)
            bass_amp = 0.10 + 0.16 * energy + (0.04 if motion == 'explode' else 0.0)
            add_sine(inst_buf, beat_start, bass_len, degree_to_freq(root_idx, scale, bass_deg, 1), bass_amp, attack=0.01, release=0.25)

            for step in range(hat_steps // 4):
                hat_pos = beat_start + int(step * (beat_dur / max(1, hat_steps // 4)) * SAMPLE_RATE)
                hat_amp = 0.06 + 0.20 * drum_drive
                if motion == 'resolve':
                    hat_amp *= 0.75
                add_hat(drums_buf, hat_pos, beat_dur / max(1, hat_steps // 4), hat_amp)

            if beat in kick_beats:
                add_kick(drums_buf, beat_start, beat_dur, 0.55 + 0.48 * drum_drive)
            if beat in snare_beats:
                add_snare(drums_buf, beat_start, beat_dur, 0.28 + 0.52 * drum_drive)
            if motion in ('pulse', 'explode') and drum_drive > 0.65:
                ghost = beat_start + int(beat_dur * 0.75 * SAMPLE_RATE)
                add_hat(drums_buf, ghost, beat_dur * 0.25, 0.05 + 0.10 * drum_drive)

        if density > 0.82 or motion == 'explode':
            step_seconds = beat_dur / 4.0
            octv = 5
            note_amp = 0.13 + 0.15 * energy
        elif density > 0.48:
            step_seconds = beat_dur / 2.0
            octv = 4
            note_amp = 0.12 + 0.11 * energy
        else:
            step_seconds = beat_dur
            octv = 4
            note_amp = 0.10 + 0.08 * energy
        note_length = int(step_seconds * (0.88 if motion != 'resolve' else 0.68) * SAMPLE_RATE)
        notes_per_bar = max(1, round(bar_dur / step_seconds))
        for step in range(notes_per_bar):
            note_start = bar_start + int(step * step_seconds * SAMPLE_RATE)
            deg = pattern[(bar * notes_per_bar + step) % len(pattern)]
            if motion == 'resolve' and step % 2 == 1 and density < 0.6:
                continue
            add_sine(lead_buf, note_start, note_length, degree_to_freq(root_idx, scale, deg + chord_degree, octv), note_amp, attack=0.02, release=0.35, detune=0.004)


def generate_song(title: str, bpm: float, key_text: str, vibe: str, length_sec: int, payload: dict | None = None) -> tuple[array, array, array, array, list[dict], dict]:
    payload = payload or {}
    _, scale, root_idx = parse_key(key_text, vibe)
    beat_dur = beat_seconds(bpm)
    bar_dur = beat_dur * 4.0
    target_bars = max(8, int(length_sec / bar_dur))
    bar_map = parse_section_bars(payload)
    dynamics = parse_section_dynamics(payload)
    section_plan = [('intro', bar_map['intro']), ('verse', bar_map['verse']), ('chorus', bar_map['chorus']), ('verse', bar_map['verse']), ('chorus', bar_map['chorus']), ('outro', bar_map['outro'])]
    total_planned = sum(b for _, b in section_plan)
    factor = max(1.0, target_bars / total_planned)
    planned = []
    for name, bars in section_plan:
        min_bars = 2 if name not in ('intro', 'outro') else 1
        scaled = max(min_bars, int(round(bars * factor)))
        planned.append((name, scaled))
    total_bars = sum(b for _, b in planned)
    total_seconds = total_bars * bar_dur
    total_samples = int(total_seconds * SAMPLE_RATE)

    lead = array('f', [0.0]) * total_samples
    inst = array('f', [0.0]) * total_samples
    drums = array('f', [0.0]) * total_samples
    sections = []
    cursor = 0.0
    for name, bars in planned:
        section_seconds = bars * bar_dur
        cursor_end = cursor + section_seconds
        section_meta = {'name': name, 'bars': bars, 'startSec': round(cursor, 2), 'endSec': round(cursor_end, 2), 'profile': dynamics.get(name, {})}
        sections.append(section_meta)
        render_section(name, bars, bpm, root_idx, scale, lead, inst, drums, dynamics.get(name, {}))
        cursor = cursor_end

    main = array('f', [0.0]) * total_samples
    instrumental = array('f', [0.0]) * total_samples
    for i in range(total_samples):
        instrumental[i] = inst[i] + drums[i]
        main[i] = instrumental[i] + lead[i]
    return main, lead, instrumental, drums, sections, dynamics


def normalize_to_pcm(mix: array) -> bytes:
    peak = max(0.001, max(abs(v) for v in mix))
    gain = min(0.95 / peak, 1.8)
    frames = bytearray()
    for sample in mix:
        value = int(clamp(sample * gain) * 32767)
        frames.extend(struct.pack('<h', value))
    return bytes(frames)


def write_wav(path: Path, mix: array):
    path.parent.mkdir(parents=True, exist_ok=True)
    pcm = normalize_to_pcm(mix)
    with wave.open(str(path), 'wb') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(pcm)


def svg_preview(path: Path, title: str, accent: str, subtitle: str):
    path.parent.mkdir(parents=True, exist_ok=True)
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0%" stop-color="#081425"/><stop offset="55%" stop-color="{accent}"/><stop offset="100%" stop-color="#090212"/></linearGradient></defs>
<rect width="1200" height="1200" fill="url(#g)"/>
<text x="80" y="220" font-size="82" font-family="Arial" fill="#fff" font-weight="700">{safe_title(title)}</text>
<text x="86" y="300" font-size="30" font-family="Arial" fill="#d6d6ff">{safe_title(subtitle)}</text>
<g transform="translate(88 430)">{''.join(f'<rect x="{i*28}" y="{110-(10+(i*17)%95)}" width="16" height="{10+(i*17)%95}" rx="8" fill="rgba(255,255,255,0.8)"/>' for i in range(30))}</g>
</svg>'''
    path.write_text(svg, encoding='utf-8')


def build_waveform(samples: array, buckets: int = 72) -> list[int]:
    if not samples:
        return [12] * buckets
    window = max(1, len(samples) // buckets)
    vals = []
    for i in range(0, len(samples), window):
        chunk = samples[i:i + window]
        if len(chunk) == 0:
            vals.append(12)
            continue
        avg = sum(abs(v) for v in chunk) / len(chunk)
        vals.append(max(10, min(96, round(avg * 140))))
    if len(vals) < buckets:
        vals.extend([vals[-1] if vals else 12] * (buckets - len(vals)))
    return vals[:buckets]





def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--input', required=True)
    ap.add_argument('--output', required=True)
    args = ap.parse_args()

    payload = json.loads(Path(args.input).read_text(encoding='utf-8'))
    title = str(payload.get('title') or 'Untitled track')
    bpm = parse_bpm(payload.get('bpm') or 118)
    key_text = str(payload.get('key') or 'A minor')
    vibe = str(payload.get('vibe') or payload.get('genre') or '')
    length_sec = int(payload.get('songLengthSec') or 30)
    run_root = Path(os.environ.get('MUSIC_RUN_ROOT', Path(args.output).parent))
    run_root.mkdir(parents=True, exist_ok=True)

    audio = run_root / 'main.wav'
    vocals = run_root / 'vocals.wav'
    instrumental = run_root / 'instrumental.wav'
    drums = run_root / 'drums.wav'
    cover = run_root / 'cover-art.svg'
    lyric = run_root / 'lyric-video.svg'

    main_mix, lead_mix, instrumental_mix, drums_mix, sections, dynamics = generate_song(title, bpm, key_text, vibe, length_sec, payload)
    write_wav(audio, main_mix)
    write_wav(vocals, lead_mix)
    write_wav(instrumental, instrumental_mix)
    write_wav(drums, drums_mix)
    svg_preview(cover, title, '#6a3cff', 'Procedural full-song cover preview')
    svg_preview(lyric, title, '#0fdc7a', 'Procedural lyric-video lane')

    result = {
        'provider': 'procedural-song-adapter',
        'audioPath': str(audio),
        'stems': {
            'vocals': str(vocals),
            'instrumental': str(instrumental),
            'drums': str(drums),
        },
        'coverArtPath': str(cover),
        'lyricVideoPath': str(lyric),
        'waveform': build_waveform(main_mix),
        'meta': {
            'engine': 'procedural-song-adapter',
            'adapter': 'musicgen_adapter.py',
            'bpm': bpm,
            'key': key_text,
            'sections': sections,
            'note': 'This is a local procedural full-song generator with arranged sections and stems. It is musical, but not a lyrics-singing foundation model like Suno.',
            'sectionDynamics': dynamics,
        },
    }
    Path(args.output).write_text(json.dumps(result, indent=2), encoding='utf-8')


if __name__ == '__main__':
    main()
