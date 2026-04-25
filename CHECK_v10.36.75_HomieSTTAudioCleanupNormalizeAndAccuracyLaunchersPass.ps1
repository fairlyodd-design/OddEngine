$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
Write-Host "[v10.36.75_HomieSTTAudioCleanupNormalizeAndAccuracyLaunchersPass] Checking from $root"
$transcriber = Join-Path $root "backend_scaffold\homie_voice_transcribe.py"
$balanced = Join-Path $root "RUN_HOMIE_VOICE_BRIDGE_AUDIO_CLEANUP_v10.36.75.bat"
$max = Join-Path $root "RUN_HOMIE_VOICE_BRIDGE_AUDIO_CLEANUP_MAX_v10.36.75.bat"
foreach ($p in @($transcriber, $balanced, $max)) { if (!(Test-Path $p)) { throw "Missing $p" } }
$py = Get-Content $transcriber -Raw
if ($py -notlike "*v10.36.75 checker-safe marker*") { throw "Missing v10.36.75 marker in transcriber." }
if ($py -notlike "*preprocess_audio*") { throw "Missing preprocess_audio helper." }
if ($py -notlike "*dynaudnorm*") { throw "Missing ffmpeg normalization filter." }
$b = Get-Content $balanced -Raw
$m = Get-Content $max -Raw
if ($b -notlike "*HOMIE_AUDIO_PREPROCESS=true*") { throw "Balanced launcher missing audio cleanup." }
if ($b -notlike "*HOMIE_WHISPER_MODEL=base.en*") { throw "Balanced launcher missing base.en." }
if ($m -notlike "*HOMIE_WHISPER_MODEL=small.en*") { throw "Max launcher missing small.en." }
Write-Host "[v10.36.75_HomieSTTAudioCleanupNormalizeAndAccuracyLaunchersPass] Check passed."
