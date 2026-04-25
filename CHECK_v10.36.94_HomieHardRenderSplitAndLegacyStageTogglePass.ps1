$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
Write-Host "[v10.36.94_HomieHardRenderSplitAndLegacyStageTogglePass] Checking from $root"

$script = Join-Path $root "scripts\check-homie-hard-render-split-v10.36.94.mjs"
if (!(Test-Path $script)) {
  throw "Missing $script. Extract this ZIP into C:\OddEngine first."
}

node $script