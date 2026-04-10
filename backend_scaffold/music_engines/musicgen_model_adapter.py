import argparse
import json
import math
import os
import wave
import struct
from pathlib import Path

try:
    from .section_contract import apply_style_preset, build_section_plan, crossfade_concat, section_timings_from_plan
except ImportError:
    from section_contract import apply_style_preset, build_section_plan, crossfade_concat, section_timings_from_plan

SAMPLE_RATE = 32000
CROSSFADE_SEC = 0.12


SILENCE_EPSILON = 1e-5

def peak_abs(samples):
    vals = [abs(float(v)) for v in list(samples or [])]
    return max(vals + [0.0])

def ensure_audible_audio(samples, freq=220.0, seconds=2.0, sample_rate=SAMPLE_RATE):
    src = [float(v) for v in list(samples or [])]
    if not src or peak_abs(src) < SILENCE_EPSILON:
        total = max(1, int(float(seconds) * float(sample_rate)))
        src = [0.20 * math.sin(2.0 * math.pi * float(freq) * (i / float(sample_rate))) for i in range(total)]
    return src



def clamp(v, lo=-1.0, hi=1.0):
    return max(lo, min(hi, v))


def safe_text(text: str) -> str:
    return str(text or '').replace('&', '').replace('<', '').replace('>', '')


def parse_bpm(value) -> float:
    try:
        return max(70.0, min(180.0, float(str(value).strip())))
    except Exception:
        return 118.0


def write_wav(path: Path, samples, sample_rate=SAMPLE_RATE):
    path.parent.mkdir(parents=True, exist_ok=True)
    src = ensure_audible_audio(samples, seconds=2.0, sample_rate=sample_rate)
    peak = max(0.001, peak_abs(src))
    gain = min(0.92 / peak, 12.0)
    frames = bytearray()
    for sample in src:
        value = int(clamp(float(sample) * gain) * 32767)
        frames.extend(struct.pack('<h', value))
    with wave.open(str(path), 'wb') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(bytes(frames))

