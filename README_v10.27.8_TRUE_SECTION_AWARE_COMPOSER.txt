v10.27.8_TrueSectionAwareComposerPass

What changed
- upgraded local procedural music adapter to accept sectionDynamics per section
- intro / verse / chorus / outro now affect more than length:
  - energy
  - melody density
  - drum intensity
  - motion / arrangement behavior
- section-aware profiles now flow through Music Lab UI, smoke test, and render queue payloads
- arrangement text now records section dynamic settings for downstream provider swaps
- smoke test card now shows whether section-aware dynamics were returned by the backend

Default section behavior
- intro: lower density, lighter drums, lift motion
- verse: balanced groove, glide motion
- chorus: high density, stronger drums, explode motion
- outro: lower density, reduced drums, resolve motion

Notes
- kept architecture modular: payload-driven, bridge-compatible, adapter-safe
- no Trading panel changes
- no CardGODMode changes
- no fake success states added

Verified here
- Python adapter compiles cleanly
- sample adapter run produced:
  - main.wav
  - vocals.wav
  - instrumental.wav
  - drums.wav
  - cover-art.svg
  - lyric-video.svg
- adapter output metadata now includes sectionDynamics and per-section profile details

Best next move
- make the true model-backed adapters interpret sectionDynamics too, so MusicGen/Bark lanes respond to the same intro/verse/chorus/outro behavior contract
