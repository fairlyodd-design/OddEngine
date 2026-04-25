$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
Write-Host "[v10.36.80_HomieTrueWarmLocalTTSVoicePass] Applying from $root"
$script = Join-Path $root "scripts\apply-homie-true-warm-local-tts-v10.36.80.mjs"
if (!(Test-Path $script)) {
  throw "Missing $script. Extract this ZIP into C:\OddEngine first."
}
node $script