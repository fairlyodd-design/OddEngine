$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
Write-Host "[v10.36.89b_HomieCloneEditorInsideOSAndGuidedVoiceConsentWorkflowJsxLiteralHotfix] Checking from $root"
$script = Join-Path $root "scripts\check-homie-clone-editor-jsx-hotfix-v10.36.89b.mjs"
if (!(Test-Path $script)) {
  throw "Missing $script. Extract this ZIP into C:\OddEngine first."
}
node $script