param(
  [switch]$Web,
  [switch]$Desktop
)

$ErrorActionPreference = "Stop"
Set-Location -Path (Split-Path -Parent $MyInvocation.MyCommand.Path)

Write-Host "[OddEngine] PowerShell launcher" -ForegroundColor Cyan

function Require-Cmd($name) {
  $cmd = Get-Command $name -ErrorAction SilentlyContinue
  if (-not $cmd) {
    throw "Required command not found: $name. Install Node.js (includes npm) and reopen PowerShell."
  }
}

Require-Cmd node
Require-Cmd npm

Write-Host "Node: $(node -v)"
Write-Host "npm : $(npm -v)"
Write-Host ""

Write-Host "Installing dependencies (npm install)..." -ForegroundColor Yellow
npm install

# --- Never-again protections ---
# 1) Auto-wipe Vite cache when UI version changes
$verFile = Join-Path (Get-Location) ".oddengine_last_ui_version.txt"
$curUiVer = node -p "require('./ui/package.json').version"
$lastUiVer = ""
if (Test-Path $verFile) {
  try { $lastUiVer = (Get-Content $verFile -ErrorAction SilentlyContinue | Select-Object -First 1).Trim() } catch { $lastUiVer = "" }
}
if ($lastUiVer -ne $curUiVer) {
  Write-Host "" 
  Write-Host "[Guard] UI version changed: $lastUiVer -> $curUiVer" -ForegroundColor Cyan
  $viteCache = Join-Path (Get-Location) "ui\node_modules\.vite"
  if (Test-Path $viteCache) {
    Write-Host "[Guard] Clearing Vite cache: $viteCache" -ForegroundColor Cyan
    Remove-Item -Recurse -Force $viteCache -ErrorAction SilentlyContinue
  }
  Set-Content -Path $verFile -Value $curUiVer
}

# 2) Preflight UI build so syntax errors fail fast
Write-Host "" 
Write-Host "[Guard] Preflight: building UI..." -ForegroundColor Yellow
npm --prefix ui run build

if ($Desktop) {
  Write-Host ""
  Write-Host "Starting desktop dev..." -ForegroundColor Green
  npm run dev:desktop
}
elseif ($Web) {
  Write-Host ""
  Write-Host "Starting web dev..." -ForegroundColor Green
  npm run dev
}
else {
  Write-Host ""
  Write-Host "No mode selected. Use -Desktop or -Web" -ForegroundColor Red
  Write-Host "Examples:"
  Write-Host "  .\RUN_WINDOWS.ps1 -Desktop"
  Write-Host "  .\RUN_WINDOWS.ps1 -Web"
}
