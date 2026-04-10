OddEngine music engine adapters

This pass swaps the bridge internals from hardcoded wrapper behavior into an execution-adapter architecture.

Included sample:
- musicgen_adapter.py

What it does now:
- accepts a JSON request payload
- writes real local WAV files
- writes local SVG preview assets
- returns a response.json that the bridge normalizes back into the Music Lab UI

How to point the bridge at a real local model later:
1. Replace the internals of musicgen_adapter.py with your actual model/runtime call.
2. Keep the same request.json -> response.json contract.
3. Leave the Music Lab UI untouched.

Expected response fields:
- audioPath OR audioUrl
- stems.vocals / stems.instrumental / stems.drums OR corresponding *Url
- coverArtPath OR coverArtUrl
- lyricVideoPath OR lyricVideoUrl
- waveform (optional)


## Engine swap scaffolds
- `musicgen_model_adapter.py` is the future local MusicGen hook.
- `bark_song_adapter.py` is the future Bark / vocal synthesis hook.
- Both return the same JSON contract as `musicgen_adapter.py` once implemented, so the UI and bridge flow do not need to change.
