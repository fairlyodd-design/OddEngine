# v10.36.75_HomieSTTAudioCleanupNormalizeAndAccuracyLaunchersPass

Improves Homie local STT by cleaning audio before Whisper.

## Run

```powershell
Expand-Archive -Force "$env:USERPROFILE\Downloads\v10.36.75_HomieSTTAudioCleanupNormalizeAndAccuracyLaunchersPass.zip" C:\OddEngine
cd C:\OddEngine
powershell -ExecutionPolicy Bypass -File .\APPLY_v10.36.75_HomieSTTAudioCleanupNormalizeAndAccuracyLaunchersPass.ps1
powershell -ExecutionPolicy Bypass -File .\CHECK_v10.36.75_HomieSTTAudioCleanupNormalizeAndAccuracyLaunchersPass.ps1
```

Stop old bridge with Ctrl+C, then:

```powershell
.\RUN_HOMIE_VOICE_BRIDGE_AUDIO_CLEANUP_v10.36.75.bat
```

If still wrong:

```powershell
.\RUN_HOMIE_VOICE_BRIDGE_AUDIO_CLEANUP_MAX_v10.36.75.bat
```
