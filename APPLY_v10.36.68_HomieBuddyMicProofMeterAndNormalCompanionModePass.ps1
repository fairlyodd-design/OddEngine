$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
Write-Host "[v10.36.68_HomieBuddyMicProofMeterAndNormalCompanionModePass] Applying from $root"

$script = Join-Path $root "scripts\apply-homie-mic-proof-meter-normal-mode-v10.36.68.mjs"
if (!(Test-Path $script)) {
  throw "Missing $script. Extract this ZIP into C:\OddEngine first."
}

node $script