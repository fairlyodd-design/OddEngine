$ErrorActionPreference = "Continue"
Write-Host "[Homie v10.36.77] Testing voice bridge at http://127.0.0.1:8765"
try {
  Write-Host "GET /health"
  $health = Invoke-RestMethod -Uri "http://127.0.0.1:8765/health" -TimeoutSec 10
  $health | ConvertTo-Json -Depth 8
} catch {
  Write-Host "FAILED /health:"; Write-Host $_.Exception.Message; Write-Host ""
  Write-Host "Start one of these first, keep the window open, then retry:"
  Write-Host "  .\RUN_HOMIE_VOICE_BRIDGE_AUDIO_CLEANUP_v10.36.75.bat"
  Write-Host "  .\RUN_HOMIE_VOICE_BRIDGE_v10.36.45.bat"
  exit 1
}
Write-Host ""
try { Write-Host "GET /doctor"; $doctor = Invoke-RestMethod -Uri "http://127.0.0.1:8765/doctor" -TimeoutSec 30; $doctor | ConvertTo-Json -Depth 8 } catch { Write-Host "FAILED /doctor:"; Write-Host $_.Exception.Message }
Write-Host ""
try { Write-Host "GET /last-error"; $err = Invoke-RestMethod -Uri "http://127.0.0.1:8765/last-error" -TimeoutSec 10; $err | ConvertTo-Json -Depth 8 } catch { Write-Host "No /last-error response or no error endpoint." }
