$ErrorActionPreference = "Continue"

Write-Host "=== Homie Clone Editor + Training Bridge Test v10.36.88 ==="
Write-Host ""

try {
  Write-Host "1) /health"
  $health = Invoke-RestMethod -Uri "http://127.0.0.1:8776/health" -TimeoutSec 10
  $health | ConvertTo-Json -Depth 10
} catch {
  Write-Host "FAILED /health"
  Write-Host $_.Exception.Message
  Write-Host "Start .\RUN_HOMIE_NEURAL_VOICE_BRIDGE_v10.36.88.bat first."
  exit 1
}

Write-Host ""
Write-Host "2) /family-phrases"
try {
  $phrases = Invoke-RestMethod -Uri "http://127.0.0.1:8776/family-phrases" -TimeoutSec 10
  $phrases | ConvertTo-Json -Depth 12
} catch {
  Write-Host "FAILED /family-phrases"
  Write-Host $_.Exception.Message
}

Write-Host ""
Write-Host "3) /training-workflow"
try {
  $training = Invoke-RestMethod -Uri "http://127.0.0.1:8776/training-workflow" -TimeoutSec 10
  $training | ConvertTo-Json -Depth 12
} catch {
  Write-Host "FAILED /training-workflow"
  Write-Host $_.Exception.Message
}

Write-Host ""
Write-Host "4) /generate-training-manifest"
try {
  $manifest = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8776/generate-training-manifest" -ContentType "application/json" -Body "{}" -TimeoutSec 10
  $manifest | ConvertTo-Json -Depth 12
} catch {
  Write-Host "FAILED /generate-training-manifest"
  Write-Host $_.Exception.Message
}

Write-Host ""
Write-Host "5) /preview"
$previewBody = @{
  text = "Open Render Lab and tell me the next move for the family-safe workflow."
  emotion = "focused"
} | ConvertTo-Json -Depth 8
try {
  $preview = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8776/preview" -ContentType "application/json" -Body $previewBody -TimeoutSec 10
  $preview | ConvertTo-Json -Depth 12
} catch {
  Write-Host "FAILED /preview"
  Write-Host $_.Exception.Message
}
