@echo off
cd /d "%~dp0"
echo [OddEngine] Configuring Music Provider Bridge for python-adapter mode...
if not exist backend_scaffold_data\music_bridge mkdir backend_scaffold_data\music_bridge
(
echo {
echo   "engine": "python-adapter",
echo   "python": "python",
echo   "adapterScript": "%~dp0music_engines\musicgen_adapter.py",
echo   "outputFormat": "wav",
echo   "timeoutMs": 600000,
echo   "saveOutputs": true
echo }
) > backend_scaffold_data\music_bridge\music_provider_config.json
echo [OddEngine] Starting Music Provider Bridge in real execution adapter mode...
node music-provider-bridge.mjs
pause
