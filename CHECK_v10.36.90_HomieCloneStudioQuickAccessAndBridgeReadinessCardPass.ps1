$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
Write-Host "[v10.36.90_HomieCloneStudioQuickAccessAndBridgeReadinessCardPass] Checking from $root"

$script = Join-Path $root "scripts\check-homie-clone-quick-access-v10.36.90.mjs"
if (!(Test-Path $script)) {
  throw "Missing $script. Extract this ZIP into C:\OddEngine first."
}

node $script