# v10.36.73c_HomieBridgeLauncherAndSayTestCrashHotfixPass

Repairs the failed v10.36.73 installer crash and creates the missing high-accuracy bridge launcher.

Run from `C:\OddEngine`:

```powershell
powershell -ExecutionPolicy Bypass -File .\APPLY_v10.36.73c_HomieBridgeLauncherAndSayTestCrashHotfixPass.ps1
powershell -ExecutionPolicy Bypass -File .\CHECK_v10.36.73c_HomieBridgeLauncherAndSayTestCrashHotfixPass.ps1

cd ui
npm run typecheck
npm run build
npm run dev
```

Then stop the old bridge with Ctrl+C and run:

```powershell
cd C:\OddEngine
.\RUN_HOMIE_VOICE_BRIDGE_HIGH_ACCURACY_v10.36.73.bat
```
