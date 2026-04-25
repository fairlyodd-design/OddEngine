$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
Write-Host "[v10.36.93b_HomieLegacyStageRenderGateAndLeadOrderHotfix] Applying from $root"

$script = Join-Path $root "scripts\apply-homie-legacy-gate-hotfix-v10.36.93b.mjs"
if (!(Test-Path $script)) {
  throw "Missing $script. Extract this ZIP into C:\OddEngine first."
}

node $script