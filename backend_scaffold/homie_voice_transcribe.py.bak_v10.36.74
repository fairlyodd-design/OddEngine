#!/usr/bin/env python3
"""OddEngine Homie Voice Bridge transcriber v10.36.45.

Uses faster-whisper when available, then openai-whisper as fallback.
Returns JSON only on stdout so Node can safely parse it.
"""
import importlib.util
import json
import os
import platform
import sys
import traceback

VERSION = "v10.36.45"


def emit(payload):
    payload.setdefault("service", "homie-voice-transcriber")
    payload.setdefault("version", VERSION)
    print(json.dumps(payload, ensure_ascii=False))


def has_module(name):
    return importlib.util.find_spec(name) is not None


def run_doctor():
    faster = has_module("faster_whisper")
    whisper = has_module("whisper")
    av = has_module("av")
    payload = {
        "ok": faster or whisper,
        "python": sys.executable,
        "pythonVersion": sys.version.split()[0],
        "platform": platform.platform(),
        "packages": {
            "faster_whisper": faster,
            "openai_whisper": whisper,
            "av": av,
        },
        "model": os.environ.get("HOMIE_WHISPER_MODEL", "tiny.en"),
    }
    if not payload["ok"]:
        payload["error"] = "No local STT package installed. Install faster-whisper or openai-whisper."
        payload["installHint"] = "Run INSTALL_HOMIE_VOICE_STT_DEPS_v10.36.45.bat from C:\\OddEngine."
    elif faster and not av:
        payload["ok"] = True
        payload["warning"] = "faster-whisper is present, but PyAV import was not detected. WebM decoding may fail; run the v10.36.45 installer."
    else:
        payload["detail"] = "STT import check passed. The first real transcription may still download the Whisper model."
    emit(payload)
    return 0 if payload.get("ok") else 2


def transcribe_with_faster_whisper(audio_path, model_name):
    from faster_whisper import WhisperModel
    compute_type = os.environ.get("HOMIE_WHISPER_COMPUTE", "int8")
    device = os.environ.get("HOMIE_WHISPER_DEVICE", "cpu")
    model = WhisperModel(model_name, device=device, compute_type=compute_type)
    segments, info = model.transcribe(audio_path, beam_size=1, vad_filter=True)
    text = " ".join((seg.text or "").strip() for seg in segments).strip()
    return {
        "ok": bool(text),
        "text": text,
        "model": f"faster-whisper:{model_name}",
        "detail": f"language={getattr(info, 'language', '')}; duration={getattr(info, 'duration', '')}",
    }


def transcribe_with_openai_whisper(audio_path, model_name):
    import whisper
    # openai-whisper model names do not include the .en suffix on some installs.
    openai_model = model_name.replace(".en", "")
    model = whisper.load_model(openai_model)
    result = model.transcribe(audio_path, fp16=False)
    text = str(result.get("text", "")).strip()
    return {
        "ok": bool(text),
        "text": text,
        "model": f"openai-whisper:{openai_model}",
        "detail": "openai-whisper fallback",
    }


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

    faster_error = ""
    try:
        result = transcribe_with_faster_whisper(audio_path, model_name)
        if not result.get("text"):
            result["ok"] = False
            result["error"] = "No speech transcript returned. Hold the mic for 2 seconds and speak clearly."
        emit(result)
        return 0
    except ModuleNotFoundError as exc:
        faster_error = f"faster-whisper missing: {exc}"
    except Exception as exc:
        faster_error = f"faster-whisper failed: {friendly_decode_hint(exc)}"

    try:
        result = transcribe_with_openai_whisper(audio_path, model_name)
        if not result.get("text"):
            result["ok"] = False
            result["error"] = "No speech transcript returned. Hold the mic for 2 seconds and speak clearly."
        result["detail"] = (result.get("detail", "") + "; " + faster_error).strip("; ")
        emit(result)
        return 0
    except ModuleNotFoundError:
        emit({
            "ok": False,
            "error": "No local STT package installed. Missing faster-whisper/openai-whisper.",
            "detail": faster_error,
            "installHint": "Run INSTALL_HOMIE_VOICE_STT_DEPS_v10.36.45.bat from C:\\OddEngine.",
        })
        return 2
    except Exception as exc:
        emit({
            "ok": False,
            "error": f"Local STT failed: {friendly_decode_hint(exc)}",
            "detail": faster_error,
            "trace": traceback.format_exc(limit=2),
        })
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
