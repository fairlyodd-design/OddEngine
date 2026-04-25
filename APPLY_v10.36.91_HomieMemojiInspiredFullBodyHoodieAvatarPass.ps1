$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
Write-Host "[v10.36.91_HomieMemojiInspiredFullBodyHoodieAvatarPass] Applying from $root"

$script = Join-Path $root "scripts\apply-homie-memoji-avatar-v10.36.91.mjs"
if (!(Test-Path $script)) {
  throw "Missing $script. Extract this ZIP into C:\OddEngine first."
}

node $script