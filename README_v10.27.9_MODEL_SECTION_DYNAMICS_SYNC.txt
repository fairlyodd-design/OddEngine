v10.27.9_ModelSectionDynamicsSyncPass

What changed
- Added one normalized section dynamics contract shared across procedural + model lanes.
- Added normalized motion mapping:
  low | rise | drive | explode | fall
  Backward-compatible aliases still accepted:
  lift->rise, glide/pulse->drive, resolve->fall
- Procedural engine now builds section metadata from the same contract used by model engines.
- MusicGen adapter now builds per-section prompts, generates per-section clips, and stitches them with crossfades.
- Bark adapter now builds per-section vocal phrasing/text behavior and stitches vocals with crossfades.
- Metadata now carries:
  sectionDynamics
  sectionTimings
  engineUsedPerSection
  contractVersion
- Bridge auto-normalizes stale saved config script paths back to local defaults.

Files touched
- backend_scaffold/music-provider-bridge.mjs
- backend_scaffold/music_engines/section_contract.py
- backend_scaffold/music_engines/musicgen_model_adapter.py
- backend_scaffold/music_engines/bark_song_adapter.py
- ui/src/lib/musicLab.ts
- ui/src/panels/MusicLab.tsx
- backend_scaffold/backend_scaffold_data/music_bridge/music_provider_config.json

Validation performed here
- Node syntax check passed for music-provider-bridge.mjs
- Python bytecode compile passed for:
  musicgen_model_adapter.py
  bark_song_adapter.py
  section_contract.py

Notes
- Existing UI controls still drive all lanes.
- Fallback chain remains model -> procedural -> stub.
- Local runtime success still depends on the user machine having the MusicGen/Bark runtime installed and reachable.
