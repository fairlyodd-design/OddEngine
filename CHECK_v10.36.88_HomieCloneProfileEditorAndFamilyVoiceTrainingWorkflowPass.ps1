$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
Write-Host "[v10.36.88_HomieCloneProfileEditorAndFamilyVoiceTrainingWorkflowPass] Checking from $root"

$script = Join-Path $root "scripts\check-homie-clone-editor-training-v10.36.88.mjs"
if (!(Test-Path $script)) {
  throw "Missing $script. Extract this ZIP into C:\OddEngine first."
}

node $script