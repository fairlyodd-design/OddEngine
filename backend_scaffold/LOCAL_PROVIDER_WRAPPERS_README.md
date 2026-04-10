# OddEngine Local Provider Wrappers

This pass adds ready-made local wrapper servers for:
- Bark / TTS
- ComfyUI workflows

## Start them
- `node bark-wrapper.mjs`
- `node comfyui-wrapper.mjs`

Or on Windows:
- `RUN_BARK_WRAPPER.bat`
- `RUN_COMFYUI_WRAPPER.bat`
- `RUN_LOCAL_MEDIA_STACK.bat`

## Default ports
- Bark wrapper: `http://127.0.0.1:7000`
- ComfyUI wrapper: `http://127.0.0.1:8188`
- Render backend: `http://127.0.0.1:8899`

## Endpoints

### Bark wrapper
- `GET /health`
- `POST /generate`

### ComfyUI wrapper
- `GET /health`
- `GET /system_stats`
- `POST /generate`

## Important note
These wrappers are **ready-made bridge servers** so Render Lab can talk to local endpoints immediately.
They currently return structured stub artifacts by default.
To get true final media:
- replace Bark stub generation with a real Bark runtime call
- replace ComfyUI stub generation with real prompt/workflow queue submission to a local ComfyUI server

They are designed so you can swap the inner generation logic later without changing OddEngine’s panel flow.
