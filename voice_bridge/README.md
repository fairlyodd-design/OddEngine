# OddEngine External / Local Voice Bridge

OddEngine v10.17.5 explores a **safe local voice path** through an external HTTP bridge instead of Chromium's experimental on-device speech APIs.

## Expected bridge contract

### Health check
- `GET /health`
- Response JSON example:
```json
{
  "status": "ready",
  "engine": "faster-whisper",
  "model": "small.en",
  "version": "local"
}
```

### Transcribe
- `POST /transcribe`
- JSON body:
```json
{
  "audioBase64": "...",
  "mimeType": "audio/webm;codecs=opus",
  "language": "en",
  "source": "OddEngine Homie"
}
```
- Response JSON example:
```json
{
  "text": "open trading",
  "model": "small.en",
  "detail": "Transcribed locally via faster-whisper"
}
```

## Default bridge URL

OddEngine defaults to:
- `http://127.0.0.1:8765`

You can change that in:
- Preferences → AI Assistants → External/local bridge URL


## Windows quick start

If you want the quickest manual path on Windows, this folder now includes:
- `RUN_WINDOWS_BRIDGE.bat`
- `RUN_WINDOWS_BRIDGE_POWERSHELL.bat`
- `requirements.txt`

You can also launch the bridge from OddEngine Preferences in the guided setup assistant.

## Included example

See `faster_whisper_bridge_example.py` for a starter server scaffold.
It is **not bundled as a production dependency**. You can run your own local server, point OddEngine to it, and keep voice fully under your control.
