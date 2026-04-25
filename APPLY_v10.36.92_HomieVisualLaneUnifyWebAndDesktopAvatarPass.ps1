$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
Write-Host "[v10.36.92_HomieVisualLaneUnifyWebAndDesktopAvatarPass] Applying from $root"

$script = Join-Path $root "scripts\apply-homie-visual-unify-v10.36.92.mjs"
if (!(Test-Path $script)) {
  throw "Missing $script. Extract this ZIP into C:\OddEngine first."
}

node $script