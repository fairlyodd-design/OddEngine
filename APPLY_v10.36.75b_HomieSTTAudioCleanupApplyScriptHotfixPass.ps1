$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
Write-Host "[v10.36.75b_HomieSTTAudioCleanupApplyScriptHotfixPass] Applying from $root"

$srcTranscriber = Join-Path -Path $root -ChildPath 'files\backend_scaffold\homie_voice_transcribe.py'
$dstTranscriber = Join-Path -Path $root -ChildPath 'backend_scaffold\homie_voice_transcribe.py'
$srcBalanced = Join-Path -Path $root -ChildPath 'files\RUN_HOMIE_VOICE_BRIDGE_AUDIO_CLEANUP_v10.36.75.bat'
$srcMax = Join-Path -Path $root -ChildPath 'files\RUN_HOMIE_VOICE_BRIDGE_AUDIO_CLEANUP_MAX_v10.36.75.bat'
$dstBalanced = Join-Path -Path $root -ChildPath 'RUN_HOMIE_VOICE_BRIDGE_AUDIO_CLEANUP_v10.36.75.bat'
$dstMax = Join-Path -Path $root -ChildPath 'RUN_HOMIE_VOICE_BRIDGE_AUDIO_CLEANUP_MAX_v10.36.75.bat'

foreach ($p in @($srcTranscriber, $srcBalanced, $srcMax)) {
  if (!(Test-Path -LiteralPath $p)) { throw "Missing $p. Extract this ZIP into C:\OddEngine first." }
}
if (!(Test-Path -LiteralPath $dstTranscriber)) { throw "Missing $dstTranscriber. Run from C:\OddEngine." }

$backup = "$dstTranscriber.bak_v10.36.75b"
if (!(Test-Path -LiteralPath $backup)) {
  Copy-Item -LiteralPath $dstTranscriber -Destination $backup
  Write-Host "Backup created: $backup"
}

Copy-Item -LiteralPath $srcTranscriber -Destination $dstTranscriber -Force
Copy-Item -LiteralPath $srcBalanced -Destination $dstBalanced -Force
Copy-Item -LiteralPath $srcMax -Destination $dstMax -Force

Write-Host "[v10.36.75b] Applied audio-cleanup STT transcriber and launchers."
Write-Host "Created: $dstBalanced"
Write-Host "Created: $dstMax"
