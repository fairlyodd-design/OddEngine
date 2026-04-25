$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
Write-Host "[v10.36.97b_HomieUnifiedLeadAvatarMountParityHotfix] Checking from $root"

$script = Join-Path $root "scripts\check-homie-unified-lead-parity-v10.36.97b.mjs"
if (!(Test-Path $script)) {
  throw "Missing $script. Extract this ZIP into C:\OddEngine first."
}

node $script