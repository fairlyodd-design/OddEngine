# v10.26.20h7c_HomieFusionOneClickBootPass

This pass fuses the local Homie bridge, optional Homie desktop buddy, and OddEngine desktop boot into one launcher.

## New launchers
- `RUN_WINDOWS_HOMIE_FUSION.bat`
- `RUN_WINDOWS_HOMIE_FUSION.ps1`

## What it does
1. Installs OddEngine dependencies.
2. Installs Homie bridge dependencies from `backend_scaffold/homie_bridge_v1_26/requirements.txt`.
3. Starts the local bridge on `http://127.0.0.1:8765` if it is not already running.
4. Waits for `/health` to answer.
5. Checks whether Ollama answers on `127.0.0.1:11434`.
6. Optionally starts `RUN_HOMIE.bat` if present in the repo root.
7. Launches OddEngine desktop mode.

## Fastest use
Double-click `RUN_WINDOWS_HOMIE_FUSION.bat`.

## Notes
- The bridge package is embedded under `backend_scaffold/homie_bridge_v1_26`.
- If you do not want the separate buddy window, run:
  `powershell -ExecutionPolicy Bypass -File .\RUN_WINDOWS_HOMIE_FUSION.ps1 -NoDesktopBuddy`
- If Ollama is not installed, bridge health can still come up, but `/reply` will degrade until Ollama is running.
