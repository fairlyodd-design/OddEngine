v10.27.0_ArtifactMergeAndExportPass

Updated
- backend_scaffold/music-provider-bridge.mjs
- ui/src/panels/MusicLab.tsx
- ui/src/lib/version.ts

What changed
- stub and adapter runs now write actual output files into backend_scaffold_data/music_bridge/outputs/<run>/
- bridge stores latest_run.json for export handoff
- new backend endpoints:
  - GET /final-release/latest
  - POST /final-release/merge
- Music Lab now has:
  - Inspect latest render source
  - Download Final Release
- final release merge packs:
  - track.wav
  - stems_vocals.wav
  - stems_instrumental.wav
  - stems_drums.wav
  - cover-art.svg
  - lyric-video.svg
  - metadata.json
  - social-caption.txt
  - release-checklist.md

Important note
- source drop-in only
- this pass merges generated artifacts into a final packaged release folder on the backend side
