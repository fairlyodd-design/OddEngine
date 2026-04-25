Write-Host "[v10.36.64] Applying Homie Buddy companion stage layout polish pass..."
node .\scripts\apply-homie-buddy-stage-layout-polish-v10.36.64.mjs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "[v10.36.64] Apply complete. Now run:"
Write-Host "  powershell -ExecutionPolicy Bypass -File .\CHECK_HomieBuddyCompanionStageLayoutPolishPass.ps1"
Write-Host "  cd ui"
Write-Host "  npm run typecheck"
Write-Host "  npm run build"
