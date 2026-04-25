$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
Write-Host "[v10.36.99_HomieLeadAvatarHeroParityAndRightLaneMatchPass] Applying from $root"

$script = Join-Path $root "scripts\apply-homie-hero-parity-match-v10.36.99.mjs"
if (!(Test-Path $script)) {
  throw "Missing $script. Extract this ZIP into C:\OddEngine first."
}

node $script