param(
  [switch]$NoDesktopBuddy,
  [switch]$Web,
  [switch]$SkipInstall,
  [switch]$SkipBridgeDeps,
  [string]$BridgeHost = "127.0.0.1",
  [int]$BridgePort = 8765,
  [int]$BridgeTimeoutSeconds = 45
)

$ErrorActionPreference = "Stop"
Set-Location -Path (Split-Path -Parent $MyInvocation.MyCommand.Path)

function Require-Cmd($name) {
  $cmd = Get-Command $name -ErrorAction SilentlyContinue
  if (-not $cmd) {
    throw "Required command not found: $name"
  }
}

function Test-Http($url) {
  try {
    $resp = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2
    return $resp.StatusCode -ge 200 -and $resp.StatusCode -lt 500
  } catch {
    return $false
  }
}

function Wait-Http($url, $timeoutSeconds) {
  $deadline = (Get-Date).AddSeconds($timeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    if (Test-Http $url) { return $true }
    Start-Sleep -Milliseconds 750
  }
  return $false
}

function Start-ProcessWindow {
  param(
    [Parameter(Mandatory=$true)][string]$FilePath,
    [Parameter(Mandatory=$true)][string]$WorkingDirectory,
    [Parameter()][string[]]$ArgumentList = @()
  )
  if ($null -eq $ArgumentList) { $ArgumentList = @() }
  return Start-Process -FilePath $FilePath -WorkingDirectory $WorkingDirectory -ArgumentList $ArgumentList -PassThru
}

Require-Cmd node
Require-Cmd npm
Require-Cmd python

$bridgeDir = Join-Path (Get-Location) 'backend_scaffold\homie_bridge_v1_26'
$bridgeHealth = "http://${BridgeHost}:${BridgePort}/health"
$ollamaTags = 'http://127.0.0.1:11434/api/tags'

Write-Host "[OddEngine Fusion] Node: $(node -v)" -ForegroundColor Cyan
Write-Host "[OddEngine Fusion] npm : $(npm -v)"
Write-Host "[OddEngine Fusion] python: $(python --version 2>&1)"
Write-Host ""

if (-not $SkipInstall) {
  Write-Host "[OddEngine Fusion] Installing root dependencies..." -ForegroundColor Yellow
  npm install
}

if (-not $SkipBridgeDeps) {
  Write-Host "[OddEngine Fusion] Installing bridge dependencies..." -ForegroundColor Yellow
  python -m pip install -r (Join-Path $bridgeDir 'requirements.txt')
}

if (-not (Test-Path $bridgeDir)) {
  throw "Bridge folder missing: $bridgeDir"
}

if (-not (Test-Http $bridgeHealth)) {
  Write-Host "[OddEngine Fusion] Starting Homie bridge..." -ForegroundColor Green
  Start-ProcessWindow 'cmd.exe' $bridgeDir @('/c','RUN_HOMIE_BRIDGE.bat') | Out-Null
} else {
  Write-Host "[OddEngine Fusion] Homie bridge already responding at $bridgeHealth" -ForegroundColor Green
}

if (Wait-Http $bridgeHealth $BridgeTimeoutSeconds) {
  Write-Host "[OddEngine Fusion] Bridge ready at $bridgeHealth" -ForegroundColor Green
} else {
  Write-Warning "Homie bridge did not answer at $bridgeHealth within ${BridgeTimeoutSeconds}s. OddEngine will still launch."
}

if (Test-Http $ollamaTags) {
  Write-Host "[OddEngine Fusion] Ollama looks reachable on 127.0.0.1:11434" -ForegroundColor Green
} else {
  Write-Warning "Ollama does not appear reachable on 127.0.0.1:11434. /reply may degrade until Ollama is running."
}

if (-not $NoDesktopBuddy) {
  $buddyBat = Join-Path (Get-Location) 'RUN_HOMIE.bat'
  if (Test-Path $buddyBat) {
    Write-Host "[OddEngine Fusion] Starting desktop buddy window..." -ForegroundColor Green
    Start-ProcessWindow 'cmd.exe' (Get-Location).Path @('/c', $buddyBat) | Out-Null
  } else {
    Write-Warning "RUN_HOMIE.bat not found in repo root, skipping buddy window."
  }
}

Write-Host "[OddEngine Fusion] Launching OddEngine..." -ForegroundColor Green
if ($Web) {
  powershell -ExecutionPolicy Bypass -File .\RUN_WINDOWS.ps1 -Web
} else {
  powershell -ExecutionPolicy Bypass -File .\RUN_WINDOWS.ps1 -Desktop
}
