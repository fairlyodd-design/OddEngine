$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
Write-Host "[v10.36.85_HomiePremiumVoiceCadenceEmotionAndSubtleGesturePass] Checking from $root"

$script = Join-Path $root "scripts\check-homie-premium-voice-cadence-v10.36.85.mjs"
if (!(Test-Path $script)) {
  throw "Missing $script. Extract this ZIP into C:\OddEngine first."
}

node $script