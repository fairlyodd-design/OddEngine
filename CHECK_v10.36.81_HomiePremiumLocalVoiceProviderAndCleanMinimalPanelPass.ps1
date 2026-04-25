$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
Write-Host "[v10.36.81_HomiePremiumLocalVoiceProviderAndCleanMinimalPanelPass] Checking from $root"

$script = Join-Path $root "scripts\check-homie-premium-local-voice-v10.36.81.mjs"
if (!(Test-Path $script)) {
  throw "Missing $script. Extract this ZIP into C:\OddEngine first."
}
node $script

foreach ($p in @(
  "RUN_FAIRLYODD_OS_AND_HOMIE_v10.36.81.bat",
  "BUILD_FAIRLYODD_OS_AND_HOMIE_EXE_v10.36.81.ps1",
  "README_FAIRLYODD_OS_AND_HOMIE_EXE_v10.36.81.txt"
)) {
  if (!(Test-Path (Join-Path $root $p))) {
    throw "Missing $p"
  }
}

Write-Host "[v10.36.81_HomiePremiumLocalVoiceProviderAndCleanMinimalPanelPass] File check passed."