v10.27.7_ModelSmokeTestAndFirstRealSongPass

What this pass adds:
- /smoke-test endpoint in music-provider-bridge.mjs
- automatic first-song generation + verification flow
- checks for:
  - main.wav exists
  - duration > 0
  - waveform array returned
  - stems exist
  - final release merge works
- basic song structure controls in Music Lab:
  - intro bars
  - verse bars
  - chorus bars
  - outro bars
- smoke-test results surfaced in UI
- smoke-test auto-queues latest release into Publisher Hub
- fixed optional audiocraft requirement typo:
  - omegaconf

Expected flow:
1. Launch ONE_CLICK_MUSIC_RUNTIME_AND_BRIDGE.bat
2. Open Music Lab
3. Click Smoke test + first real song
4. Review PASS/FAIL card
5. Inspect latest render source
6. Merge/Download Final Release
7. Queue in Publisher Hub

Notes:
- This pass keeps Trading, CardGODMode, and existing Studio flows untouched.
- Smoke test is honest: it reports fail reasons instead of pretending success.
- Structure controls currently influence the local arranged song fallback path and any bridge payload consumers that honor sectionBars.
