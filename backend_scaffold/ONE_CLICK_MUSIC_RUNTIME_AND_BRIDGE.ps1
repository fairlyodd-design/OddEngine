$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root
Write-Host "[OddEngine Music Runtime] One-click startup from $Root"
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Root "INSTALL_WINDOWS_MUSIC_RUNTIME.ps1")
if ($LASTEXITCODE -ne 0) { throw "Install step failed." }
cmd /c (Join-Path $Root "TEST_WINDOWS_MUSIC_RUNTIME.bat")
if ($LASTEXITCODE -ne 0) { throw "Probe step failed." }
$Py = Join-Path $Root ".venv\Scripts\python.exe"
if (-not (Test-Path $Py)) { $Py = Join-Path $Root "music_runtime_env\Scripts\python.exe" }
if (-not (Test-Path $Py)) { throw "Runtime Python not found after install." }
$env:MUSIC_PYTHON = $Py
Write-Host "[OddEngine Music Runtime] Launching bridge with MUSIC_PYTHON=$Py"
node (Join-Path $Root "music-provider-bridge.mjs")
