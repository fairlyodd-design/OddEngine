$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
Write-Host "[v10.36.69_HomieBuddyMicDevicePickerAndSelectedInputProofPass] Applying from $root"

$script = Join-Path $root "scripts\apply-homie-mic-device-picker-selected-input-proof-v10.36.69.mjs"
if (!(Test-Path $script)) {
  throw "Missing $script. Extract this ZIP into C:\OddEngine first."
}

node $script