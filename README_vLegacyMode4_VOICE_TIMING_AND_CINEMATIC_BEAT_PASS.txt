vLegacyMode.4_VoiceTimingAndCinematicBeatPass

What this pass does
- ties scene timing to narration length more naturally
- assigns scene beats to narration lines instead of fixed card timing
- improves emotional rhythm with longer holds on title/outro and weighted family lines
- adds subtle fade-in/fade-out per beat for cleaner pacing
- writes a timing manifest so each segment has start/end/duration metadata

Main changes
- backend_scaffold/legacy-video-runtime.mjs
- backend_scaffold/render-backend.mjs
- ui/src/panels/Books.tsx
- ui/src/panels/RenderLab.tsx
- ui/src/lib/brain.ts
- ui/src/App.tsx

How to use
1. unzip over your current OddEngine root
2. overwrite existing files
3. run RUN_RENDER_BACKEND_LEGACY_MODE.bat
4. open Writers Lounge
5. enable Legacy Mode video lane if needed
6. leave Family narration on for timing-aware pacing
7. send to Legacy Mode / Render Lab
8. after completion open the scene plan JSON and summary to inspect beat timing

Truth
This is still the honest local legacy video lane. It uses styled scene cards and local narration, but the rhythm is now driven by the voice instead of a fixed-duration slideshow.
