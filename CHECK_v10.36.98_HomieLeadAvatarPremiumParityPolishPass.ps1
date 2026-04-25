$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
Write-Host "[v10.36.98_HomieLeadAvatarPremiumParityPolishPass] Checking from $root"

$script = Join-Path $root "scripts\check-homie-lead-avatar-premium-parity-v10.36.98.mjs"
if (!(Test-Path $script)) {
  throw "Missing $script. Extract this ZIP into C:\OddEngine first."
}

node $script