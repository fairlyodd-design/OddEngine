$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
Write-Host "[v10.36.84_HomieFacialMicroExpressionsAndPremiumIdlePresencePass] Applying from $root"

$script = Join-Path $root "scripts\apply-homie-micro-expressions-v10.36.84.mjs"
if (!(Test-Path $script)) {
  throw "Missing $script. Extract this ZIP into C:\OddEngine first."
}

node $script