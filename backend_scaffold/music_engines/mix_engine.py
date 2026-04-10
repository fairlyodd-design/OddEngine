import math

SILENCE_EPSILON = 1e-5
DEFAULT_SAMPLE_RATE = 44100

def clamp(v, lo=-1.0, hi=1.0):
    return max(lo, min(hi, float(v)))

def _as_list(samples):
    if samples is None:
        return []
    if isinstance(samples, list):
        return [float(x) for x in samples]
    return [float(x) for x in list(samples)]

def _peak(samples):
    src = _as_list(samples)
    return max([abs(float(x)) for x in src] + [0.0])

def _is_effectively_silent(samples, threshold=SILENCE_EPSILON):
    return _peak(samples) < float(threshold)

def _audible_fallback(seconds=2.0, freq=220.0, sample_rate=DEFAULT_SAMPLE_RATE):
    total = max(1, int(float(seconds) * float(sample_rate)))
    return [
        0.20 * math.sin(2.0 * math.pi * float(freq) * (i / float(sample_rate)))
        for i in range(total)
    ]

def mix_tracks(a, b, ga=1.0, gb=1.0):
    a = _as_list(a)
    b = _as_list(b)
    n = max(len(a), len(b))
    out = [0.0] * n
    for i in range(n):
        av = a[i] if i < len(a) else 0.0
        bv = b[i] if i < len(b) else 0.0
        out[i] = (av * float(ga)) + (bv * float(gb))
    return out

def normalize(samples, ceiling=0.92, min_gain=1.0, max_gain=12.0):
    samples = _as_list(samples)
    if not samples:
        return [], 1.0
    peak = _peak(samples)
    if peak < SILENCE_EPSILON:
        fb = _audible_fallback()
        return fb, 1.0
    gain = float(ceiling) / peak
    gain = max(float(min_gain), min(float(max_gain), gain))
    return [clamp(float(x) * gain) for x in samples], gain

def duck_instrumental(instrumental, vocals, floor=0.80, depth=0.18):
    instrumental = _as_list(instrumental)
    vocals = _as_list(vocals)
    n = max(len(instrumental), len(vocals))
    out = [0.0] * n
    for i in range(n):
        inst = instrumental[i] if i < len(instrumental) else 0.0
        voc = vocals[i] if i < len(vocals) else 0.0
        control = min(1.0, abs(voc) * 1.6)
        gain = max(float(floor), 1.0 - control * float(depth))
        out[i] = inst * gain
    return out

def _delay(samples, sample_rate, delay_ms=140, mix=0.12, feedback=0.18):
    src = _as_list(samples)
    if not src or float(mix) <= 0:
        return src
    delay = max(1, int(float(sample_rate) * (float(delay_ms) / 1000.0)))
    out = list(src)
    for i in range(delay, len(out)):
        out[i] += out[i-delay] * float(feedback) * float(mix)
    return [clamp(src[i] * (1.0 - float(mix)) + out[i] * float(mix)) for i in range(len(src))]

def _reverb(samples, sample_rate, amount=0.14):
    src = _as_list(samples)
    if not src or float(amount) <= 0:
        return src
    taps = [int(float(sample_rate) * t) for t in (0.013, 0.021, 0.034)]
    gains = [0.55 * float(amount), 0.35 * float(amount), 0.22 * float(amount)]
    out = list(src)
    for tap, gain in zip(taps, gains):
        for i in range(tap, len(out)):
            out[i] += src[i - tap] * gain
    return [clamp(x) for x in out]

def _double(samples, shift=24, amount=0.12):
    src = _as_list(samples)
    if not src or float(amount) <= 0:
        return src
    out = list(src)
    for i in range(int(shift), len(out)):
        out[i] = clamp(out[i] + src[i-int(shift)] * float(amount))
    return out

def _soft_compress(samples, drive=1.08):
    src = _as_list(samples)
    return [math.tanh(float(x) * float(drive)) for x in src]

def ensure_audible(samples, fallback_freq=440.0, sample_rate=DEFAULT_SAMPLE_RATE):
    src = _as_list(samples)
    if not src or _is_effectively_silent(src):
        return _audible_fallback(freq=float(fallback_freq), sample_rate=int(sample_rate))
    normalized, _ = normalize(src)
    return normalized

def mix_song(instrumental, vocals, drums=None, instrumental_gain=0.96, vocal_gain=1.00, drum_gain=0.30, sample_rate=24000, vocal_fx=None):
    vocal_fx = dict(vocal_fx or {})
    instrumental = _as_list(instrumental)
    vocals = _as_list(vocals)
    drums = _as_list(drums)

    if vocals:
        vocals = _double(vocals, int(vocal_fx.get('double_shift', 24)), float(vocal_fx.get('double', 0.0)))
        vocals = _delay(vocals, sample_rate, vocal_fx.get('delay_ms', 120), vocal_fx.get('delay_mix', 0.12), vocal_fx.get('feedback', 0.18))
        vocals = _reverb(vocals, sample_rate, vocal_fx.get('reverb', 0.14))
        vocals = _soft_compress(vocals, vocal_fx.get('compress_drive', 1.06))

    if not instrumental and not vocals and not drums:
        fb = _audible_fallback(sample_rate=sample_rate)
        return {"samples": fb, "gain": 1.0, "duckedInstrumental": [], "processedVocals": []}

    if not instrumental and vocals:
        out = ensure_audible(vocals, fallback_freq=330.0, sample_rate=sample_rate)
        return {"samples": out, "gain": 1.0, "duckedInstrumental": [], "processedVocals": vocals}

    if instrumental and not vocals and not drums:
        out = ensure_audible(instrumental, fallback_freq=220.0, sample_rate=sample_rate)
        return {"samples": out, "gain": 1.0, "duckedInstrumental": instrumental, "processedVocals": []}

    ducked_inst = duck_instrumental(instrumental, vocals, floor=vocal_fx.get('duck_floor', 0.80), depth=vocal_fx.get('duck_depth', 0.18))
    base = mix_tracks(ducked_inst, vocals, instrumental_gain, vocal_gain * float(vocal_fx.get('gain', 1.0)))
    if drums:
        base = mix_tracks(base, drums, 1.0, drum_gain)

    if _is_effectively_silent(base):
        if instrumental:
            base = mix_tracks(instrumental, vocals, 1.0, 1.0)
        elif vocals:
            base = list(vocals)
        elif drums:
            base = list(drums)

    normalized, gain = normalize(base)
    normalized = ensure_audible(normalized, fallback_freq=440.0, sample_rate=sample_rate)
    return {"samples": normalized, "gain": gain, "duckedInstrumental": ducked_inst, "processedVocals": vocals}
