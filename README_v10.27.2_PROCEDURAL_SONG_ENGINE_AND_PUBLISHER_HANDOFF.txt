v10.27.2_ProceduralSongEngineAndPublisherHandoffPass

What changed
- upgraded musicgen_adapter.py from simple tones to a local procedural full-song generator
- bridge now defaults to python-adapter mode so the local bridge produces layered arranged WAV output by default
- stub fallback upgraded from single-tone beeps to a musical arranged local procedural song with real stems
- waveform rendering upgraded in the Music Lab UI with a dedicated waveform component
- final releases can now be queued directly into Publisher Hub
- final release card in Music Lab is draggable and Publisher Hub has a drop target for it
- release payload is persisted locally so Publisher Hub can queue the latest merged release even without drag-drop

Important honesty note
- this pass generates actual arranged music locally with sections, stems, and a fuller mix
- it is still NOT a true lyrics-singing foundation model like Suno, Udio, Bark singing, or full MusicGen melody/vocal conditioning
- it is, however, a big jump from single-tone placeholders and keeps the architecture ready for a real engine swap next

Files touched
- backend_scaffold/music-provider-bridge.mjs
- backend_scaffold/music_engines/musicgen_adapter.py
- ui/src/lib/musicProviderBridge.ts
- ui/src/lib/musicPreview.ts
- ui/src/lib/musicRelease.ts
- ui/src/components/MusicWaveform.tsx
- ui/src/panels/MusicLab.tsx
- ui/src/panels/PublisherHub.tsx
- ui/src/styles.css

Verified in this environment
- /generate returns a procedural-song-adapter result with waveform + stems
- /final-release/merge creates a real release folder with track + stems + metadata + assets
- /debug/files surfaces outputs and final releases

Prepared next
- real audio engine swap layer for MusicGen / Bark / external APIs
- richer waveform playback sync
- deeper Publisher Hub ingest for release metadata and drag-drop asset routing
