# v10.26.15m5a Homie Text Stability And Bridge Starter Hotfix

What this pass does:
- calms Homie text jitter by only auto-scrolling on new messages
- adds stable text/scroll classes for Homie chat lanes
- bumps version to 10.26.15m5a
- includes a ready-to-run local faster-whisper bridge under `/voice_bridge`

Windows quick start:
1. Open `voice_bridge`
2. Run `RUN_WINDOWS_BRIDGE.bat`
3. Verify `http://127.0.0.1:8765/health`
4. In OddEngine, use external/local voice bridge URL `http://127.0.0.1:8765`
