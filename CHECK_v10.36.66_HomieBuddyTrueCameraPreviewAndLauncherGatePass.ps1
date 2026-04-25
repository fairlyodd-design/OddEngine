$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
Write-Host "[v10.36.66_HomieBuddyTrueCameraPreviewAndLauncherGatePass] Checking from $root"

$script = Join-Path $root "scripts\check-homie-buddy-camera-preview-launcher-gate-v10.36.66.mjs"
if (!(Test-Path $script)) {
  throw "Missing $script. Extract this ZIP into C:\OddEngine first."
}

node $script