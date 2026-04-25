$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
Write-Host "[v10.36.72b_HomieBridgeDedupeAndNaturalSTTReplyRepairPass] Applying from $root"

$script = Join-Path $root "scripts\apply-homie-bridge-dedupe-natural-stt-v10.36.72b.mjs"
if (!(Test-Path $script)) {
  throw "Missing $script. Extract this ZIP into C:\OddEngine first."
}

node $script