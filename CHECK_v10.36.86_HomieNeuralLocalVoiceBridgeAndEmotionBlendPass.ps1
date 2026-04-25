$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
Write-Host "[v10.36.86_HomieNeuralLocalVoiceBridgeAndEmotionBlendPass] Checking from $root"
$script = Join-Path $root "scripts\check-homie-neural-local-voice-v10.36.86.mjs"
if (!(Test-Path $script)) {
  throw "Missing $script. Extract this ZIP into C:\OddEngine first."
}
node $script