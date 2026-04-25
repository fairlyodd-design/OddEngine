# v10.36.70_HomieVoiceBridgeDirectBrowserFallbackPass

## Why

Your bridge is running on `127.0.0.1:8765`, but the UI is currently running in browser/Vite mode at `127.0.0.1:5173`.

Before this pass, Homie mostly relied on the desktop `window.__ODD__` bridge API. In browser mode that API can return "Not available in browser", even though the local HTTP bridge is actually alive.

## What this adds

- Direct browser fetch fallback to:
  - `GET http://127.0.0.1:8765/health`
  - `POST http://127.0.0.1:8765/transcribe`
- Keeps Electron/desktop bridge path when available
- Adds a `Use local bridge` button in Voice diagnostics
- Removes the desktop-only block for local transcription
- Does not touch Trading, CardGODMode, Writers Lounge, backend, or layout system

## Run from `C:\OddEngine`

```powershell
powershell -ExecutionPolicy Bypass -File .\APPLY_v10.36.70_HomieVoiceBridgeDirectBrowserFallbackPass.ps1
powershell -ExecutionPolicy Bypass -File .\CHECK_v10.36.70_HomieVoiceBridgeDirectBrowserFallbackPass.ps1

cd ui
npm run typecheck
npm run build
npm run dev
```

## Test

1. Keep this running in a separate PowerShell:
   `.\RUN_HOMIE_VOICE_BRIDGE_v10.36.45.bat`
2. Open Homie.
3. Voice → Show details.
4. Click `Use local bridge`.
5. Click `Probe bridge`.
6. It should say direct/browser bridge ready.
7. Click `Start listening` or `Hold to talk`.
8. Speak one short sentence and wait for the first Whisper model load if needed.