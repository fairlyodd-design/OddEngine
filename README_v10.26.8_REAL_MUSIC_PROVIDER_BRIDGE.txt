v10.26.8_RealMusicProviderBridgePass

Added
- ui/src/lib/musicProviderBridge.ts
- backend_scaffold/music-provider-bridge.mjs
- backend_scaffold/RUN_MUSIC_PROVIDER_BRIDGE.bat

Updated
- ui/src/lib/musicPreview.ts
- ui/src/panels/MusicLab.tsx
- backend_scaffold/package.json
- ui/src/lib/version.ts

What this adds
- music provider bridge config in Music Lab
- local preset and provider probe
- queue render now prefers a real local/remote provider when enabled
- preserves current queue, preview, stems, cover art, and lyric video flow
- local wrapper endpoint on http://127.0.0.1:7010 by default

Important note
- this is a source drop-in pass
- the included local music provider bridge is a structured local wrapper that returns playable data URLs and media previews
- replace the wrapper internals with your actual local or remote music engine later without changing the UI flow
