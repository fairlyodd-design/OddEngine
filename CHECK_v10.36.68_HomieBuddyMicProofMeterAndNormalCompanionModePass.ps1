$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
Write-Host "[v10.36.68_HomieBuddyMicProofMeterAndNormalCompanionModePass] Checking from $root"

$script = Join-Path $root "scripts\check-homie-mic-proof-meter-normal-mode-v10.36.68.mjs"
if (!(Test-Path $script)) {
  throw "Missing $script. Extract this ZIP into C:\OddEngine first."
}

node $script