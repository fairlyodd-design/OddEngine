# v10.36.45 Homie Voice Bridge Transcription Doctor And STT Fix Pass

This pass fixes the next layer after `/health` works: local STT transcription diagnostics.

## Adds

- `/doctor` endpoint on the Homie voice bridge
- `/last-error` endpoint for the last transcription failure
- stronger Python STT doctor mode
- improved installer for `faster-whisper`, `av`, `ctranslate2`, and `numpy`
- v10.36.45 startup and standalone bridge launchers

## Run

```powershell
.\APPLY_v10.36.45_HomieVoiceBridgeTranscriptionDoctorAndSTTFixPass.bat
.\RUN_v10.36.45_HOMIE_VOICE_TRANSCRIPTION_DOCTOR_CHECK.bat
```

If doctor reports missing packages:

```powershell
.\INSTALL_HOMIE_VOICE_STT_DEPS_v10.36.45.bat
```

Then restart:

```powershell
.\START_ODDENGINE_ALL_v10.36.45.bat
```
