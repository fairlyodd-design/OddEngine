$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
Write-Host "[v10.36.89_HomieCloneEditorInsideOSAndGuidedVoiceConsentWorkflowPass] Checking from $root"
$script = Join-Path $root "scripts\check-homie-clone-inside-os-v10.36.89.mjs"
if (!(Test-Path $script)) {
  throw "Missing $script. Extract this ZIP into C:\OddEngine first."
}
node $script