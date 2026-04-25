$ErrorActionPreference = "Stop"

$repo = (Get-Location).Path
if (-not (Test-Path (Join-Path $repo "ui\src\panels\Homie.tsx"))) {
  throw "Run this from the OddEngine repo root, for example: C:\OddEngine"
}

Write-Host "[v10.36.61] Applying Homie 3D full companion mic/cam presence pass..." -ForegroundColor Cyan
node ".\scripts\apply-homie-3d-companion-mic-cam-v10.36.61.mjs"

Write-Host "[v10.36.61] Apply complete. Now run:" -ForegroundColor Green
Write-Host "  powershell -ExecutionPolicy Bypass -File .\CHECK_v10.36.61_Homie3DFullCompanionMicCamPresencePass.ps1"
Write-Host "  cd ui"
Write-Host "  npm run typecheck"
Write-Host "  npm run build"
