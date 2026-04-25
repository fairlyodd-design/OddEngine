$ErrorActionPreference = "Stop"
Write-Host "[v10.36.63] Applying Homie Buddy big-stage full-body companion pass..." -ForegroundColor Cyan
node .\scripts\apply-homie-buddy-big-stage-fullbody-v10.36.63.mjs
Write-Host "[v10.36.63] Apply complete. Now run:" -ForegroundColor Green
Write-Host "  powershell -ExecutionPolicy Bypass -File .\CHECK_HomieBuddyBigStageFullBodyCompanionPass.ps1"
Write-Host "  cd ui"
Write-Host "  npm run typecheck"
Write-Host "  npm run build"
