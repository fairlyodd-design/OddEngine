v10.28.1c_AudioIntegrityAndTrueOutputFix

What this fixes:
- silent-but-not-empty WAV output
- over-ducked/under-amplified vocal/instrumental merges
- near-zero model arrays passing through as 'successful' renders
- unsafe WAV writing for effectively silent buffers

Updated files:
- backend_scaffold/music_engines/mix_engine.py
- backend_scaffold/music_engines/musicgen_model_adapter.py
- backend_scaffold/music_engines/bark_song_adapter.py

Behavior:
- any effectively silent render now gets forced audible fallback content
- mix normalization is stronger and safer
- section clips are validated before stitch/merge
- final merged output is validated before WAV write
