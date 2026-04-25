$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
Write-Host "[v10.36.90_HomieCloneStudioQuickAccessAndBridgeReadinessCardPass] Applying from $root"

$script = Join-Path $root "scripts\apply-homie-clone-quick-access-v10.36.90.mjs"
if (!(Test-Path $script)) {
  throw "Missing $script. Extract this ZIP into C:\OddEngine first."
}

node $script