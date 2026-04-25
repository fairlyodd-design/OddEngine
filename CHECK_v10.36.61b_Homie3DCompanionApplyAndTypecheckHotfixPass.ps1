$ErrorActionPreference = "Stop"
Write-Host "[v10.36.61b] Checking Homie 3D companion hotfix markers..." -ForegroundColor Cyan
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root
node .\scripts\check-homie-3d-companion-hotfix-v10.36.61b.mjs
