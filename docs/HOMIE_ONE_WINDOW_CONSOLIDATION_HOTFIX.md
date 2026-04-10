# v10.26.3a — Homie one-window consolidation hotfix

What changed:
- Disabled launch actions for the old in-shell Homie popup.
- OddEngine now points users to the separate Homie Companion app as the only pop-out lane.
- Kept legacy popup preferences visible only as legacy labeling so older saved prefs do not break.

Why:
- Running both the old popup and the separate Homie Companion app was confusing and could feel glitchy.
- This hotfix keeps one clear Homie window: the separate Homie Companion app.

How to run:
1. Start `RUN_HOMIE_PAIR_DEV_WINDOWS.bat` for OddEngine + Homie together, or `RUN_HOMIE_COMPANION_DEV_WINDOWS.bat` for Homie alone.
2. In OddEngine Preferences, use the Homie Companion Bridge card to probe the companion.
3. Do not use the old in-shell popup lane.
