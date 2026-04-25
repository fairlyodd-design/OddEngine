$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
Write-Host "[v10.36.95_HomieAiTabDirectRewriteSingleVisualLanePass] Checking from $root"

$script = Join-Path $root "scripts\check-homie-ai-direct-rewrite-v10.36.95.mjs"
if (!(Test-Path $script)) {
  throw "Missing $script. Extract this ZIP into C:\OddEngine first."
}

node $script