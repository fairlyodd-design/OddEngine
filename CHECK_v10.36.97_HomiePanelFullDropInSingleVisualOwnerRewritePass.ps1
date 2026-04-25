$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
Write-Host "[v10.36.97_HomiePanelFullDropInSingleVisualOwnerRewritePass] Checking from $root"

$script = Join-Path $root "scripts\check-homie-panel-full-dropin-v10.36.97.mjs"
if (!(Test-Path $script)) {
  throw "Missing $script. Extract this ZIP into C:\OddEngine first."
}

node $script