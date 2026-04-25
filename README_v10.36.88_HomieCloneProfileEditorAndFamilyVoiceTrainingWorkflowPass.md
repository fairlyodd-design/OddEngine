# v10.36.88_HomieCloneProfileEditorAndFamilyVoiceTrainingWorkflowPass

## Why

You asked for `v10.36.88_HomieCloneProfileEditorAndFamilyVoiceTrainingWorkflowPass`.

This pass adds:
- a simple clone profile editor
- family phrases editing/storage
- a family voice training workflow
- a training manifest path
- bridge shaping that blends profile + memories + family phrases

## What this pass does

Touches only:
- `backend_scaffold/homie-neural-voice-bridge.mjs`
- `backend_scaffold/homie_clone_profile.v1.json`
- `backend_scaffold/homie_clone_memory_bank.v1.json`
- `backend_scaffold/homie_clone_family_phrases.v1.json`
- `backend_scaffold/homie_clone_voice_training_manifest.v1.json`
- `backend_scaffold/homie_clone_profile_editor.v10.36.88.html`
- `backend_scaffold/homie_clone_voice_training_drop/*`
- root helper files
- pass scripts

Does not touch:
- Trading
- CardGODMode
- Writers Lounge UI
- layout system
- existing mic/STT bridge
- existing launcher

## New bridge endpoints

On `127.0.0.1:8776`:
- `GET /family-phrases`
- `POST /family-phrases`
- `GET /training-workflow`
- `POST /generate-training-manifest`

Still includes:
- `GET /health`
- `GET /doctor`
- `GET /clone-profile`
- `POST /clone-profile`
- `GET /memory-bank`
- `POST /ingest-memory`
- `POST /preview`
- `POST /speak`
- `POST /build-studio-pack`
- `GET /last-request`

## New helpers

- `RUN_HOMIE_NEURAL_VOICE_BRIDGE_v10.36.88.bat`
- `TEST_HOMIE_NEURAL_VOICE_BRIDGE_v10.36.88.ps1`
- `OPEN_HOMIE_CLONE_PROFILE_EDITOR_v10.36.88.bat`
- `GENERATE_HOMIE_FAMILY_VOICE_TRAINING_MANIFEST_v10.36.88.ps1`

## Honest status

This still does not pretend to be a perfect AI identity clone.

It is a grounded build step:
- profile editing
- family phrases
- memory shaping
- consent-first voice training manifest
- optional neural provider later if you set `HOMIE_NEURAL_TTS_ENDPOINT`

## Run from `C:\OddEngine`

```powershell
Expand-Archive -Force "$env:USERPROFILE\Downloads\v10.36.88_HomieCloneProfileEditorAndFamilyVoiceTrainingWorkflowPass.zip" C:\OddEngine

cd C:\OddEngine
powershell -ExecutionPolicy Bypass -File .\APPLY_v10.36.88_HomieCloneProfileEditorAndFamilyVoiceTrainingWorkflowPass.ps1
powershell -ExecutionPolicy Bypass -File .\CHECK_v10.36.88_HomieCloneProfileEditorAndFamilyVoiceTrainingWorkflowPass.ps1
```

## Start the bridge

```powershell
cd C:\OddEngine
.\RUN_HOMIE_NEURAL_VOICE_BRIDGE_v10.36.88.bat
```

## Open the editor

```powershell
cd C:\OddEngine
.\OPEN_HOMIE_CLONE_PROFILE_EDITOR_v10.36.88.bat
```

## Generate the voice training manifest

Put samples in:

`C:\OddEngine\backend_scaffold\homie_clone_voice_training_drop`

Then run:

```powershell
cd C:\OddEngine
powershell -ExecutionPolicy Bypass -File .\GENERATE_HOMIE_FAMILY_VOICE_TRAINING_MANIFEST_v10.36.88.ps1
```