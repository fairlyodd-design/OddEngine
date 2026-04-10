v10.27.3 True Model Backed Engine Swap Pass

What changed
- Added bridge engine router with auto selection and fallback chain
- Added engine catalog endpoints: /config now returns selectedEngine + engines, and /engines lists availability
- Added support lanes for musicgen-cli, bark-cli, external-api-json, command-json, python-adapter, and stub
- Added Music Lab UI controls for engine swap without changing the prompt -> render -> release flow
- Added scaffolds for future musicgen_model_adapter.py and bark_song_adapter.py

Important
- Auto mode now prefers MusicGen, then Bark, then the local Python adapter, then stub
- If a requested engine is not installed or errors, the pipeline falls back cleanly and records the fallback in metadata
- The UI still uses the same buttons and flow; only the provider routing changed

Next
- Wire musicgen_model_adapter.py to a real local model
- Wire bark_song_adapter.py to vocal/melody generation
- Optionally connect external APIs like Suno-like services using external-api-json
