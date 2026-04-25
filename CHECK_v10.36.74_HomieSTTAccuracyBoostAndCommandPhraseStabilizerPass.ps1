$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
Write-Host "[v10.36.74_HomieSTTAccuracyBoostAndCommandPhraseStabilizerPass] Checking from $root"

$script = Join-Path $root "scripts\check-homie-stt-accuracy-v10.36.74.mjs"
if (!(Test-Path $script)) {
  throw "Missing $script. Extract this ZIP into C:\OddEngine first."
}

node $script