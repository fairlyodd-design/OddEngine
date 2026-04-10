v10.26.6_MusicLabSunoLikePass

Added
- ui/src/lib/musicLab.ts
- ui/src/panels/MusicLab.tsx

Updated
- ui/src/App.tsx
- ui/src/lib/brain.ts
- backend_scaffold/render-backend.mjs
- ui/src/lib/version.ts

What this adds
- new Music Lab panel inside Studio ecosystem
- prompt → lyrics → arrangement → render brief → publish pack
- music-specific handoff type for Render Lab
- song generation, vocal generation, and mastering lanes
- controls for:
  - genre
  - bpm
  - key
  - vibe
  - explicit/instrumental
  - vocal profile
  - chorus strength
  - song length
- actions:
  - Create song
  - Extend track
  - Make instrumental
  - Remaster
  - Generate alt versions
  - 1 Prompt → Ship It
- output bundle:
  - lyrics
  - song brief
  - cover brief
  - release metadata
  - short-form promo assets
  - distribution pack

Important note
- this is Suno-like in workflow and depth, but built as your own OddEngine implementation
- source drop-in only
- no Trading files touched
