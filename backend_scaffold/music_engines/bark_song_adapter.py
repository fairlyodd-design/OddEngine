
import argparse
import json
import os
import wave
import struct
from pathlib import Path

try:
    from .section_contract import apply_style_preset, build_section_plan, bark_text_for_section, crossfade_concat, section_timings_from_plan
    from .lyrics_generator import flatten_lyrics_for_payload, generate_lyrics
    from .mix_engine import mix_song
    from .melody_voice import apply_pitch_follow, polish_vocals, section_fx_profile
except ImportError:
    from section_contract import apply_style_preset, build_section_plan, bark_text_for_section, crossfade_concat, section_timings_from_plan
    from lyrics_generator import flatten_lyrics_for_payload, generate_lyrics
    from mix_engine import mix_song
    from melody_voice import apply_pitch_follow, polish_vocals, section_fx_profile

SAMPLE_RATE = 24000
CROSSFADE_SEC = 0.12
DEFAULT_VOCAL_MODE = 'hybrid'

def clamp(v, lo=-1.0, hi=1.0):
    return max(lo, min(hi, v))

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

def runtime_probe():
    reasons = []
    try:
        import bark  # noqa:F401
        return {"ok": True, "runtime": "bark", "detail": "bark import succeeded"}
    except Exception as e:
        reasons.append(f"bark: {e}")
    try:
        import transformers  # noqa:F401
        import torch  # noqa:F401
        return {"ok": True, "runtime": "transformers-bark", "detail": "transformers Bark path available"}
    except Exception as e:
        reasons.append(f"transformers: {e}")
    return {"ok": False, "runtime": "none", "detail": '; '.join(reasons)}

def try_native_bark(text, vocals_path: Path):
    from bark import SAMPLE_RATE as BARK_SR, generate_audio, preload_models
    preload_models()
    audio = generate_audio(text)
    samples = audio.tolist() if hasattr(audio, 'tolist') else list(audio)
    write_wav(vocals_path, samples, BARK_SR)
    return {"runtime": "bark", "text": text, "sample_rate": int(BARK_SR)}

def try_transformers_bark(text, vocals_path: Path):
    from transformers import AutoProcessor, BarkModel
    model_name = os.environ.get('BARK_MODEL_NAME', 'suno/bark-small')
    processor = AutoProcessor.from_pretrained(model_name)
    model = BarkModel.from_pretrained(model_name)
    inputs = processor(text=[text], voice_preset='v2/en_speaker_6', return_tensors='pt')
    audio_array = model.generate(**inputs, do_sample=True)
    sr = getattr(model.generation_config, 'sample_rate', SAMPLE_RATE)
    samples = audio_array[0].detach().cpu().float().numpy().flatten().tolist()
    write_wav(vocals_path, samples, sr)
    return {"runtime": "transformers-bark", "model": model_name, "text": text, "sample_rate": int(sr)}

def generate_section_voice(text, vocals_path: Path):
    errors = []
    try:
        return try_native_bark(text, vocals_path)
    except Exception as e:
        errors.append(f"bark failed: {e}")
    try:
        return try_transformers_bark(text, vocals_path)
    except Exception as e:
        errors.append(f"transformers bark failed: {e}")
    raise RuntimeError('No working local Bark runtime found. ' + ' | '.join(errors))

