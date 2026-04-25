$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
Write-Host "[v10.36.80_HomieTrueWarmLocalTTSVoicePass] Checking from $root"
$script = Join-Path $root "scripts\check-homie-true-warm-local-tts-v10.36.80.mjs"
if (!(Test-Path $script)) {
  throw "Missing $script. Extract this ZIP into C:\OddEngine first."
}
node $script