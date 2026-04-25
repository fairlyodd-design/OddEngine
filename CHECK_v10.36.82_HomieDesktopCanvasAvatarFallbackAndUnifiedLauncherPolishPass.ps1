$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
Write-Host "[v10.36.82_HomieDesktopCanvasAvatarFallbackAndUnifiedLauncherPolishPass] Checking from $root"

$script = Join-Path $root "scripts\check-homie-desktop-canvas-fallback-v10.36.82.mjs"
if (!(Test-Path $script)) {
  throw "Missing $script. Extract this ZIP into C:\OddEngine first."
}

node $script

foreach ($p in @(
  "RUN_FAIRLYODD_OS_AND_HOMIE_v10.36.82.bat",
  "BUILD_FAIRLYODD_OS_AND_HOMIE_EXE_v10.36.82.ps1"
)) {
  if (!(Test-Path (Join-Path $root $p))) {
    throw "Missing $p"
  }
}

Write-Host "[v10.36.82_HomieDesktopCanvasAvatarFallbackAndUnifiedLauncherPolishPass] File check passed."