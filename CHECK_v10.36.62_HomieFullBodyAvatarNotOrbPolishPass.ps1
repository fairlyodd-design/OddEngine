Write-Host "[v10.36.62] Checking Homie full-body avatar not-orb polish pass..." -ForegroundColor Cyan
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
node "$Root\scripts\check-homie-full-body-avatar-v10.36.62.mjs"
exit $LASTEXITCODE
