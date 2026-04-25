$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
Write-Host "[v10.36.82_HomieDesktopCanvasAvatarFallbackAndUnifiedLauncherPolishPass] Applying from $root"

$script = Join-Path $root "scripts\apply-homie-desktop-canvas-fallback-v10.36.82.mjs"
if (!(Test-Path $script)) {
  throw "Missing $script. Extract this ZIP into C:\OddEngine first."
}

node $script

Copy-Item -Force (Join-Path $root "files\RUN_FAIRLYODD_OS_AND_HOMIE_v10.36.82.bat") (Join-Path $root "RUN_FAIRLYODD_OS_AND_HOMIE_v10.36.82.bat")
Copy-Item -Force (Join-Path $root "files\BUILD_FAIRLYODD_OS_AND_HOMIE_EXE_v10.36.82.ps1") (Join-Path $root "BUILD_FAIRLYODD_OS_AND_HOMIE_EXE_v10.36.82.ps1")
Write-Host "[v10.36.82_HomieDesktopCanvasAvatarFallbackAndUnifiedLauncherPolishPass] Launcher files copied."