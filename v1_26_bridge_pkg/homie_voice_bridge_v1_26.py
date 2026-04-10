from __future__ import annotations

import base64
import os
import tempfile
import threading
import time
from pathlib import Path
from typing import Any

import requests
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title='Homie Voice Bridge v1.26')

MODEL_NAME = os.environ.get('HOMIE_WHISPER_MODEL', 'small.en')
OLLAMA_URL = os.environ.get('HOMIE_OLLAMA_URL', 'http://127.0.0.1:11434')
OLLAMA_MODEL = os.environ.get('HOMIE_OLLAMA_MODEL', 'llama3.1:8b')
ENABLE_TTS = os.environ.get('HOMIE_ENABLE_TTS', '1') not in {'0', 'false', 'False'}

_whisper_model = None
_whisper_error: str | None = None
_tts_engine = None
_tts_error: str | None = None
_last_tts_text = ''
_last_tts_at = 0.0


class TranscribeRequest(BaseModel):
    audioBase64: str
    mimeType: str = 'audio/webm;codecs=opus'
    language: str = 'en'
    source: str = 'Homie'


class ReplyRequest(BaseModel):
    text: str
    systemPrompt: str | None = None
    source: str = 'Homie'
    speak: bool = False


class SpeakRequest(BaseModel):
    text: str


DEFAULT_SYSTEM_PROMPT = (
    'You are Homie, a warm, grounded, practical AI companion. '
    'Reply conversationally in plain English. Keep answers helpful, natural, '
    'and not too long. Do not claim to have done things you did not actually do.'
)


def get_whisper_model():
    global _whisper_model, _whisper_error
    if _whisper_model is not None:
        return _whisper_model
    try:
        from faster_whisper import WhisperModel

        _whisper_model = WhisperModel(MODEL_NAME, device='cpu', compute_type='int8')
        _whisper_error = None
        return _whisper_model
    except Exception as exc:  # pragma: no cover
        _whisper_error = f'{type(exc).__name__}: {exc}'
        raise


def get_tts_engine():
    global _tts_engine, _tts_error
    if not ENABLE_TTS:
        raise RuntimeError('TTS disabled by HOMIE_ENABLE_TTS=0')
    if _tts_engine is not None:
        return _tts_engine
    try:
        import pyttsx3

        engine = pyttsx3.init()
        try:
            rate = engine.getProperty('rate')
            engine.setProperty('rate', int(rate * 0.92))
        except Exception:
            pass
        _tts_engine = engine
        _tts_error = None
        return _tts_engine
    except Exception as exc:  # pragma: no cover
        _tts_error = f'{type(exc).__name__}: {exc}'
        raise


def speak_async(text: str) -> None:
    def worker():
        global _last_tts_text, _last_tts_at
        try:
            engine = get_tts_engine()
            _last_tts_text = text
            _last_tts_at = time.time()
            engine.stop()
            engine.say(text)
            engine.runAndWait()
        except Exception:
            pass

    thread = threading.Thread(target=worker, daemon=True)
    thread.start()


def call_ollama(user_text: str, system_prompt: str | None) -> str:
    prompt = system_prompt.strip() if system_prompt else DEFAULT_SYSTEM_PROMPT
    url = f"{OLLAMA_URL.rstrip('/')}/api/chat"
    payload: dict[str, Any] = {
        'model': OLLAMA_MODEL,
        'stream': False,
        'messages': [
            {'role': 'system', 'content': prompt},
            {'role': 'user', 'content': user_text},
        ],
    }
    response = requests.post(url, json=payload, timeout=120)
    response.raise_for_status()
    data = response.json()
    message = data.get('message') or {}
    content = (message.get('content') or '').strip()
    if not content:
        raise RuntimeError('Ollama returned an empty reply')
    return content


@app.get('/')
def root():
    return {
        'status': 'ready',
        'service': 'Homie Voice Bridge v1.26',
        'routes': ['/health', '/status', '/ready', '/transcribe', '/reply', '/speak'],
    }


@app.get('/health')
@app.get('/status')
@app.get('/ready')
def health():
    ollama_ok = False
    ollama_error = None
    try:
        response = requests.get(f"{OLLAMA_URL.rstrip('/')}/api/tags", timeout=5)
        response.raise_for_status()
        ollama_ok = True
    except Exception as exc:
        ollama_error = f'{type(exc).__name__}: {exc}'

    whisper_ok = True
    try:
        get_whisper_model()
    except Exception:
        whisper_ok = False

    tts_ok = True
    if ENABLE_TTS:
        try:
            get_tts_engine()
        except Exception:
            tts_ok = False
    else:
        tts_ok = False

    return {
        'status': 'ready' if whisper_ok else 'degraded',
        'engine': 'faster-whisper',
        'model': MODEL_NAME,
        'version': 'v1.26',
        'ollama': {
            'url': OLLAMA_URL,
            'model': OLLAMA_MODEL,
            'reachable': ollama_ok,
            'error': ollama_error,
        },
        'tts': {
            'enabled': ENABLE_TTS,
            'ready': tts_ok,
            'error': _tts_error,
            'lastText': _last_tts_text,
            'lastAt': _last_tts_at,
        },
        'whisper': {
            'ready': whisper_ok,
            'error': _whisper_error,
        },
    }


@app.post('/transcribe')
def transcribe(payload: TranscribeRequest):
    try:
        model = get_whisper_model()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f'Whisper failed to load: {exc}') from exc

    raw = base64.b64decode(payload.audioBase64)
    mime = payload.mimeType.lower()
    suffix = '.webm' if 'webm' in mime else '.wav' if 'wav' in mime else '.bin'

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as handle:
        handle.write(raw)
        temp_path = Path(handle.name)

    try:
        segments, info = model.transcribe(str(temp_path), language=payload.language)
        text = ' '.join(segment.text.strip() for segment in segments).strip()
        return {
            'text': text,
            'model': MODEL_NAME,
            'language': getattr(info, 'language', payload.language),
            'detail': 'Transcribed locally via faster-whisper',
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f'Transcription failed: {exc}') from exc
    finally:
        try:
            temp_path.unlink(missing_ok=True)
        except Exception:
            pass


@app.post('/reply')
def reply(payload: ReplyRequest):
    try:
        answer = call_ollama(payload.text, payload.systemPrompt)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f'Reply generation failed: {exc}') from exc

    if payload.speak and answer:
        speak_async(answer)

    return {
        'reply': answer,
        'model': OLLAMA_MODEL,
        'detail': 'Reply generated through local Ollama',
        'spoke': bool(payload.speak and answer),
    }


@app.post('/speak')
def speak(payload: SpeakRequest):
    if not payload.text.strip():
        raise HTTPException(status_code=400, detail='Text is required')
    try:
        speak_async(payload.text.strip())
        return {'status': 'speaking', 'detail': 'TTS started', 'text': payload.text.strip()}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f'TTS failed: {exc}') from exc
