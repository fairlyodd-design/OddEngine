$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
Write-Host "[v10.36.93_HomieLegacyStageRetireAndUnifiedCompanionLeadPass] Checking from $root"

$script = Join-Path $root "scripts\check-homie-legacy-retire-v10.36.93.mjs"
if (!(Test-Path $script)) {
  throw "Missing $script. Extract this ZIP into C:\OddEngine first."
}

node $script