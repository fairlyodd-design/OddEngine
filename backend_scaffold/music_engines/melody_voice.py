
import math

def clamp(value, lo=-1.0, hi=1.0):
    return max(lo, min(hi, float(value)))

MOTION_FREQ = {
    "low": (155.0, 185.0),
    "rise": (185.0, 255.0),
    "drive": (210.0, 290.0),
    "explode": (260.0, 360.0),
    "fall": (220.0, 170.0),
}


def _lerp(a, b, t):
    return a + (b - a) * t


def build_pitch_curve(section, sample_rate, total_samples, vocal_mode="hybrid", instrumental_samples=None):
    total_samples = max(1, int(total_samples or 1))
    motion = str((section or {}).get("motion") or "drive").lower()
    energy = float((section or {}).get("energy") or 0.5)
    density = float((section or {}).get("density") or 0.5)
    start_freq, end_freq = MOTION_FREQ.get(motion, MOTION_FREQ["drive"])
    # light contour following from instrumental envelope if available
    envelope = []
    if instrumental_samples:
        win = max(1, len(instrumental_samples) // 128)
        env = []
        for i in range(0, len(instrumental_samples), win):
            chunk = instrumental_samples[i:i+win]
            env.append(sum(abs(float(x)) for x in chunk) / max(1, len(chunk)))
        peak = max(env + [0.001])
        envelope = [e / peak for e in env]
    vibrato_hz = 0.8 if vocal_mode == 'spoken' else 2.5 if vocal_mode == 'hybrid' else 4.2
    vibrato_depth = 0.002 if vocal_mode == 'spoken' else 0.006 if vocal_mode == 'hybrid' else 0.012
    sweep = []
    for i in range(total_samples):
        t = i / max(1, total_samples - 1)
        base = _lerp(start_freq, end_freq, t)
        phrasing = 1.0 + math.sin(2 * math.pi * (0.5 + density * 1.4) * t) * 0.02
        vibrato = 1.0 + math.sin(2 * math.pi * vibrato_hz * (i / float(sample_rate))) * vibrato_depth * (0.35 + energy * 0.65)
        if envelope:
            env_idx = min(len(envelope) - 1, int(t * (len(envelope) - 1)))
            base *= 0.94 + envelope[env_idx] * 0.12
        sweep.append(base * phrasing * vibrato)
    return sweep


def apply_pitch_follow(samples, section, sample_rate, vocal_mode="hybrid", instrumental_samples=None):
    src = list(samples or [])
    if not src:
        return []
    curve = build_pitch_curve(section, sample_rate, len(src), vocal_mode=vocal_mode, instrumental_samples=instrumental_samples)
    base_freq = max(110.0, curve[0])
    phase = 0.0
    out = []
    energy = float((section or {}).get("energy") or 0.5)
    density = float((section or {}).get("density") or 0.5)
    air = 0.04 + energy * 0.08
    for i, x in enumerate(src):
        freq = curve[i]
        phase += 2 * math.pi * (freq / float(sample_rate))
        carrier = math.sin(phase)
        harmonic = math.sin(phase * 2.0) * (0.12 + density * 0.1)
        wet = x * (0.78 if vocal_mode == 'spoken' else 0.66 if vocal_mode == 'hybrid' else 0.52) + (carrier * air) + harmonic
        out.append(clamp(wet))
    return out


def section_fx_profile(section, vocal_mode="hybrid"):
    name = str((section or {}).get("name") or "verse").lower()
    energy = float((section or {}).get("energy") or 0.5)
    base = {
        'delay_ms': 70 if vocal_mode == 'spoken' else 120 if vocal_mode == 'hybrid' else 150,
        'delay_mix': 0.08 if vocal_mode == 'spoken' else 0.12 if vocal_mode == 'hybrid' else 0.16,
        'reverb': 0.08 if vocal_mode == 'spoken' else 0.14 if vocal_mode == 'hybrid' else 0.18,
        'double': 0.0,
        'double_shift': 16,
        'widen': 0.0,
        'gain': 0.92 + energy * 0.12,
    }
    if name == 'chorus':
        base.update({'delay_ms': 160, 'delay_mix': 0.18, 'reverb': 0.22, 'double': 0.16, 'double_shift': 28, 'widen': 0.12, 'gain': 1.08 + energy * 0.12})
    elif name == 'intro':
        base.update({'delay_ms': 90, 'delay_mix': 0.10, 'reverb': 0.16})
    elif name == 'outro':
        base.update({'delay_ms': 140, 'delay_mix': 0.12, 'reverb': 0.20, 'gain': 0.96})
    return base
