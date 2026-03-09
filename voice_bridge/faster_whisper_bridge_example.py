"""
Starter scaffold for an OddEngine external/local voice bridge.

Requires:
    pip install fastapi uvicorn faster-whisper

Run:
    uvicorn faster_whisper_bridge_example:app --host 127.0.0.1 --port 8765
"""
from __future__ import annotations

import base64
import tempfile
from pathlib import Path

from fastapi import FastAPI
from pydantic import BaseModel
from faster_whisper import WhisperModel

app = FastAPI(title="OddEngine Voice Bridge")
model = WhisperModel("small.en", device="cpu", compute_type="int8")


class TranscribeRequest(BaseModel):
    audioBase64: str
    mimeType: str = "audio/webm"
    language: str = "en"
    source: str = "OddEngine Homie"


@app.get("/health")
def health():
    return {"status": "ready", "engine": "faster-whisper", "model": "small.en", "version": "local"}


@app.post("/transcribe")
def transcribe(payload: TranscribeRequest):
    raw = base64.b64decode(payload.audioBase64)
    suffix = ".webm" if "webm" in payload.mimeType else ".wav"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as handle:
        handle.write(raw)
        temp_path = Path(handle.name)
    try:
        segments, info = model.transcribe(str(temp_path), language=payload.language)
        text = " ".join(segment.text.strip() for segment in segments).strip()
        return {"text": text, "model": info.language or "small.en", "detail": "Transcribed locally via faster-whisper"}
    finally:
        try:
            temp_path.unlink(missing_ok=True)
        except Exception:
            pass
