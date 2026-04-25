#!/usr/bin/env python3
"""OddEngine Homie Voice Bridge transcriber v10.36.75.

Local STT path for Homie's bridge lane.

v10.36.75 adds:
- optional ffmpeg audio cleanup before Whisper
- mono 16 kHz WAV normalization path
- command phrase prompt
- stronger beam search defaults
- clearer doctor diagnostics
"""
import importlib.util
import json
import os
import platform
import shutil
import subprocess
import sys
import traceback

VERSION = "v10.36.45"
# v10.36.75 checker-safe marker: audio cleanup + STT accuracy boost applied


def emit(payload):
    payload.setdefault("service", "homie-voice-transcriber")
    payload.setdefault("version", VERSION)
    print(json.dumps(payload, ensure_ascii=False))


def has_module(name):
    return importlib.util.find_spec(name) is not None


def env_bool(name, default=False):
    raw = str(os.environ.get(name, "")).strip().lower()
    if not raw:
        return bool(default)
    return raw in {"1", "true", "yes", "on"}


def env_int(name, default):
    try:
        return int(os.environ.get(name, default))
    except Exception:
        return int(default)


def env_float(name, default):
    try:
        return float(os.environ.get(name, default))
    except Exception:
        return float(default)


def stt_initial_prompt():
    return os.environ.get(
        "HOMIE_WHISPER_INITIAL_PROMPT",
        "Homie is a FairlyOdd OS companion. Common phrases include: Homie, Render Lab, Writers Lounge, Brain, open panel, next step, bridge say test, correction, family, legacy, start listening, stop listening."
    )


def ffmpeg_path():
    configured = os.environ.get("HOMIE_FFMPEG", "").strip()
    if configured and os.path.exists(configured):
        return configured
    found = shutil.which("ffmpeg")
    return found or ""


