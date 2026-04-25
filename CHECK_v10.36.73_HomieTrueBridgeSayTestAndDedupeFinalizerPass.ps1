$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
Write-Host "[v10.36.73_HomieTrueBridgeSayTestAndDedupeFinalizerPass] Checking from $root"
$script = Join-Path $root "scripts\check-homie-v10.36.73-finalizer.mjs"
if (!(Test-Path $script)) { throw "Missing $script. Extract this ZIP into C:\OddEngine first." }
node $script