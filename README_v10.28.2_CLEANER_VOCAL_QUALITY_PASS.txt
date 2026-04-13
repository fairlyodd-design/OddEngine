v10.28.2_CleanerVocalQualityPass

What changed
- reduced robotic warble in melody-follow mode
- added post-pitch vocal polish smoothing
- gentler vibrato and phrase contouring
- less harsh vocal FX defaults
- safer mix ducking so the instrumental stays alive under vocals
- updated Bark metadata to report contractVersion v10.28.2

Files updated
- backend_scaffold/music_engines/melody_voice.py
- backend_scaffold/music_engines/mix_engine.py
- backend_scaffold/music_engines/bark_song_adapter.py

How to apply
1. Unzip into C:\OddEngine
2. Replace files
3. Start with START_ODDENGINE_ALL.bat
4. In Music Lab, use Enable Vocals = on and Vocal Mode = Hybrid or Sing

Recommended first test
- style preset: Cinematic or Trap
- prompt: dark emotional trap with a huge lifted chorus
- vocal mode: Hybrid first, then Sing for comparison
