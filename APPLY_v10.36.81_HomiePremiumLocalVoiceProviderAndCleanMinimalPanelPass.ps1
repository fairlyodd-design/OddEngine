$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
Write-Host "[v10.36.81_HomiePremiumLocalVoiceProviderAndCleanMinimalPanelPass] Applying from $root"

$script = Join-Path $root "scripts\apply-homie-premium-local-voice-v10.36.81.mjs"
if (!(Test-Path $script)) {
  throw "Missing $script. Extract this ZIP into C:\OddEngine first."
}

node $script

Copy-Item -Force (Join-Path $root "files\RUN_FAIRLYODD_OS_AND_HOMIE_v10.36.81.bat") (Join-Path $root "RUN_FAIRLYODD_OS_AND_HOMIE_v10.36.81.bat")
Copy-Item -Force (Join-Path $root "files\BUILD_FAIRLYODD_OS_AND_HOMIE_EXE_v10.36.81.ps1") (Join-Path $root "BUILD_FAIRLYODD_OS_AND_HOMIE_EXE_v10.36.81.ps1")
Copy-Item -Force (Join-Path $root "files\README_FAIRLYODD_OS_AND_HOMIE_EXE_v10.36.81.txt") (Join-Path $root "README_FAIRLYODD_OS_AND_HOMIE_EXE_v10.36.81.txt")

Write-Host "[v10.36.81_HomiePremiumLocalVoiceProviderAndCleanMinimalPanelPass] Launcher/build-exe files copied."