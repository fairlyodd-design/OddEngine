$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
Write-Host "[v10.36.71_HomieLocalBridgeSayTestAndReadinessProofPass] Applying from $root"

$script = Join-Path $root "scripts\apply-homie-local-bridge-saytest-readiness-proof-v10.36.71.mjs"
if (!(Test-Path $script)) {
  throw "Missing $script. Extract this ZIP into C:\OddEngine first."
}

node $script