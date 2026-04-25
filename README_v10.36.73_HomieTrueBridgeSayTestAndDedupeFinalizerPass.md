# v10.36.73_HomieTrueBridgeSayTestAndDedupeFinalizerPass

Repairs Homie voice after the local bridge is alive but Say test still reports browser SpeechRecognition.

## Run from C:\OddEngine

```powershell
powershell -ExecutionPolicy Bypass -File .\APPLY_v10.36.73_HomieTrueBridgeSayTestAndDedupeFinalizerPass.ps1
powershell -ExecutionPolicy Bypass -File .\CHECK_v10.36.73_HomieTrueBridgeSayTestAndDedupeFinalizerPass.ps1

cd ui
npm run typecheck
npm run build
npm run dev
```

## High accuracy bridge

Stop the old bridge window with Ctrl+C, then:

```powershell
cd C:\OddEngine
.\RUN_HOMIE_VOICE_BRIDGE_HIGH_ACCURACY_v10.36.73.bat
```

## Test

Homie → Voice → Use local bridge → Check health → Run doctor → Bridge say test → say one sentence → Stop listening.
