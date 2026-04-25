$ErrorActionPreference = "Continue"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $root) { $root = (Get-Location).Path }
Set-Location $root

Write-Host "========================================"
Write-Host " FairlyOdd OS + Homie + Clone Startup"
Write-Host "========================================"
Write-Host ""

function Start-PowerShellWindow {
  param(
    [string]$Title,
    [string]$Command
  )
  Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-ExecutionPolicy","Bypass",
    "-Command",
    "$Host.UI.RawUI.WindowTitle = '$Title'; $Command"
  )
}

function Test-Health {
  param([string]$Url)
  try {
    $r = Invoke-RestMethod -Uri $Url -TimeoutSec 3
    return $true
  } catch {
    return $false
  }
}

# 1) Homie local voice bridge (8765) - optional but recommended for mic/local voice
$voiceBridgeBat = Join-Path $root "RUN_HOMIE_VOICE_BRIDGE_v10.36.45.bat"
if (Test-Path $voiceBridgeBat) {
  Write-Host "[1/3] Starting Homie local voice bridge on 8765..."
  Start-Process cmd.exe -ArgumentList "/k", "`"$voiceBridgeBat`""
} else {
  Write-Host "[1/3] 8765 voice bridge batch not found. Continuing without it."
}

Start-Sleep -Seconds 2

# 2) Clone editor/training bridge (8776)
$cloneBridgeBat = Join-Path $root "RUN_HOMIE_NEURAL_VOICE_BRIDGE_v10.36.88.bat"
$cloneBridgeNode = Join-Path $root "backend_scaffold\homie-neural-voice-bridge.mjs"
if (Test-Path $cloneBridgeBat) {
  Write-Host "[2/3] Starting clone bridge on 8776..."
  Start-Process cmd.exe -ArgumentList "/k", "`"$cloneBridgeBat`""
} elseif (Test-Path $cloneBridgeNode) {
  Write-Host "[2/3] Starting clone bridge from node fallback on 8776..."
  Start-PowerShellWindow -Title "Homie Clone Bridge 8776" -Command "cd '$root'; node '$cloneBridgeNode'"
} else {
  Write-Host "[2/3] Clone bridge file not found."
}

Start-Sleep -Seconds 2

# 3) UI dev server (5173)
$uiDir = Join-Path $root "ui"
if (Test-Path $uiDir) {
  Write-Host "[3/3] Starting ui dev server on 5173..."
  Start-PowerShellWindow -Title "OddEngine UI 5173" -Command "cd '$uiDir'; npm run dev"
} else {
  Write-Host "[3/3] ui folder not found."
}

Write-Host ""
Write-Host "Waiting a few seconds for services to come up..."
Start-Sleep -Seconds 6

$voiceOk = Test-Health "http://127.0.0.1:8765/health"
$cloneOk = Test-Health "http://127.0.0.1:8776/health"

Write-Host ""
Write-Host "Health snapshot:"
Write-Host (" - 8765 voice bridge: " + ($(if ($voiceOk) { "UP" } else { "NOT CONFIRMED" })))
Write-Host (" - 8776 clone bridge: " + ($(if ($cloneOk) { "UP" } else { "NOT CONFIRMED" })))
Write-Host " - 5173 ui: opening in browser"

Start-Process "http://127.0.0.1:5173"

Write-Host ""
Write-Host "Recommended use:"
Write-Host "  1. Leave the 8765 and 8776 bridge windows open."
Write-Host "  2. Wait for Vite to show ready."
Write-Host "  3. In the browser press Ctrl+F5 once."
Write-Host "  4. Open Homie, then Clone Studio."
Write-Host ""
Write-Host "Done."
