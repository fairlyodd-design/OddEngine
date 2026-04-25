$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
Write-Host "[v10.36.92_HomieVisualLaneUnifyWebAndDesktopAvatarPass] Checking from $root"

$script = Join-Path $root "scripts\check-homie-visual-unify-v10.36.92.mjs"
if (!(Test-Path $script)) {
  throw "Missing $script. Extract this ZIP into C:\OddEngine first."
}

node $script