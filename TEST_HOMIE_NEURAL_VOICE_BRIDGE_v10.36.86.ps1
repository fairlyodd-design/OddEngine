$ErrorActionPreference = "Continue"

Write-Host "=== Homie Neural Voice Bridge Test v10.36.86 ==="
Write-Host ""

try {
  Write-Host "1) /health"
  $health = Invoke-RestMethod -Uri "http://127.0.0.1:8776/health" -TimeoutSec 10
  $health | ConvertTo-Json -Depth 10
} catch {
  Write-Host "FAILED /health"
  Write-Host $_.Exception.Message
  Write-Host "Start .\RUN_HOMIE_NEURAL_VOICE_BRIDGE_v10.36.86.bat first."
  exit 1
}

Write-Host ""
Write-Host "2) /doctor"
try {
  $doctor = Invoke-RestMethod -Uri "http://127.0.0.1:8776/doctor" -TimeoutSec 10
  $doctor | ConvertTo-Json -Depth 10
} catch {
  Write-Host "FAILED /doctor"
  Write-Host $_.Exception.Message
}

Write-Host ""
Write-Host "3) /clone-profile"
try {
  $profile = Invoke-RestMethod -Uri "http://127.0.0.1:8776/clone-profile" -TimeoutSec 10
  $profile | ConvertTo-Json -Depth 12
} catch {
  Write-Host "FAILED /clone-profile"
  Write-Host $_.Exception.Message
}

Write-Host ""
Write-Host "4) /preview"
$body = @{
  text = "Open Render Lab and tell me the next move for the family-safe workflow."
  emotion = "focused"
} | ConvertTo-Json -Depth 8
try {
  $preview = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8776/preview" -ContentType "application/json" -Body $body -TimeoutSec 10
  $preview | ConvertTo-Json -Depth 12
} catch {
  Write-Host "FAILED /preview"
  Write-Host $_.Exception.Message
}

Write-Host ""
Write-Host "5) /last-request"
try {
  $last = Invoke-RestMethod -Uri "http://127.0.0.1:8776/last-request" -TimeoutSec 10
  $last | ConvertTo-Json -Depth 12
} catch {
  Write-Host "FAILED /last-request"
  Write-Host $_.Exception.Message
}
