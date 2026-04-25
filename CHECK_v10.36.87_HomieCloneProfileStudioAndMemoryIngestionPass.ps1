$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
Write-Host "[v10.36.87_HomieCloneProfileStudioAndMemoryIngestionPass] Checking from $root"

$script = Join-Path $root "scripts\check-homie-clone-studio-memory-v10.36.87.mjs"
if (!(Test-Path $script)) {
  throw "Missing $script. Extract this ZIP into C:\OddEngine first."
}

node $script