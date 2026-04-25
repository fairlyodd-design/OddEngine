$ErrorActionPreference = "Stop"
Write-Host "[v10.36.61b] Applying Homie 3D companion apply/typecheck hotfix..." -ForegroundColor Cyan
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root
node .\scripts\apply-homie-3d-companion-hotfix-v10.36.61b.mjs
Write-Host "[v10.36.61b] Apply complete. Now run:" -ForegroundColor Green
Write-Host "  powershell -ExecutionPolicy Bypass -File .\CHECK_v10.36.61b_Homie3DCompanionApplyAndTypecheckHotfixPass.ps1"
Write-Host "  cd ui"
Write-Host "  npm run typecheck"
Write-Host "  npm run build"
