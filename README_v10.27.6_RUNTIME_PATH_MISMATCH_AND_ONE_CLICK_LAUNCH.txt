v10.27.6_RuntimePathMismatchAndOneClickLaunchPass

What changed:
- Windows music runtime installer now prefers .venv and falls back to legacy music_runtime_env.
- Installer now prefers Python 3.12, then py -3, then python.
- TEST_WINDOWS_MUSIC_RUNTIME.bat now checks both .venv and legacy env paths.
- RUN_MUSIC_PROVIDER_BRIDGE_RUNTIME.bat now checks both env paths and pauses on exit.
- Added ONE_CLICK_MUSIC_RUNTIME_AND_BRIDGE.bat and .ps1.

Use this one-click file on Windows:
backend_scaffold\ONE_CLICK_MUSIC_RUNTIME_AND_BRIDGE.bat

What it does:
1. Creates or reuses the runtime env
2. Installs/updates requirements
3. Probes MusicGen and Bark adapters
4. Launches the bridge with the right MUSIC_PYTHON path

Notes:
- music-provider-bridge.mjs must be run with Node, not Python.
- This pass only touches the music runtime helper scripts and does not touch Trading, CardGODMode, or unrelated Studio flows.
