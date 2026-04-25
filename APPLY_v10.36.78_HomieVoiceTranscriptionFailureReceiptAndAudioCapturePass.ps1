$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
Write-Host "[v10.36.78_HomieVoiceTranscriptionFailureReceiptAndAudioCapturePass] Applying from $root"
$script = Join-Path $root "scripts\apply-homie-transcription-failure-receipt-v10.36.78.mjs"
if (!(Test-Path $script)) {
  throw "Missing $script. Extract this ZIP into C:\OddEngine first."
}
node $script

Copy-Item -Force (Join-Path $root "files\RUN_HOMIE_VOICE_BRIDGE_DEBUG_CAPTURE_v10.36.78.bat") (Join-Path $root "RUN_HOMIE_VOICE_BRIDGE_DEBUG_CAPTURE_v10.36.78.bat")
Copy-Item -Force (Join-Path $root "files\TEST_HOMIE_VOICE_TRANSCRIPTION_FAILURE_v10.36.78.ps1") (Join-Path $root "TEST_HOMIE_VOICE_TRANSCRIPTION_FAILURE_v10.36.78.ps1")
Copy-Item -Force (Join-Path $root "files\OPEN_HOMIE_VOICE_DEBUG_AUDIO_v10.36.78.bat") (Join-Path $root "OPEN_HOMIE_VOICE_DEBUG_AUDIO_v10.36.78.bat")
Write-Host "[v10.36.78_HomieVoiceTranscriptionFailureReceiptAndAudioCapturePass] Launcher/test scripts copied."