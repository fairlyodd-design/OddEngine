$ErrorActionPreference = "Stop"

$repo = (Get-Location).Path
if (-not (Test-Path (Join-Path $repo "ui\src\panels\Homie.tsx"))) {
  throw "Run this from the OddEngine repo root, for example: C:\OddEngine"
}

Write-Host "[v10.36.61] Checking Homie 3D companion pass markers..." -ForegroundColor Cyan
node ".\scripts\check-homie-3d-companion-mic-cam-v10.36.61.mjs"
