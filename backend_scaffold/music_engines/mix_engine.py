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
    return [0.20 * math.sin(2.0 * math.pi * float(freq) * (i / float(sample_rate))) for i in range(total)]

def _moving_average(samples, radius=2):
    src = _as_list(samples)
    if not src or radius <= 0:
        return src
    out = []
    for i in range(len(src)):
        lo = max(0, i - radius)
        hi = min(len(src), i + radius + 1)
        chunk = src[lo:hi]
        out.append(sum(chunk) / max(1, len(chunk)))
    return out

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

def duck_instrumental(instrumental, vocals, floor=0.82, depth=0.16):
    instrumental = _as_list(instrumental)
    vocals = _as_list(vocals)
    n = max(len(instrumental), len(vocals))
    if n <= 0:
        return []
    out = []
    for i in range(n):
        inst = instrumental[i] if i < len(instrumental) else 0.0
        voc = vocals[i] if i < len(vocals) else 0.0
        voc_strength = min(1.0, abs(voc) * 2.2)
        gain = max(float(floor), 1.0 - (float(depth) * voc_strength))
        out.append(inst * gain)
    return out

def _delay(samples, sample_rate=DEFAULT_SAMPLE_RATE, delay_ms=120, mix=0.12, feedback=0.18):
    src = _as_list(samples)
    if not src or mix <= 0.0:
        return src
    delay_samples = max(1, int((float(delay_ms) / 1000.0) * float(sample_rate)))
    out = list(src)
    for i in range(delay_samples, len(out)):
        out[i] = clamp(out[i] + (out[i - delay_samples] * float(mix)))
        tap = i - (delay_samples * 2)
        if tap >= 0:
            out[i] = clamp(out[i] + (out[tap] * float(feedback) * float(mix)))
    return out

def _reverb(samples, amount=0.12):
    src = _as_list(samples)
    if not src or amount <= 0.0:
        return src
    short = _moving_average(src, radius=6)
    tail = _moving_average(src, radius=18)
    out = []
    for dry, a, b in zip(src, short, tail):
        out.append(clamp((dry * (1.0 - amount)) + (a * amount * 0.55) + (b * amount * 0.45)))
    return out

def _double(samples, shift=22, mix=0.10):
    src = _as_list(samples)
    if not src or mix <= 0.0:
        return src
    shift = max(1, int(shift))
    dbl = [0.0] * len(src)
    for i in range(len(src)):
        j = i - shift
        if j >= 0:
            dbl[i] = src[j]
    out = []
    for a, b in zip(src, dbl):
        out.append(clamp((a * (1.0 - mix)) + (b * mix)))
    return out

def _soft_compress(samples, threshold=0.72, ratio=2.2, makeup=1.04):
    src = _as_list(samples)
    out = []
    thr = float(threshold)
    rat = max(1.0, float(ratio))
    for sample in src:
        sign = -1.0 if sample < 0 else 1.0
        mag = abs(sample)
        if mag > thr:
            mag = thr + ((mag - thr) / rat)
        out.append(clamp(sign * mag * float(makeup)))
    return out

def _presence(samples, amount=0.06):
    src = _as_list(samples)
    if not src or amount <= 0.0:
        return src
    smooth = _moving_average(src, radius=3)
    out = []
    for dry, sm in zip(src, smooth):
        edge = dry - sm
        out.append(clamp(dry + (edge * amount)))
    return out

def _air(samples, amount=0.03):
    src = _as_list(samples)
    if not src or amount <= 0.0:
        return src
    wide = _moving_average(src, radius=10)
    out = []
    for dry, sm in zip(src, wide):
        out.append(clamp((dry * (1.0 + amount * 0.18)) - (sm * amount * 0.18)))
    return out

def ensure_audible(samples, fallback_freq=220.0, sample_rate=DEFAULT_SAMPLE_RATE):
    src = _as_list(samples)
    if _is_effectively_silent(src):
        return _audible_fallback(freq=float(fallback_freq), sample_rate=sample_rate)
    return src

def mix_song(instrumental, vocals, drums=None, sample_rate=DEFAULT_SAMPLE_RATE, vocal_fx=None, instrumental_gain=0.96, drum_gain=0.58):
    instrumental = ensure_audible(instrumental, fallback_freq=220.0, sample_rate=sample_rate) if instrumental else []
    vocals = ensure_audible(vocals, fallback_freq=330.0, sample_rate=sample_rate) if vocals else []
    drums = _as_list(drums)

    fx = dict(vocal_fx or {})
    if vocals:
        vocals = _presence(vocals, amount=float(fx.get('presence', 0.06)))
        vocals = _air(vocals, amount=float(fx.get('air', 0.03)))
        vocals = _double(vocals, shift=int(fx.get('double_shift', 22)), mix=float(fx.get('double', 0.08)))
        vocals = _delay(vocals, sample_rate=sample_rate, delay_ms=float(fx.get('delay_ms', 120)), mix=float(fx.get('delay_mix', 0.12)))
        vocals = _reverb(vocals, amount=float(fx.get('reverb', 0.12)))
        vocals = _soft_compress(vocals, threshold=0.70, ratio=2.1, makeup=float(fx.get('gain', 1.02)))

    if instrumental and vocals:
        instrumental = duck_instrumental(instrumental, vocals, floor=0.82, depth=0.16)

    mix = []
    if instrumental or vocals:
        mix = mix_tracks(instrumental, vocals, ga=float(instrumental_gain), gb=1.0)
    if drums:
        mix = mix_tracks(mix, drums, ga=1.0, gb=float(drum_gain))

    mix = ensure_audible(mix, fallback_freq=220.0, sample_rate=sample_rate)
    mix, gain = normalize(mix, ceiling=0.94, min_gain=1.0, max_gain=10.0)
    return {'samples': mix, 'gain': gain}
