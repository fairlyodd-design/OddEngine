$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
Write-Host "[v10.36.76_HomieBridgeFullSentenceCaptureAndPartialTranscriptGuardPass] Applying from $root"

$script = Join-Path $root "scripts\apply-homie-bridge-full-sentence-capture-v10.36.76.mjs"
if (!(Test-Path $script)) {
  throw "Missing $script. Extract this ZIP into C:\OddEngine first."
}

node $script
