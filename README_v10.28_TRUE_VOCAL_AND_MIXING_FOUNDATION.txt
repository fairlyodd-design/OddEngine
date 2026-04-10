v10.28_TrueVocalAndMixingFoundationPass

What changed
- fixed music_engines package imports for direct script execution and package imports
- added lyrics_generator.py for auto per-section lyric text
- added mix_engine.py for simple vocal/instrumental/drum mixing + normalization
- Bark lane now honors enableVocals, auto-generates lyrics when missing, generates per-section vocal text, and mixes vocals with instrumental/drums
- MusicGen lane now preserves stylePreset + enableVocals metadata
- shared section contract now includes style presets: default / lofi / cinematic / trap / edm
- Music Lab UI now exposes Enable vocals toggle + Style preset dropdown
- added START_ODDENGINE_ALL.bat at repo root

Validation done in container
- python compile check on music_engines package
- quick text patch validation for UI TypeScript files

What was not fully proven here
- full local MusicGen/Bark inference on your Windows box, because model runtimes are machine-local
