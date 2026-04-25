$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
Write-Host "[v10.36.78_HomieVoiceTranscriptionFailureReceiptAndAudioCapturePass] Checking from $root"
$script = Join-Path $root "scripts\check-homie-transcription-failure-receipt-v10.36.78.mjs"
if (!(Test-Path $script)) {
  throw "Missing $script. Extract this ZIP into C:\OddEngine first."
}
node $script

foreach ($p in @(
  "RUN_HOMIE_VOICE_BRIDGE_DEBUG_CAPTURE_v10.36.78.bat",
  "TEST_HOMIE_VOICE_TRANSCRIPTION_FAILURE_v10.36.78.ps1",
  "OPEN_HOMIE_VOICE_DEBUG_AUDIO_v10.36.78.bat"
)) {
  if (!(Test-Path (Join-Path $root $p))) {
    throw "Missing $p"
  }
}
Write-Host "[v10.36.78_HomieVoiceTranscriptionFailureReceiptAndAudioCapturePass] Script check passed."