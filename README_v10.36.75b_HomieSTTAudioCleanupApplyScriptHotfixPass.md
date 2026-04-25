# v10.36.75b_HomieSTTAudioCleanupApplyScriptHotfixPass

This hotfix repairs the v10.36.75 apply script path bug.

The earlier script accidentally embedded a backspace character in `files\backend_scaffold`, causing PowerShell to report:

`Test-Path : Illegal characters in path.`

## Run from C:\OddEngine

```powershell
Expand-Archive -Force "$env:USERPROFILE\Downloads\v10.36.75b_HomieSTTAudioCleanupApplyScriptHotfixPass.zip" C:\OddEngine

cd C:\OddEngine
powershell -ExecutionPolicy Bypass -File .\APPLY_v10.36.75b_HomieSTTAudioCleanupApplyScriptHotfixPass.ps1
powershell -ExecutionPolicy Bypass -File .\CHECK_v10.36.75b_HomieSTTAudioCleanupApplyScriptHotfixPass.ps1
```

Then stop the old bridge window with Ctrl+C and run:

```powershell
.\RUN_HOMIE_VOICE_BRIDGE_AUDIO_CLEANUP_v10.36.75.bat
```

If still inaccurate, run:

```powershell
.\RUN_HOMIE_VOICE_BRIDGE_AUDIO_CLEANUP_MAX_v10.36.75.bat
```
