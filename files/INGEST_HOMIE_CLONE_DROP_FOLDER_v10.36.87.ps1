$ErrorActionPreference = "Stop"

$root = (Get-Location).Path
$drop = Join-Path $root "backend_scaffold\homie_clone_ingest_drop"
$bankPath = Join-Path $root "backend_scaffold\homie_clone_memory_bank.v1.json"

if (!(Test-Path $drop)) {
  throw "Missing drop folder: $drop"
}

if (!(Test-Path $bankPath)) {
  $seed = @{
    schema = "oddengine.homie.clone-memory-bank.v1"
    updatedAt = (Get-Date).ToString("o")
    entries = @()
  } | ConvertTo-Json -Depth 8
  Set-Content -Path $bankPath -Value $seed -Encoding UTF8
}

$bank = Get-Content $bankPath -Raw | ConvertFrom-Json
if ($null -eq $bank.entries) { $bank | Add-Member -NotePropertyName entries -NotePropertyValue @() -Force }

$files = Get-ChildItem -Path $drop -File -Include *.txt,*.md,*.json -Recurse
$added = 0

foreach ($file in $files) {
  $raw = Get-Content $file.FullName -Raw
  if ([string]::IsNullOrWhiteSpace($raw)) { continue }

  $title = [System.IO.Path]::GetFileNameWithoutExtension($file.Name)
  $tags = @()
  if ($file.DirectoryName -ne $drop) {
    $relativeDir = $file.DirectoryName.Substring($drop.Length).Trim("\")
    if ($relativeDir) {
      $tags = $relativeDir -split "[\\/]" | Where-Object { $_ -and $_.Trim() }
    }
  }

  $entry = [ordered]@{
    id = ("mem-" + [guid]::NewGuid().ToString("N").Substring(0,12))
    createdAt = (Get-Date).ToString("o")
    title = $title
    text = ($raw -replace "\r\n", "`n").Trim()
    summary = (($raw -replace "\r\n", " " -replace "\s+", " ").Trim()).Substring(0, [Math]::Min(220, (($raw -replace "\r\n", " " -replace "\s+", " ").Trim()).Length))
    sourceType = "drop-folder"
    sourcePath = $file.FullName
    tags = $tags
    metadata = [ordered]@{
      bytes = $file.Length
      extension = $file.Extension
    }
  }

  $bank.entries += $entry
  $added++
}

$bank.updatedAt = (Get-Date).ToString("o")
$bank | ConvertTo-Json -Depth 12 | Set-Content -Path $bankPath -Encoding UTF8

Write-Host "Added $added memory entries to:"
Write-Host $bankPath
