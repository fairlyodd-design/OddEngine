$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot
Write-Host "[OddEngine] Applying v10.36.14 Trading Chain Containment and Virtualized Rows Pass"
node scripts/apply-trading-chain-containment-v10.36.14.mjs
Write-Host ""
Write-Host "Next: run .\RUN_v10.36.14_TRADING_CHAIN_CHECK.bat"
