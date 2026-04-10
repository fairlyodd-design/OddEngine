v10.27.4_MusicGenRuntimeAndBarkOverlayPass

What this pass adds
- musicgen_model_adapter.py now probes for and uses a real local MusicGen runtime when installed.
  - first choice: audiocraft MusicGen
  - second choice: transformers MusicGen path
- bark_song_adapter.py now probes for and uses a real local Bark runtime when installed.
  - first choice: native bark package
  - second choice: transformers Bark path
- music-provider-bridge.mjs now probes those runtimes directly instead of relying on static env flags.
- when MusicGen is selected and Bark is available, the bridge automatically tries a Bark vocal/spoken texture overlay on top of the generated instrumental.
- if local model runtimes are missing, the pipeline still falls back cleanly instead of pretending success.

Local runtime notes
- Recommended MusicGen setup: audiocraft + torch with a working local model cache.
- Recommended Bark setup: bark (or transformers Bark) + torch.
- Optional environment variables:
  - MUSICGEN_MODEL_NAME
  - BARK_MODEL_NAME
- No UI flow changes were required. Music Lab keeps the same render/preview/release flow.

Honest note
- This pass wires the adapters to real local runtimes, but the actual model packages and weights still need to be installed on the Windows machine running OddEngine.
- In an environment without those runtimes, the bridge will report them as unavailable and use the fallback path rather than faking a model-backed render.
