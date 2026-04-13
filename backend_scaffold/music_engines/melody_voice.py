import math

def clamp(value, lo=-1.0, hi=1.0):
    return max(lo, min(hi, float(value)))

MOTION_FREQ = {
    "low": (150.0, 178.0),
    "rise": (178.0, 248.0),
    "drive": (205.0, 282.0),
    "explode": (255.0, 348.0),
    "fall": (218.0, 165.0),
}

SECTION_FORMANTS = {
    "intro": 0.94,
    "verse": 1.00,
    "chorus": 1.06,
    "outro": 0.97,
}

def _lerp(a, b, t):
    return a + (b - a) * t

def _moving_average(samples, radius=3):
    src = [float(x) for x in list(samples or [])]
    if not src or radius <= 0:
        return src
    out = []
    for i in range(len(src)):
        lo = max(0, i - radius)
        hi = min(len(src), i + radius + 1)
        chunk = src[lo:hi]
        out.append(sum(chunk) / max(1, len(chunk)))
    return out

def _envelope(samples, buckets=128):
    src = [abs(float(x)) for x in list(samples or [])]
    if not src:
        return [0.0] * buckets
    win = max(1, len(src) // buckets)
    env = []
    for i in range(0, len(src), win):
        chunk = src[i:i+win]
        env.append(sum(chunk) / max(1, len(chunk)))
    peak = max(env + [0.001])
    norm = [e / peak for e in env]
    while len(norm) < buckets:
        norm.append(norm[-1] if norm else 0.0)
    return norm[:buckets]

def _section_name(section):
    return str((section or {}).get("name") or "verse").strip().lower()

def _contour_bias(section, vocal_mode="hybrid"):
    name = _section_name(section)
    energy = float((section or {}).get("energy") or 0.5)
    density = float((section or {}).get("density") or 0.5)
    if name == "intro":
        return 0.92 + (energy * 0.03)
    if name == "chorus":
        return 1.02 + (energy * 0.05) + (density * 0.02)
    if name == "outro":
        return 0.96 + (energy * 0.01)
    return 0.98 + (density * 0.02) + (0.01 if vocal_mode == "sing" else 0.0)

def build_pitch_curve(section, sample_rate, total_samples, vocal_mode="hybrid", instrumental_samples=None):
    total_samples = max(1, int(total_samples or 1))
    motion = str((section or {}).get("motion") or "drive").lower()
    energy = float((section or {}).get("energy") or 0.5)
    density = float((section or {}).get("density") or 0.5)
    name = _section_name(section)
    start_freq, end_freq = MOTION_FREQ.get(motion, MOTION_FREQ["drive"])
    envelope = _envelope(instrumental_samples, buckets=128) if instrumental_samples else [0.55] * 128

    if vocal_mode == 'spoken':
        vibrato_hz, vibrato_depth = 0.35, 0.0006
    elif vocal_mode == 'hybrid':
        vibrato_hz, vibrato_depth = 1.25, 0.0022
    else:
        vibrato_hz, vibrato_depth = 1.75, 0.0030

    if name == "chorus":
        vibrato_hz *= 0.88
        vibrato_depth *= 0.72
    elif name == "intro":
        vibrato_depth *= 0.55
    elif name == "outro":
        vibrato_hz *= 0.82
        vibrato_depth *= 0.65

    phrase_depth = 0.007 + density * 0.012
    contour_bias = _contour_bias(section, vocal_mode=vocal_mode)
    formant = SECTION_FORMANTS.get(name, 1.0)

    sweep = []
    for i in range(total_samples):
        t = i / max(1, total_samples - 1)
        base = _lerp(start_freq, end_freq, t)
        env_idx = min(len(envelope) - 1, int(t * (len(envelope) - 1)))
        env = envelope[env_idx]
        phrase = math.sin(2.0 * math.pi * (0.55 + energy * 0.28) * t) * phrase_depth
        vibrato = math.sin(2.0 * math.pi * vibrato_hz * t) * vibrato_depth
        lift = 1.0
        if name == "chorus":
            lift += 0.035 * math.sin(math.pi * t)
        elif name == "intro":
            lift -= 0.02 * (1.0 - t)
        elif name == "outro":
            lift -= 0.03 * t
        sweep.append(base * (1.0 + phrase + vibrato + ((env - 0.5) * 0.025)) * contour_bias * lift * formant)
    return sweep

def _resample_to_length(samples, total_samples):
    src = [float(x) for x in list(samples or [])]
    total_samples = max(1, int(total_samples or len(src) or 1))
    if not src:
        return [0.0] * total_samples
    if len(src) == total_samples:
        return src
    out = []
    scale = (len(src) - 1) / max(1, total_samples - 1)
    for i in range(total_samples):
        pos = i * scale
        lo = int(pos)
        hi = min(len(src) - 1, lo + 1)
        frac = pos - lo
        out.append((src[lo] * (1.0 - frac)) + (src[hi] * frac))
    return out

def _energy_envelope(section, total_samples):
    total_samples = max(1, int(total_samples or 1))
    name = _section_name(section)
    energy = float((section or {}).get("energy") or 0.5)
    env = []
    for i in range(total_samples):
        t = i / max(1, total_samples - 1)
        if name == "intro":
            amp = 0.72 + (0.16 * t) + (energy * 0.08)
        elif name == "chorus":
            amp = 0.95 + (math.sin(math.pi * t) * 0.08) + (energy * 0.06)
        elif name == "outro":
            amp = 0.94 - (0.18 * t)
        else:
            amp = 0.86 + (energy * 0.08)
        env.append(amp)
    return env

def apply_pitch_follow(samples, section, sample_rate, vocal_mode="hybrid", instrumental_samples=None):
    src = [float(x) for x in list(samples or [])]
    if not src:
        return src
    curve = build_pitch_curve(section, sample_rate, len(src), vocal_mode=vocal_mode, instrumental_samples=instrumental_samples)
    base_curve = _resample_to_length(curve, len(src))
    energy_env = _energy_envelope(section, len(src))
    out = []
    last = 0.0
    for i, sample in enumerate(src):
        t = i / max(1, len(src) - 1)
        mod = math.sin((2.0 * math.pi * base_curve[i] * t) / max(1.0, float(sample_rate)))
        blend = 0.10 if vocal_mode == "spoken" else 0.18 if vocal_mode == "hybrid" else 0.22
        followed = (sample * (1.0 - blend)) + ((sample + (sample * mod * 0.32)) * blend)
        smoothed = (followed * 0.76) + (last * 0.24)
        out.append(clamp(smoothed * energy_env[i]))
        last = out[-1]
    return _moving_average(out, radius=2 if vocal_mode == "spoken" else 3)

def _deharsh(samples, amount=0.12):
    src = [float(x) for x in list(samples or [])]
    if not src:
        return src
    slow = _moving_average(src, radius=8)
    out = []
    for a, b in zip(src, slow):
        diff = a - b
        out.append(clamp(b + (diff * (1.0 - amount))))
    return out

def polish_vocals(samples, section, sample_rate, vocal_mode="hybrid"):
    src = [float(x) for x in list(samples or [])]
    if not src:
        return src
    name = _section_name(section)
    density = float((section or {}).get("density") or 0.5)
    energy = float((section or {}).get("energy") or 0.5)

    radius = 3 if vocal_mode == "spoken" else 4 if vocal_mode == "hybrid" else 5
    smoothed = _moving_average(src, radius=radius)
    deharsh = _deharsh(smoothed, amount=0.10 + (0.05 if vocal_mode == "sing" else 0.0))

    out = []
    for i, sample in enumerate(deharsh):
        t = i / max(1, len(deharsh) - 1)
        phrase = 1.0
        if name == "chorus":
            phrase += (0.030 + density * 0.015) * math.sin(math.pi * t)
        elif name == "intro":
            phrase -= 0.015 * (1.0 - t)
        elif name == "outro":
            phrase -= 0.02 * t
        if vocal_mode == "sing":
            phrase += 0.01 * math.sin(2.0 * math.pi * 0.9 * t)
        out.append(clamp(sample * phrase * (0.98 + energy * 0.02)))
    return _moving_average(out, radius=2)

def section_fx_profile(section, vocal_mode="hybrid"):
    name = _section_name(section)
    energy = float((section or {}).get("energy") or 0.5)
    density = float((section or {}).get("density") or 0.5)
    base = {
        'delay_ms': 95 if vocal_mode == 'spoken' else 120 if vocal_mode == 'hybrid' else 136,
        'delay_mix': 0.08 if vocal_mode == 'spoken' else 0.12 if vocal_mode == 'hybrid' else 0.13,
        'reverb': 0.10 if vocal_mode == 'spoken' else 0.13 if vocal_mode == 'hybrid' else 0.15,
        'double': 0.03 if vocal_mode == 'spoken' else 0.06 if vocal_mode == 'hybrid' else 0.08,
        'double_shift': 18 if vocal_mode == 'spoken' else 21 if vocal_mode == 'hybrid' else 24,
        'widen': 0.04 if vocal_mode == 'spoken' else 0.07 if vocal_mode == 'hybrid' else 0.09,
        'gain': 0.99 + energy * 0.07,
        'presence': 0.04 + density * 0.05,
        'emotion': 0.05 + energy * 0.08,
        'air': 0.02 + (0.02 if name == 'chorus' else 0.0),
    }
    if name == 'chorus':
        base.update({
            'delay_ms': 148,
            'delay_mix': 0.15,
            'reverb': 0.19,
            'double': 0.14,
            'double_shift': 23,
            'widen': 0.11,
            'gain': 1.05 + energy * 0.11,
            'presence': 0.08 + density * 0.06,
            'emotion': 0.12 + energy * 0.10,
            'air': 0.05,
        })
    elif name == 'intro':
        base.update({'delay_ms': 82, 'delay_mix': 0.07, 'reverb': 0.12, 'double': 0.02, 'gain': 0.98})
    elif name == 'outro':
        base.update({'delay_ms': 118, 'delay_mix': 0.10, 'reverb': 0.16, 'gain': 0.97, 'widen': 0.06})
    return base
