$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
Write-Host "[v10.36.75_HomieSTTAudioCleanupNormalizeAndAccuracyLaunchersPass] Applying from $root"
$srcTranscriber = Join-Path $root "filesackend_scaffold\homie_voice_transcribe.py"
$dstTranscriber = Join-Path $root "backend_scaffold\homie_voice_transcribe.py"
if (!(Test-Path $srcTranscriber)) { throw "Missing $srcTranscriber. Extract this ZIP into C:\OddEngine first." }
if (!(Test-Path $dstTranscriber)) { throw "Missing $dstTranscriber. Run from C:\OddEngine." }
$backup = "$dstTranscriber.bak_v10.36.75"
if (!(Test-Path $backup)) { Copy-Item $dstTranscriber $backup; Write-Host "Backup created: $backup" }
Copy-Item -Force $srcTranscriber $dstTranscriber
Copy-Item -Force (Join-Path $root "files\RUN_HOMIE_VOICE_BRIDGE_AUDIO_CLEANUP_v10.36.75.bat") (Join-Path $root "RUN_HOMIE_VOICE_BRIDGE_AUDIO_CLEANUP_v10.36.75.bat")
Copy-Item -Force (Join-Path $root "files\RUN_HOMIE_VOICE_BRIDGE_AUDIO_CLEANUP_MAX_v10.36.75.bat") (Join-Path $root "RUN_HOMIE_VOICE_BRIDGE_AUDIO_CLEANUP_MAX_v10.36.75.bat")
Write-Host "[v10.36.75_HomieSTTAudioCleanupNormalizeAndAccuracyLaunchersPass] Applied."
