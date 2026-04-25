$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
Write-Host "[v10.36.83_HomieRealisticPresenceVisualPolishPass] Applying from $root"

$script = Join-Path $root "scripts\apply-homie-realistic-visual-vibe-v10.36.83.mjs"
if (!(Test-Path $script)) {
  throw "Missing $script. Extract this ZIP into C:\OddEngine first."
}

node $script