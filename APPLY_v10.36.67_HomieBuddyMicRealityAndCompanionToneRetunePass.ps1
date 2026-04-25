$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
Write-Host "[v10.36.67_HomieBuddyMicRealityAndCompanionToneRetunePass] Applying from $root"

$script = Join-Path $root "scripts\apply-homie-mic-reality-and-tone-retune-v10.36.67.mjs"
if (!(Test-Path $script)) {
  throw "Missing $script. Extract this ZIP into C:\OddEngine first."
}

node $script