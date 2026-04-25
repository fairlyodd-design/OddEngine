$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
Write-Host "[v10.36.98_HomieLeadAvatarPremiumParityPolishPass] Applying from $root"

$script = Join-Path $root "scripts\apply-homie-lead-avatar-premium-parity-v10.36.98.mjs"
if (!(Test-Path $script)) {
  throw "Missing $script. Extract this ZIP into C:\OddEngine first."
}

node $script