def do_generate(payload, run_root: Path):
    payload = apply_style_preset(payload)
    payload.setdefault('vocalMode', DEFAULT_VOCAL_MODE)
    if not payload.get('enableVocals', str(payload.get('mode') or 'song') != 'instrumental'):
        blank = run_root / 'vocals.wav'
        write_wav(blank, [], SAMPLE_RATE)
        plan = payload.get('sectionPlan') or build_section_plan(payload)
        return {
            'provider': 'bark-vocal-overlay',
            'audioPath': str(payload.get('instrumentalPath') or run_root / 'main.wav'),
            'stems': {'vocals': str(blank), 'instrumental': str(payload.get('instrumentalPath') or run_root / 'instrumental.wav'), 'drums': str(run_root / 'drums.wav') if (run_root / 'drums.wav').exists() else ''},
            'waveform': build_waveform([]),
            'meta': {'engine': 'bark-vocal-overlay', 'adapter': 'bark_song_adapter.py', 'note': 'Vocals disabled for this render.', 'sectionDynamics': plan, 'sectionTimings': section_timings_from_plan(plan, CROSSFADE_SEC), 'engineUsedPerSection': [], 'contractVersion': 'v10.29', 'stylePreset': payload.get('stylePreset', 'default'), 'enableVocals': False},
        }
    vocals = run_root / 'vocals.wav'
    main = run_root / 'main.wav'
    instrumental_path = Path(str(payload.get('instrumentalPath') or run_root / 'instrumental.wav'))
    bark_model = os.environ.get('BARK_MODEL_NAME', str(payload.get('barkModel') or 'suno/bark-small'))
    plan = payload.get('sectionPlan') or build_section_plan(payload)
    vocal_mode = str(payload.get('vocalMode') or DEFAULT_VOCAL_MODE).strip().lower()
    chorus_boost = float(payload.get('chorusBoost') or 0.18)
    if not str(payload.get('lyrics') or '').strip():
        payload['lyrics'] = flatten_lyrics_for_payload(payload)
    generated_lyrics = generate_lyrics(payload)
    instrumental_samples = []
    instrumental_path = Path(str(payload.get('instrumentalPath') or run_root / 'instrumental.wav'))
    if instrumental_path.exists():
        try:
            i_sr, instrumental_samples = read_wav(instrumental_path)
            instrumental_samples = ensure_audible_audio(resample_linear(instrumental_samples, i_sr, SAMPLE_RATE), freq=220.0, seconds=2.0, sample_rate=SAMPLE_RATE)
        except Exception:
            instrumental_samples = []
    section_voice = []
    per_section_meta = []
    name_counts = {}
    for idx, section in enumerate(plan):
        name = section.get('name', 'verse')
        name_counts[name] = name_counts.get(name, 0) + 1
        lyric_key = f"{name}_{name_counts[name]}"
        section_payload = dict(payload)
        section_payload['lyrics'] = generated_lyrics.get(lyric_key, payload.get('lyrics', ''))
        text = bark_text_for_section(section, section_payload, idx)
        clip_path = run_root / f'vocal_section_{idx:02d}_{name}.wav'
        meta = generate_section_voice(text, clip_path)
        sr, samples = read_wav(clip_path)
        samples = ensure_audible_audio(resample_linear(samples, sr, SAMPLE_RATE), freq=330.0 + (idx * 20.0), seconds=2.0, sample_rate=SAMPLE_RATE)
        dur_ratio = float(idx) / max(1.0, len(plan) - 1.0) if len(plan) > 1 else 0.0
        inst_slice = instrumental_samples[int(len(instrumental_samples) * max(0.0, dur_ratio - 0.12)):int(len(instrumental_samples) * min(1.0, dur_ratio + 0.18))] if instrumental_samples else []
        samples = apply_pitch_follow(samples, section, SAMPLE_RATE, vocal_mode=vocal_mode, instrumental_samples=inst_slice)
        samples = polish_vocals(samples, section, SAMPLE_RATE, vocal_mode=vocal_mode)
        fx = section_fx_profile(section, vocal_mode=vocal_mode)
        if name == 'chorus':
            fx['gain'] = float(fx.get('gain', 1.0)) + chorus_boost
            fx['double'] = float(fx.get('double', 0.0)) + (chorus_boost * 0.25)
            fx['reverb'] = float(fx.get('reverb', 0.0)) + 0.04
        section_payload['sectionVocalFx'] = fx
        write_wav(clip_path, samples, SAMPLE_RATE)
        section_voice.append(samples)
        per_section_meta.append({'index': idx, 'name': name, 'engine': 'bark-cli', 'runtime': meta.get('runtime'), 'text': text, 'style': section.get('barkStyle'), 'model': bark_model, 'lyricKey': lyric_key, 'vocalMode': vocal_mode, 'fx': fx, 'melodyGuidance': True})
    vocal_samples = ensure_audible_audio(crossfade_concat(section_voice, SAMPLE_RATE, CROSSFADE_SEC), freq=330.0, seconds=2.0, sample_rate=SAMPLE_RATE)
    write_wav(vocals, vocal_samples, SAMPLE_RATE)
    drum_samples = []
    drum_path = run_root / 'drums.wav'
    if drum_path.exists():
        d_sr, drum_samples = read_wav(drum_path)
        drum_samples = ensure_audible_audio(resample_linear(drum_samples, d_sr, SAMPLE_RATE), freq=110.0, seconds=2.0, sample_rate=SAMPLE_RATE)
    song_fx = {'gain': 1.02 if vocal_mode != 'spoken' else 1.0, 'delay_ms': 126 if vocal_mode != 'spoken' else 82, 'delay_mix': 0.13 if vocal_mode != 'spoken' else 0.08, 'reverb': 0.17 if vocal_mode == 'sing' else 0.13, 'double': max(0.05, chorus_boost * 0.24), 'double_shift': 24, 'presence': 0.08 if vocal_mode == 'sing' else 0.06, 'air': 0.04 if vocal_mode != 'spoken' else 0.02}
    mixed = mix_song(instrumental_samples, vocal_samples, drum_samples, sample_rate=SAMPLE_RATE, vocal_fx=song_fx)
    merged = mixed['samples'] if instrumental_samples or drum_samples else list(vocal_samples)
    merged = ensure_audible_audio(merged, freq=330.0, seconds=2.0, sample_rate=SAMPLE_RATE)
    write_wav(main, merged, SAMPLE_RATE)
    timings = section_timings_from_plan([{**section, 'engine': 'bark-cli', 'prompt': bark_text_for_section(section, payload, idx)} for idx, section in enumerate(plan)], CROSSFADE_SEC)
    return {
        'provider': 'bark-vocal-overlay',
        'audioPath': str(main),
        'stems': {'vocals': str(vocals), 'instrumental': str(instrumental_path) if instrumental_path.exists() else '', 'drums': str(drum_path) if drum_path.exists() else ''},
        'waveform': build_waveform(merged),
        'meta': {'engine': 'bark-vocal-overlay', 'adapter': 'bark_song_adapter.py', 'model': bark_model, 'vocalMode': vocal_mode, 'chorusBoost': chorus_boost, 'note': 'Backed by a real local Bark runtime when installed. Section phrasing follows the shared section dynamics contract, adds artist-voice polish shaping, smoother phrase contouring, emotion-aware section FX, stronger chorus layering, and a less robotic vocal edge.', 'lyrics': payload.get('lyrics', ''), 'lyricsBySection': generated_lyrics, 'mix': {'gain': mixed.get('gain') if instrumental_samples or drum_samples else 1.0}, 'sectionDynamics': plan, 'sectionTimings': timings, 'engineUsedPerSection': per_section_meta, 'contractVersion': 'v10.29', 'stylePreset': payload.get('stylePreset', 'default'), 'enableVocals': True},
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
