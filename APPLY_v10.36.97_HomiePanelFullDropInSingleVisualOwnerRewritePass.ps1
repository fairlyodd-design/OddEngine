$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
Write-Host "[v10.36.97_HomiePanelFullDropInSingleVisualOwnerRewritePass] Applying from $root"

$script = Join-Path $root "scripts\apply-homie-panel-full-dropin-v10.36.97.mjs"
if (!(Test-Path $script)) {
  throw "Missing $script. Extract this ZIP into C:\OddEngine first."
}

node $script