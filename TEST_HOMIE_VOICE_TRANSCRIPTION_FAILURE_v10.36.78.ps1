$ErrorActionPreference = "Continue"

Write-Host "=== Homie Voice Transcription Failure Test v10.36.78 ==="
Write-Host ""

Write-Host "1) /health"
try {
  $health = Invoke-RestMethod -Uri "http://127.0.0.1:8765/health" -TimeoutSec 10
  $health | ConvertTo-Json -Depth 10
} catch {
  Write-Host "FAILED /health"
  Write-Host $_.Exception.Message
  Write-Host "Start RUN_HOMIE_VOICE_BRIDGE_DEBUG_CAPTURE_v10.36.78.bat and keep it open."
  exit 1
}

Write-Host ""
Write-Host "2) /doctor"
try {
  $doctor = Invoke-RestMethod -Uri "http://127.0.0.1:8765/doctor" -TimeoutSec 45
  $doctor | ConvertTo-Json -Depth 10
} catch {
  Write-Host "FAILED /doctor"
  Write-Host $_.Exception.Message
}

Write-Host ""
Write-Host "3) /last-error"
try {
  $last = Invoke-RestMethod -Uri "http://127.0.0.1:8765/last-error" -TimeoutSec 10
  $last | ConvertTo-Json -Depth 12
} catch {
  Write-Host "FAILED /last-error"
  Write-Host $_.Exception.Message
}

Write-Host ""
Write-Host "4) Debug audio folder"
$folder = Join-Path (Get-Location) "backend_scaffold\homie_voice_debug_audio"
if (Test-Path $folder) {
  Get-ChildItem $folder | Sort-Object LastWriteTime -Descending | Select-Object -First 10 | Format-Table LastWriteTime, Length, Name -AutoSize
} else {
  Write-Host "No debug audio folder yet. Run a Bridge say test once while debug bridge is open."
}

Write-Host ""
Write-Host "If /last-error shows a debugAudioPath, open that file and see if your full sentence was recorded."
