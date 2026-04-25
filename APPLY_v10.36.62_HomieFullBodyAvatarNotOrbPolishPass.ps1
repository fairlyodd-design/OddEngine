Write-Host "[v10.36.62] Applying Homie full-body avatar not-orb polish pass..." -ForegroundColor Cyan
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
node "$Root\scripts\apply-homie-full-body-avatar-v10.36.62.mjs"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "[v10.36.62] Apply complete. Now run CHECK, then npm run typecheck/build." -ForegroundColor Green
