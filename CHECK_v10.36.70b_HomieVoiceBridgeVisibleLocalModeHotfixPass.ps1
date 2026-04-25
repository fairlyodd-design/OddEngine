$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
Write-Host "[v10.36.70b_HomieVoiceBridgeVisibleLocalModeHotfixPass] Checking from $root"

$script = Join-Path $root "scripts\check-homie-visible-local-bridge-hotfix-v10.36.70b.mjs"
if (!(Test-Path $script)) {
  throw "Missing $script. Extract this ZIP into C:\OddEngine first."
}

node $script