$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
Write-Host "[v10.36.92b_HomieUnifiedAvatarStageRenderHotfix] Applying from $root"

$script = Join-Path $root "scripts\apply-homie-unified-avatar-hotfix-v10.36.92b.mjs"
if (!(Test-Path $script)) {
  throw "Missing $script. Extract this ZIP into C:\OddEngine first."
}

node $script