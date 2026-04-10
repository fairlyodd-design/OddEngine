v10.27.0b_MusicExportDebugAndFixPass

What changed
- music-provider-bridge now exposes:
  - GET /debug/files
- stub runs also write response.json into each output folder
- default adapter path no longer duplicates backend_scaffold
- Music Lab buttons now show visible status messages
- Inspect latest render source falls back to debug info when no run is found
- Download Final Release now shows success/failure feedback in-panel

Why this pass exists
- to fix the exact case where buttons looked like they were doing nothing
- to make backend file/debug state visible from the UI
