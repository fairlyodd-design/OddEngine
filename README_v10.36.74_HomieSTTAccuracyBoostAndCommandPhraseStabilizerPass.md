# v10.36.74_HomieSTTAccuracyBoostAndCommandPhraseStabilizerPass

## Why

Homie can hear audio now, but the transcript quality is rough. The current bridge transcriber defaults to quick low-cost behavior: tiny model by default, beam size 1 in the source transcriber, and VAD enabled. This pass improves the STT settings instead of touching the UI.

## What this changes

Touches only:

- `backend_scaffold/homie_voice_transcribe.py`
- adds `RUN_HOMIE_VOICE_BRIDGE_BALANCED_ACCURACY_v10.36.74.bat`
- adds `RUN_HOMIE_VOICE_BRIDGE_MAX_ACCURACY_v10.36.74.bat`
- pass scripts

Does not touch:

- Trading
- CardGODMode
- Writers Lounge
- UI layout
- Homie avatar

## STT improvements

- beam size 5 instead of 1
- optional best_of 5
- VAD off by default for command phrases so short phrases are less likely to be chopped
- English language lock
- command/context initial prompt
- condition_on_previous_text false
- cleaner doctor settings visibility
- base.en balanced launcher
- small.en max accuracy launcher

## Run from `C:\OddEngine`

```powershell
Expand-Archive -Force "$env:USERPROFILE\Downloads\v10.36.74_HomieSTTAccuracyBoostAndCommandPhraseStabilizerPass.zip" C:\OddEngine

cd C:\OddEngine
powershell -ExecutionPolicy Bypass -File .\APPLY_v10.36.74_HomieSTTAccuracyBoostAndCommandPhraseStabilizerPass.ps1
powershell -ExecutionPolicy Bypass -File .\CHECK_v10.36.74_HomieSTTAccuracyBoostAndCommandPhraseStabilizerPass.ps1
```

## Then start the better bridge

Stop the old bridge first with `Ctrl+C`, then run balanced:

```powershell
cd C:\OddEngine
.\RUN_HOMIE_VOICE_BRIDGE_BALANCED_ACCURACY_v10.36.74.bat
```

If balanced still hears badly and you can tolerate slower transcription, stop it and run max:

```powershell
cd C:\OddEngine
.\RUN_HOMIE_VOICE_BRIDGE_MAX_ACCURACY_v10.36.74.bat
```

## Best test phrase

Use one clear sentence, not one-word tests:

```text
Homie open Render Lab and tell me the next step.
```

Then click Stop listening and wait. First run can be slow because the model may load/download.