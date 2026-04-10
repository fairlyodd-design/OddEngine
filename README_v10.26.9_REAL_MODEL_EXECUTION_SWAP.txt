v10.26.9_RealModelExecutionSwapPass

Added
- backend_scaffold/music_engines/musicgen_adapter.py
- backend_scaffold/music_engines/README.md
- backend_scaffold/RUN_MUSIC_PROVIDER_BRIDGE_REAL.bat
- backend_scaffold/backend_scaffold_data/music_bridge/sample_request.json

Updated
- backend_scaffold/music-provider-bridge.mjs
- ui/src/lib/musicProviderBridge.ts
- ui/src/panels/MusicLab.tsx
- backend_scaffold/package.json
- ui/src/lib/version.ts

What changed
- replaced the bridge internals with an execution-adapter architecture
- bridge now supports:
  - stub
  - python-adapter
- included a sample local adapter that writes real WAV files plus SVG preview assets
- Music Lab UI and preview flow stay intact while the backend execution layer becomes swappable

Honest note
- this pass gives you a real execution contract and local file outputs
- the included adapter is a local sample engine, not a commercial-grade generative music model
- swap the inside of musicgen_adapter.py for your actual local model/runtime later without changing the front-end flow
