$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
Write-Host "[v10.36.79_HomieLifelikePresenceAndWarmVoicePolishPass] Applying from $root"
$script = Join-Path $root "scripts\apply-homie-lifelike-presence-v10.36.79.mjs"
if (!(Test-Path $script)) {
  throw "Missing $script. Extract this ZIP into C:\OddEngine first."
}
node $script