$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
Write-Host "[v10.36.96_HomieAiTabFullDropInSingleCompanionRewritePass] Checking from $root"

$script = Join-Path $root "scripts\check-homie-ai-full-dropin-rewrite-v10.36.96.mjs"
if (!(Test-Path $script)) {
  throw "Missing $script. Extract this ZIP into C:\OddEngine first."
}

node $script