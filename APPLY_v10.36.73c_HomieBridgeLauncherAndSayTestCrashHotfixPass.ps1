$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
Write-Host "[v10.36.73c_HomieBridgeLauncherAndSayTestCrashHotfixPass] Applying from $root"
$script = Join-Path $root "scripts\apply-homie-v10.36.73c-crash-hotfix.mjs"
if (!(Test-Path $script)) { throw "Missing $script. Extract this ZIP into C:\OddEngine first." }
node $script
