$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
Write-Host "[v10.36.93_HomieLegacyStageRetireAndUnifiedCompanionLeadPass] Applying from $root"

$script = Join-Path $root "scripts\apply-homie-legacy-retire-v10.36.93.mjs"
if (!(Test-Path $script)) {
  throw "Missing $script. Extract this ZIP into C:\OddEngine first."
}

node $script