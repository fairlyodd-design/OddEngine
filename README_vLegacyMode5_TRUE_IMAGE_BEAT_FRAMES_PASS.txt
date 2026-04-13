vLegacyMode.5_TrueImageBeatFramesPass

What this pass does
- replaces plain beat cards with generated per-beat image frames
- keeps voice-timed pacing from the narration pass
- writes frame PNGs for every beat under video/frames/
- assembles the final legacy video from those timed frames
- keeps narration mux + poster + summary + captions + scene plan

Key result
The legacy lane now produces a real image-sequence video instead of a plain text-card sequence.

Changed files
- ui/src/panels/Books.tsx
- ui/src/panels/RenderLab.tsx
- backend_scaffold/render-backend.mjs
- backend_scaffold/legacy-video-runtime.mjs
- README_vLegacyMode5_TRUE_IMAGE_BEAT_FRAMES_PASS.txt

Install
- unzip over your current OddEngine root
- overwrite existing files
- run RUN_RENDER_BACKEND_LEGACY_MODE.bat
- open Writers Lounge
- use Legacy Mode ▶ Real Video
- open Render Lab to inspect the finished release and frame outputs

Notes
- this is still the honest local legacy lane
- the generated beat visuals are procedural image frames driven by the same narration-timed beat plan
- no fake photoreal claims: this is a stable local visual-memory sequence pipeline
