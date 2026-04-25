$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
Write-Host "[v10.36.69_HomieBuddyMicDevicePickerAndSelectedInputProofPass] Checking from $root"

$script = Join-Path $root "scripts\check-homie-mic-device-picker-selected-input-proof-v10.36.69.mjs"
if (!(Test-Path $script)) {
  throw "Missing $script. Extract this ZIP into C:\OddEngine first."
}

node $script