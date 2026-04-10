v10.26.7_RealAudioEnginePass

What changed
- upgraded ui/src/lib/musicPreview.ts
- upgraded ui/src/panels/MusicLab.tsx
- updated version.ts to 10.26.7

What this adds
- actual music render queue cards
- auto-loaded audio preview player
- waveform visualization
- stems:
  - vocals
  - instrumental
  - drums
- cover art preview
- lyric video preview lane

Important note
- this is a local-first UI/runtime simulation pass using generated WAV data URLs and SVG previews
- it behaves like a real audio engine inside the panel flow, but is not yet using an external synthesis model
- source drop-in only