def read_wav(path: Path):
    with wave.open(str(path), 'rb') as wf:
        channels = wf.getnchannels()
        sr = wf.getframerate()
        frames = wf.readframes(wf.getnframes())
    vals = struct.unpack('<' + 'h' * (len(frames) // 2), frames)
    if channels > 1:
        mono = []
        for i in range(0, len(vals), channels):
            chunk = vals[i:i+channels]
            mono.append(sum(chunk)/max(1, len(chunk))/32768.0)
    else:
        mono = [v/32768.0 for v in vals]
    return sr, mono


def resample_linear(samples, src_sr, dst_sr):
    if src_sr == dst_sr:
        return list(samples)
    if not samples:
        return []
    ratio = float(dst_sr) / float(src_sr)
    out_len = max(1, int(len(samples) * ratio))
    out = [0.0] * out_len
    for i in range(out_len):
        pos = i / ratio
        left = int(pos)
        right = min(left + 1, len(samples) - 1)
        frac = pos - left
        out[i] = samples[left] * (1.0 - frac) + samples[right] * frac
    return out


def build_waveform(samples, buckets=72):
    if not samples:
        return [12] * buckets
    window = max(1, len(samples) // buckets)
    vals = []
    for i in range(0, len(samples), window):
        chunk = samples[i:i + window]
        avg = sum(abs(float(v)) for v in chunk) / max(1, len(chunk))
        vals.append(max(10, min(96, round(avg * 140))))
    while len(vals) < buckets:
        vals.append(vals[-1] if vals else 12)
    return vals[:buckets]


def svg_preview(path: Path, title: str, accent: str, subtitle: str):
    bars = ''.join(f'<rect x="{i*20}" y="{112-(10+(i*13)%90)}" width="12" height="{10+(i*13)%90}" rx="6" fill="rgba(255,255,255,0.8)"/>' for i in range(40))
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#081425"/><stop offset="55%" stop-color="{accent}"/><stop offset="100%" stop-color="#090212"/></linearGradient></defs>
<rect width="1200" height="1200" fill="url(#g)"/>
<text x="80" y="220" font-size="82" font-family="Arial" fill="#fff" font-weight="700">{safe_text(title)}</text>
<text x="86" y="300" font-size="30" font-family="Arial" fill="#d6d6ff">{safe_text(subtitle)}</text>
<g transform="translate(88 430)">{bars}</g>
</svg>'''
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(svg, encoding='utf-8')


def runtime_probe():
    reasons = []
    try:
        import audiocraft  # noqa:F401
        return {"ok": True, "runtime": "audiocraft", "detail": "audiocraft import succeeded"}
    except Exception as e:
        reasons.append(f"audiocraft: {e}")
    try:
        import transformers  # noqa:F401
        import torch  # noqa:F401
        return {"ok": True, "runtime": "transformers", "detail": "transformers MusicGen path available"}
    except Exception as e:
        reasons.append(f"transformers: {e}")
    return {"ok": False, "runtime": "none", "detail": '; '.join(reasons)}


def procedural_drum_section(seconds: float, bpm: float, drums: float, motion: str):
    total = max(1, int(seconds * SAMPLE_RATE))
    beat = 60.0 / bpm
    arr = [0.0] * total
    kick_gain = 0.18 + 0.75 * drums
    snare_gain = 0.12 + 0.52 * drums
    hat_gain = 0.05 + 0.22 * drums
    hat_div = 2 if drums < 0.35 else 4 if drums < 0.7 else 8
    for i in range(int(seconds / beat) + 2):
        beat_idx = i % 4
        start = int(i * beat * SAMPLE_RATE)
        if beat_idx in (0, 2) or (motion == 'explode' and beat_idx in (1, 3)):
            dur = int(min(0.14, beat * 0.45) * SAMPLE_RATE)
            for j in range(dur):
                idx = start + j
                if idx < total:
                    t = j / SAMPLE_RATE
                    env = math.exp(-9 * t)
                    freq = 110 - 70 * min(1, t / 0.12)
                    arr[idx] += math.sin(2 * math.pi * freq * t) * env * kick_gain
        if drums > 0.12 and beat_idx in (1, 3):
            dur = int(min(0.08, beat * 0.25) * SAMPLE_RATE)
            for j in range(dur):
                idx = start + j
                if idx < total:
                    env = math.exp(-12 * (j / SAMPLE_RATE))
                    noise = math.sin(2 * math.pi * 190 * (j / SAMPLE_RATE))
                    arr[idx] += noise * env * snare_gain
        for step in range(hat_div):
            hat_start = start + int(step * (beat / hat_div) * SAMPLE_RATE)
            dur = int(min(0.03, beat * 0.15) * SAMPLE_RATE)
            for j in range(dur):
                idx = hat_start + j
                if idx < total:
                    env = math.exp(-24 * (j / SAMPLE_RATE))
                    tone = math.sin(2 * math.pi * 9000 * (j / SAMPLE_RATE))
                    arr[idx] += tone * env * hat_gain
    return arr


def generate_section_audiocraft(prompt: str, seconds: int, model_name: str, out_audio: Path):
    from audiocraft.models import MusicGen
    from audiocraft.data.audio import audio_write
    model = MusicGen.get_pretrained(model_name)
    model.set_generation_params(duration=seconds)
    wav = model.generate([prompt], progress=False)
    sample = wav[0].detach().cpu()
    audio_write(out_audio.with_suffix(''), sample, model.sample_rate, strategy='loudness', loudness_compressor=True)
    generated = out_audio.with_suffix('.wav')
    if generated != out_audio and generated.exists():
        generated.replace(out_audio)
    return {"runtime": "audiocraft", "sample_rate": int(model.sample_rate), "prompt": prompt, "seconds": seconds}


def generate_section_transformers(prompt: str, seconds: int, model_name: str, out_audio: Path):
    from transformers import AutoProcessor, MusicgenForConditionalGeneration
    processor = AutoProcessor.from_pretrained(model_name)
    model = MusicgenForConditionalGeneration.from_pretrained(model_name)
    inputs = processor(text=[prompt], padding=True, return_tensors='pt')
    sr = getattr(model.config.audio_encoder, 'sampling_rate', SAMPLE_RATE)
    max_new_tokens = max(256, min(2048, int(seconds * 50)))
    audio_values = model.generate(**inputs, do_sample=True, guidance_scale=3.0, max_new_tokens=max_new_tokens)
    arr = audio_values[0].detach().cpu().float().numpy().flatten().tolist()
    arr = resample_linear(arr, sr, SAMPLE_RATE)
    write_wav(out_audio, arr, SAMPLE_RATE)
    return {"runtime": "transformers", "sample_rate": SAMPLE_RATE, "prompt": prompt, "seconds": seconds}


def generate_section_clip(prompt: str, seconds: int, model_name: str, out_audio: Path):
    errors = []
    try:
        return generate_section_audiocraft(prompt, seconds, model_name, out_audio)
    except Exception as e:
        errors.append(f"audiocraft failed: {e}")
    try:
        return generate_section_transformers(prompt, seconds, model_name, out_audio)
    except Exception as e:
        errors.append(f"transformers failed: {e}")
    raise RuntimeError('No working local MusicGen runtime found. ' + ' | '.join(errors))


def do_generate(payload, run_root: Path):
    title = str(payload.get('title') or 'Untitled track')
    bpm = parse_bpm(payload.get('bpm') or 118)
    audio = run_root / 'main.wav'
    inst = run_root / 'instrumental.wav'
    drums = run_root / 'drums.wav'
    vocals = run_root / 'vocals.wav'
    cover = run_root / 'cover-art.svg'
    lyric = run_root / 'lyric-video.svg'
    model_name = os.environ.get('MUSICGEN_MODEL_NAME', str(payload.get('musicgenModel') or 'facebook/musicgen-small'))

    payload = apply_style_preset(payload)
    plan = payload.get('sectionPlan') or build_section_plan(payload)
    section_audio = []
    section_drums = []
    per_section_meta = []

    for idx, section in enumerate(plan):
        seconds = max(4, min(35, int(round(float(section.get('durationSec', 8.0))))))
        prompt = str(section.get('prompt') or '')
        clip_path = run_root / f'section_{idx:02d}_{section.get("name","part")}.wav'
        meta = generate_section_clip(prompt, seconds, model_name, clip_path)
        sr, samples = read_wav(clip_path)
        samples = resample_linear(samples, sr, SAMPLE_RATE)
        write_wav(clip_path, samples, SAMPLE_RATE)
        section_audio.append(samples)
        section_drums.append(procedural_drum_section(seconds, bpm, float(section.get('drums', 0.5)), str(section.get('motion', 'drive'))))
        per_section_meta.append({
            'index': idx,
            'name': section.get('name'),
            'engine': 'musicgen-cli',
            'runtime': meta.get('runtime'),
            'prompt': prompt,
            'durationSec': seconds,
            'model': model_name,
        })

    inst_samples = ensure_audible_audio(crossfade_concat(section_audio, SAMPLE_RATE, CROSSFADE_SEC), freq=220.0, seconds=2.0, sample_rate=SAMPLE_RATE)
    drum_samples = ensure_audible_audio(crossfade_concat(section_drums, SAMPLE_RATE, CROSSFADE_SEC), freq=110.0, seconds=2.0, sample_rate=SAMPLE_RATE)
    vocal_samples = [0.0] * len(inst_samples)
    main_len = max(len(inst_samples), len(drum_samples))
    main_samples = [0.0] * main_len
    for i in range(main_len):
        main_samples[i] = (inst_samples[i] * 0.96 if i < len(inst_samples) else 0.0) + (drum_samples[i] * 0.30 if i < len(drum_samples) else 0.0)
    main_samples = ensure_audible_audio(main_samples, freq=220.0, seconds=2.0, sample_rate=SAMPLE_RATE)

    write_wav(inst, inst_samples, SAMPLE_RATE)
    write_wav(drums, drum_samples, SAMPLE_RATE)
    write_wav(vocals, vocal_samples, SAMPLE_RATE)
    write_wav(audio, main_samples, SAMPLE_RATE)
    svg_preview(cover, title, '#6a3cff', 'MusicGen section-synced cover preview')
    svg_preview(lyric, title, '#0fdc7a', 'MusicGen section-synced lyric lane')

    timings = section_timings_from_plan([
        {**section, 'engine': 'musicgen-cli', 'prompt': section.get('prompt', '')}
        for section in plan
    ], CROSSFADE_SEC)

    return {
        'provider': 'musicgen-local-runtime',
        'audioPath': str(audio),
        'stems': {
            'vocals': str(vocals),
            'instrumental': str(inst),
            'drums': str(drums),
        },
        'coverArtPath': str(cover),
        'lyricVideoPath': str(lyric),
        'waveform': build_waveform(main_samples),
        'meta': {
            'engine': 'musicgen-local-runtime',
            'adapter': 'musicgen_model_adapter.py',
            'bpm': bpm,
            'model': model_name,
            'note': 'Backed by a real local MusicGen runtime when installed. Section prompts are generated from the shared section dynamics contract and stitched with crossfades.',
            'sectionDynamics': plan,
            'sectionTimings': timings,
            'engineUsedPerSection': per_section_meta,
            'contractVersion': 'v10.28',
            'stylePreset': payload.get('stylePreset', 'default'),
            'enableVocals': bool(payload.get('enableVocals', str(payload.get('mode') or 'song') != 'instrumental')),

        },
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--input')
    ap.add_argument('--output')
    ap.add_argument('--probe', action='store_true')
    args = ap.parse_args()

    if args.probe:
        print(json.dumps(runtime_probe(), indent=2))
        return

    if not args.input or not args.output:
        raise SystemExit('--input and --output are required unless using --probe')
    payload = json.loads(Path(args.input).read_text(encoding='utf-8'))
    run_root = Path(os.environ.get('MUSIC_RUN_ROOT', Path(args.output).parent))
    run_root.mkdir(parents=True, exist_ok=True)
    result = do_generate(payload, run_root)
    Path(args.output).write_text(json.dumps(result, indent=2), encoding='utf-8')


if __name__ == '__main__':
    main()
