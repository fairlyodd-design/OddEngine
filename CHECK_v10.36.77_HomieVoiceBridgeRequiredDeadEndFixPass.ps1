$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
Write-Host "[v10.36.77_HomieVoiceBridgeRequiredDeadEndFixPass] Checking from $root"
$script = Join-Path $root "scripts\check-homie-voice-bridge-required-deadend-v10.36.77.mjs"
if (!(Test-Path $script)) { throw "Missing $script. Extract this ZIP into C:\OddEngine first." }
node $script
