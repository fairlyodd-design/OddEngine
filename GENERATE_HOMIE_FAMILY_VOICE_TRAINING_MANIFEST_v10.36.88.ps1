$ErrorActionPreference = "Stop"

$root = (Get-Location).Path
$drop = Join-Path $root "backend_scaffold\homie_clone_voice_training_drop"
$manifestPath = Join-Path $root "backend_scaffold\homie_clone_voice_training_manifest.v1.json"

if (!(Test-Path $drop)) {
  throw "Missing training drop folder: $drop"
}

$audioFiles = Get-ChildItem -Path $drop -Recurse -File | Where-Object {
  $_.Extension -match '^\.(wav|mp3|m4a|flac|ogg)$'
}

$samples = @()
foreach ($file in $audioFiles) {
  $sidecar = [System.IO.Path]::ChangeExtension($file.FullName, ".txt")
  $transcript = ""
  if (Test-Path $sidecar) {
    $transcript = (Get-Content $sidecar -Raw).Trim()
  }

  $relative = $file.FullName.Substring($drop.Length).TrimStart('\')
  $tags = @()
  $dir = Split-Path $relative -Parent
  if ($dir) { $tags = $dir -split "[\\/]" | Where-Object { $_ -and $_.Trim() } }

  $preview = if ($transcript.Length -gt 220) { $transcript.Substring(0,220) } else { $transcript }

  $samples += [ordered]@{
    file = $relative
    transcriptFile = if (Test-Path $sidecar) { $sidecar.Substring($drop.Length).TrimStart('\') } else { "" }
    transcriptPreview = $preview
    tags = $tags
    bytes = $file.Length
    consentStatus = "user-supplied-manual-review-required"
  }
}

$manifest = [ordered]@{
  schema = "oddengine.homie.clone-voice-training-manifest.v1"
  updatedAt = (Get-Date).ToString("o")
  sourceDir = $drop
  consentNote = "Only include your own voice or voices from family members who explicitly agree."
  samples = $samples
}

$manifest | ConvertTo-Json -Depth 12 | Set-Content -Path $manifestPath -Encoding UTF8

Write-Host "Manifest updated:"
Write-Host $manifestPath
Write-Host "Samples:" $samples.Count
