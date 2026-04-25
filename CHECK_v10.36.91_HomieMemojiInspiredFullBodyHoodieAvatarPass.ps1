$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
Write-Host "[v10.36.91_HomieMemojiInspiredFullBodyHoodieAvatarPass] Checking from $root"

$script = Join-Path $root "scripts\check-homie-memoji-avatar-v10.36.91.mjs"
if (!(Test-Path $script)) {
  throw "Missing $script. Extract this ZIP into C:\OddEngine first."
}

node $script