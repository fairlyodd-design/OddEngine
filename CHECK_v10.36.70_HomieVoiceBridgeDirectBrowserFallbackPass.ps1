$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
Write-Host "[v10.36.70_HomieVoiceBridgeDirectBrowserFallbackPass] Checking from $root"

$script = Join-Path $root "scripts\check-homie-voice-bridge-direct-browser-fallback-v10.36.70.mjs"
if (!(Test-Path $script)) {
  throw "Missing $script. Extract this ZIP into C:\OddEngine first."
}

node $script