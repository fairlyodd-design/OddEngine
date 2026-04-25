$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
Write-Host "[v10.36.81b_HomieDesktopWebGLFallbackHotfixPass] Checking from $root"
$script = Join-Path $root "scripts\check-homie-desktop-webgl-fallback-v10.36.81b.mjs"
if (!(Test-Path $script)) {
  throw "Missing $script. Extract this ZIP into C:\OddEngine first."
}
node $script