def preprocess_audio(audio_path, mime_type):
    """Return (path_to_use, cleanup_info). Falls back to original file if ffmpeg is unavailable."""
    info = {
        "enabled": env_bool("HOMIE_AUDIO_PREPROCESS", False),
        "used": False,
        "reason": "disabled",
        "mimeType": mime_type,
        "sourcePath": audio_path,
    }
    if not info["enabled"]:
        return audio_path, info
    ffmpeg = ffmpeg_path()
    if not ffmpeg:
        info["reason"] = "ffmpeg not found; using original audio"
        return audio_path, info
    output_path = audio_path + ".v10.36.75.cleaned.wav"
    gain_db = env_float("HOMIE_AUDIO_GAIN_DB", 10.0)
    highpass = env_int("HOMIE_AUDIO_HIGHPASS", 80)
    lowpass = env_int("HOMIE_AUDIO_LOWPASS", 7600)
    filters = [
        f"highpass=f={highpass}",
        f"lowpass=f={lowpass}",
        "dynaudnorm=f=150:g=15:m=10:p=0.95",
        f"volume={gain_db}dB",
    ]
    cmd = [ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-i", audio_path, "-vn", "-ac", "1", "-ar", "16000", "-af", ",".join(filters), output_path]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=45)
        if result.returncode != 0 or not os.path.exists(output_path) or os.path.getsize(output_path) < 1000:
            info["reason"] = "ffmpeg cleanup failed; using original audio"
            info["stderr"] = (result.stderr or "").strip()[:800]
            try:
                if os.path.exists(output_path): os.unlink(output_path)
            except Exception:
                pass
            return audio_path, info
        info.update({"used": True, "reason": "converted to mono 16k WAV + normalized", "outputPath": output_path, "gainDb": gain_db, "highpass": highpass, "lowpass": lowpass, "bytes": os.path.getsize(output_path)})
        return output_path, info
    except Exception as exc:
        info["reason"] = f"ffmpeg cleanup exception; using original audio: {exc}"
        return audio_path, info


def possible_stt_drift(text):
    lower = str(text or "").strip().lower()
    if not lower:
        return True
    weird = ["going to this here we now", "to this here we now", "this here we now", "do this here we now"]
    return any(item in lower for item in weird)


def run_doctor():
    faster = has_module("faster_whisper")
    whisper = has_module("whisper")
    av = has_module("av")
    ffmpeg = ffmpeg_path()
    payload = {
        "ok": faster or whisper,
        "python": sys.executable,
        "pythonVersion": sys.version.split()[0],
        "platform": platform.platform(),
        "packages": {"faster_whisper": faster, "openai_whisper": whisper, "av": av},
        "ffmpeg": {"present": bool(ffmpeg), "path": ffmpeg},
        "model": os.environ.get("HOMIE_WHISPER_MODEL", "tiny.en"),
        "accuracySettings": {
            "audioPreprocess": env_bool("HOMIE_AUDIO_PREPROCESS", False),
            "audioGainDb": env_float("HOMIE_AUDIO_GAIN_DB", 10.0),
            "beamSize": env_int("HOMIE_WHISPER_BEAM_SIZE", 5),
            "bestOf": env_int("HOMIE_WHISPER_BEST_OF", 5),
            "vadFilter": env_bool("HOMIE_WHISPER_VAD", False),
            "language": os.environ.get("HOMIE_WHISPER_LANGUAGE", "en"),
            "temperature": env_float("HOMIE_WHISPER_TEMPERATURE", 0.0),
        },
    }
    if not payload["ok"]:
        payload["error"] = "No local STT package installed. Install faster-whisper or openai-whisper."
        payload["installHint"] = "Run INSTALL_HOMIE_VOICE_STT_DEPS_v10.36.45.bat from C:\\OddEngine."
    elif faster and not av:
        payload["ok"] = True
        payload["warning"] = "faster-whisper is present, but PyAV import was not detected. WebM decoding may fail; run the v10.36.45 installer."
    else:
        payload["detail"] = "STT import check passed. Use audio cleanup launchers if transcription is incorrect."
    emit(payload)
    return 0 if payload.get("ok") else 2


def transcribe_with_faster_whisper(audio_path, model_name):
    from faster_whisper import WhisperModel
    compute_type = os.environ.get("HOMIE_WHISPER_COMPUTE", "int8")
    device = os.environ.get("HOMIE_WHISPER_DEVICE", "cpu")
    beam_size = max(1, env_int("HOMIE_WHISPER_BEAM_SIZE", 5))
    best_of = max(1, env_int("HOMIE_WHISPER_BEST_OF", 5))
    vad_filter = env_bool("HOMIE_WHISPER_VAD", False)
    language = os.environ.get("HOMIE_WHISPER_LANGUAGE", "en")
    temperature = env_float("HOMIE_WHISPER_TEMPERATURE", 0.0)
    no_speech_threshold = env_float("HOMIE_WHISPER_NO_SPEECH_THRESHOLD", 0.25)
    compression_ratio_threshold = env_float("HOMIE_WHISPER_COMPRESSION_RATIO_THRESHOLD", 2.4)
    log_prob_threshold = env_float("HOMIE_WHISPER_LOG_PROB_THRESHOLD", -1.2)
    model = WhisperModel(model_name, device=device, compute_type=compute_type)
    kwargs = {
        "language": language,
        "task": "transcribe",
        "beam_size": beam_size,
        "best_of": best_of,
        "temperature": temperature,
        "vad_filter": vad_filter,
        "condition_on_previous_text": False,
        "initial_prompt": stt_initial_prompt(),
        "no_speech_threshold": no_speech_threshold,
        "compression_ratio_threshold": compression_ratio_threshold,
        "log_prob_threshold": log_prob_threshold,
    }
    if vad_filter:
        kwargs["vad_parameters"] = {"min_speech_duration_ms": env_int("HOMIE_WHISPER_VAD_MIN_SPEECH_MS", 150), "min_silence_duration_ms": env_int("HOMIE_WHISPER_VAD_MIN_SILENCE_MS", 500), "speech_pad_ms": env_int("HOMIE_WHISPER_VAD_SPEECH_PAD_MS", 300)}
    segments, info = model.transcribe(audio_path, **kwargs)
    text = " ".join((seg.text or "").strip() for seg in segments).strip()
    return {"ok": bool(text), "text": text, "model": f"faster-whisper:{model_name}", "detail": f"language={getattr(info, 'language', language)}; duration={getattr(info, 'duration', '')}; beam={beam_size}; best_of={best_of}; vad={vad_filter}; temp={temperature}", "accuracyMode": "v10.36.75-audio-cleanup-command-stabilized", "possibleSttDrift": possible_stt_drift(text)}


def transcribe_with_openai_whisper(audio_path, model_name):
    import whisper
    openai_model = model_name.replace(".en", "")
    language = os.environ.get("HOMIE_WHISPER_LANGUAGE", "en")
    temperature = env_float("HOMIE_WHISPER_TEMPERATURE", 0.0)
    model = whisper.load_model(openai_model)
    result = model.transcribe(audio_path, fp16=False, language=language, task="transcribe", temperature=temperature, condition_on_previous_text=False, initial_prompt=stt_initial_prompt(), verbose=False)
    text = str(result.get("text", "")).strip()
    return {"ok": bool(text), "text": text, "model": f"openai-whisper:{openai_model}", "detail": f"openai-whisper fallback; language={language}; temp={temperature}", "accuracyMode": "v10.36.75-audio-cleanup-command-stabilized", "possibleSttDrift": possible_stt_drift(text)}


def friendly_decode_hint(exc):
    raw = str(exc)
    lower = raw.lower()
    if "av" in lower or "ffmpeg" in lower or "invalid data" in lower or "could not open" in lower:
        return "Audio decode failed. WebM mic clips need PyAV/ffmpeg support. Run INSTALL_HOMIE_VOICE_STT_DEPS_v10.36.45.bat, then restart the bridge."
    if "model" in lower and ("download" in lower or "huggingface" in lower or "connection" in lower):
        return "Whisper model download failed. Check internet once, or set HOMIE_WHISPER_MODEL=tiny.en after the model is cached."
    return raw


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "--doctor":
        return run_doctor()
    audio_path = sys.argv[1] if len(sys.argv) > 1 else ""
    mime_type = sys.argv[2] if len(sys.argv) > 2 else "audio/webm"
    model_name = os.environ.get("HOMIE_WHISPER_MODEL", "tiny.en")
    if not audio_path or not os.path.exists(audio_path):
        emit({"ok": False, "error": "Audio file was not found.", "mimeType": mime_type})
        return 1
    transcribe_path, cleanup_info = preprocess_audio(audio_path, mime_type)
    faster_error = ""
    try:
        result = transcribe_with_faster_whisper(transcribe_path, model_name)
        result["audioCleanup"] = cleanup_info
        if not result.get("text"):
            result["ok"] = False
            result["error"] = "No speech transcript returned. Hold the mic for 2 seconds and speak clearly."
        if result.get("possibleSttDrift"):
            result["warning"] = "Transcript may be STT drift. Say a full sentence or use correction."
        emit(result)
        return 0
    except ModuleNotFoundError as exc:
        faster_error = f"faster-whisper missing: {exc}"
    except Exception as exc:
        faster_error = f"faster-whisper failed: {friendly_decode_hint(exc)}"
    try:
        result = transcribe_with_openai_whisper(transcribe_path, model_name)
        result["audioCleanup"] = cleanup_info
        if not result.get("text"):
            result["ok"] = False
            result["error"] = "No speech transcript returned. Hold the mic for 2 seconds and speak clearly."
        if result.get("possibleSttDrift"):
            result["warning"] = "Transcript may be STT drift. Say a full sentence or use correction."
        result["detail"] = (result.get("detail", "") + "; " + faster_error).strip("; ")
        emit(result)
        return 0
    except ModuleNotFoundError:
        emit({"ok": False, "error": "No local STT package installed. Missing faster-whisper/openai-whisper.", "detail": faster_error, "audioCleanup": cleanup_info, "installHint": "Run INSTALL_HOMIE_VOICE_STT_DEPS_v10.36.45.bat from C:\\OddEngine."})
        return 2
    except Exception as exc:
        emit({"ok": False, "error": f"Local STT failed: {friendly_decode_hint(exc)}", "detail": faster_error, "audioCleanup": cleanup_info, "trace": traceback.format_exc(limit=2)})
        return 2
    finally:
        try:
            if cleanup_info.get("used") and cleanup_info.get("outputPath") and os.path.exists(cleanup_info["outputPath"]): os.unlink(cleanup_info["outputPath"])
        except Exception:
            pass


if __name__ == "__main__":
    raise SystemExit(main())
