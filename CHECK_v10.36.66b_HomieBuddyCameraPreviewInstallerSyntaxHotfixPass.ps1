$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
Write-Host "[v10.36.66b_HomieBuddyCameraPreviewInstallerSyntaxHotfixPass] Checking from $root"

$script = Join-Path $root "scripts\check-homie-buddy-camera-preview-installer-syntax-hotfix-v10.36.66b.mjs"
if (!(Test-Path $script)) {
  throw "Missing $script. Extract this ZIP into C:\OddEngine first."
}

node $script