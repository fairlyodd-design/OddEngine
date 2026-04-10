v10.27.9b Real Model Execution Fix

This hotfix preserves the real MusicGen/Bark section-aware execution code and fixes package imports after moving shared helpers into backend_scaffold/music_engines.

Changes:
- musicgen_model_adapter.py: from .section_contract import ...
- bark_song_adapter.py: from .section_contract import ...
- added music_engines/__init__.py

Apply by copying backend_scaffold/music_engines into your OddEngine install and replacing files.
