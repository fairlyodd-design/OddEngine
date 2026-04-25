$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
Write-Host "[v10.36.85_HomiePremiumVoiceCadenceEmotionAndSubtleGesturePass] Applying from $root"

$script = Join-Path $root "scripts\apply-homie-premium-voice-cadence-v10.36.85.mjs"
if (!(Test-Path $script)) {
  throw "Missing $script. Extract this ZIP into C:\OddEngine first."
}

node $script