$ErrorActionPreference = "Continue"

Write-Host "=== Homie Clone Studio + Memory Bridge Test v10.36.87 ==="
Write-Host ""

try {
  Write-Host "1) /health"
  $health = Invoke-RestMethod -Uri "http://127.0.0.1:8776/health" -TimeoutSec 10
  $health | ConvertTo-Json -Depth 10
} catch {
  Write-Host "FAILED /health"
  Write-Host $_.Exception.Message
  Write-Host "Start .\RUN_HOMIE_NEURAL_VOICE_BRIDGE_v10.36.87.bat first."
  exit 1
}

Write-Host ""
Write-Host "2) /memory-bank"
try {
  $memory = Invoke-RestMethod -Uri "http://127.0.0.1:8776/memory-bank" -TimeoutSec 10
  $memory | ConvertTo-Json -Depth 12
} catch {
  Write-Host "FAILED /memory-bank"
  Write-Host $_.Exception.Message
}

Write-Host ""
Write-Host "3) /ingest-memory"
$ingestBody = @{
  title = "Family priority memory"
  text = "Family comes first, keep the room calm, and always reduce things to the next move."
  sourceType = "manual-note"
  tags = @("family","next-move","tone")
} | ConvertTo-Json -Depth 8
try {
  $ingest = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8776/ingest-memory" -ContentType "application/json" -Body $ingestBody -TimeoutSec 10
  $ingest | ConvertTo-Json -Depth 12
} catch {
  Write-Host "FAILED /ingest-memory"
  Write-Host $_.Exception.Message
}

Write-Host ""
Write-Host "4) /preview"
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

Write-Host ""
Write-Host "5) /build-studio-pack"
try {
  $pack = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8776/build-studio-pack" -ContentType "application/json" -Body "{}" -TimeoutSec 10
  $pack | ConvertTo-Json -Depth 12
} catch {
  Write-Host "FAILED /build-studio-pack"
  Write-Host $_.Exception.Message
}
