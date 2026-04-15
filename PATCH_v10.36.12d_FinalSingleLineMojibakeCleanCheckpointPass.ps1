param(
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

function Find-Root {
  $candidates = @()
  if ($PSScriptRoot) { $candidates += $PSScriptRoot }
  $candidates += (Get-Location).Path
  $candidates += "C:\OddEngine"
  foreach ($base in $candidates) {
    if (-not $base) { continue }
    $candidate = $base
    for ($i = 0; $i -lt 6; $i++) {
      if (Test-Path -LiteralPath (Join-Path $candidate "ui\src\styles.css")) {
        return (Resolve-Path -LiteralPath $candidate).Path
      }
      $parent = Split-Path -Parent $candidate
      if (-not $parent -or $parent -eq $candidate) { break }
      $candidate = $parent
    }
  }
  throw "Could not find OddEngine root containing ui\src\styles.css"
}

function Score-Mojibake([string]$Text) {
  if ($null -eq $Text) { return 0 }
  $score = 0
  $markers = @(
    [char]0x00C3,
    [char]0x00C2,
    [char]0x00A2,
    [char]0x00A6,
    [char]0x00B0,
    [char]0x00A4,
    [char]0x008F,
    [char]0x009D
  )
  foreach ($m in $markers) {
    $score += ([regex]::Matches($Text, [regex]::Escape([string]$m))).Count
  }
  return $score
}

$root = Find-Root
$stylesPath = Join-Path $root "ui\src\styles.css"
$checkpointRoot = Join-Path $root "checkpoints"
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$checkpoint = Join-Path $checkpointRoot "v10.36.12d_FinalSingleLineMojibakeCleanCheckpointPass_$stamp"
New-Item -ItemType Directory -Force -Path $checkpoint | Out-Null

Write-Host "[OddEngine] v10.36.12d Final Single-Line Mojibake Clean Checkpoint"
Write-Host "[OddEngine] Root: $root"
Write-Host "[OddEngine] Checkpoint: $checkpoint"

$text = [System.IO.File]::ReadAllText($stylesPath, [System.Text.Encoding]::UTF8)
$beforeScore = Score-Mojibake $text
Write-Host "[OddEngine] styles.css mojibake score before: $beforeScore"

$backup = Join-Path $checkpoint "styles.css.before_12d.bak"
[System.IO.File]::WriteAllText($backup, $text, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "[OddEngine] Backup written: $backup"

$lines = $text -split "`r?`n", -1
$changed = 0

for ($i = 0; $i -lt $lines.Count; $i++) {
  $line = $lines[$i]
  $lineScore = Score-Mojibake $line
  if ($line -match "Big emote FX") {
    $lines[$i] = "/* Big emote FX (fist bump / celebrate / alert / facepalm) */"
    if ($lines[$i] -ne $line) {
      $changed++
      Write-Host ("  - repaired Big emote FX comment on line {0}: score {1} -> 0" -f ($i + 1), $lineScore)
    }
  }
}

$newText = [string]::Join("`n", $lines)
[System.IO.File]::WriteAllText($stylesPath, $newText, (New-Object System.Text.UTF8Encoding($false)))
$afterScore = Score-Mojibake $newText
Write-Host "[OddEngine] styles.css rewritten as UTF-8 without BOM. Changed lines: $changed"
Write-Host "[OddEngine] styles.css mojibake score after: $afterScore"

$remainingReport = Join-Path $checkpoint "styles_mojibake_remaining_lines.txt"
if ($afterScore -gt 0) {
  $postLines = $newText -split "`r?`n", -1
  $postRemaining = New-Object System.Collections.Generic.List[string]
  for ($i = 0; $i -lt $postLines.Count; $i++) {
    $s = Score-Mojibake $postLines[$i]
    if ($s -gt 0) { $postRemaining.Add(("line {0} score {1}: {2}" -f ($i + 1), $s, $postLines[$i])) | Out-Null }
  }
  [System.IO.File]::WriteAllLines($remainingReport, $postRemaining, (New-Object System.Text.UTF8Encoding($false)))
  Write-Host "[OddEngine] Remaining marker report: $remainingReport"
}

$reportPath = Join-Path $checkpoint "RUNTIME_AUDIT_REPORT.txt"
$manifestPath = Join-Path $checkpoint "checkpoint-manifest.json"
$report = New-Object System.Collections.Generic.List[string]
$report.Add("[OddEngine] v10.36.12d_FinalSingleLineMojibakeCleanCheckpointPass") | Out-Null
$report.Add("[OddEngine] Root: $root") | Out-Null
$report.Add("[OddEngine] Checkpoint: $checkpoint") | Out-Null
$report.Add("[OddEngine] styles.css mojibake score before: $beforeScore") | Out-Null
$report.Add("[OddEngine] styles.css mojibake score after: $afterScore") | Out-Null
$report.Add("[OddEngine] Changed lines: $changed") | Out-Null

$blocking = $false
if (-not $SkipBuild) {
  Push-Location $root
  try {
    Write-Host ""
    Write-Host "[OddEngine] Running npm run audit:runtime..."
    $auditOut = & npm run audit:runtime 2>&1
    $auditCode = $LASTEXITCODE
    $auditOut | ForEach-Object { Write-Host $_ }
    $report.Add("") | Out-Null
    $report.Add("[OddEngine] npm run audit:runtime exit code: $auditCode") | Out-Null
    foreach ($line in $auditOut) { $report.Add([string]$line) | Out-Null }
    if ($auditCode -ne 0) { $blocking = $true }

    Write-Host ""
    Write-Host "[OddEngine] Running npm run build:web..."
    $buildOut = & npm run build:web 2>&1
    $buildCode = $LASTEXITCODE
    $buildOut | ForEach-Object { Write-Host $_ }
    $report.Add("") | Out-Null
    $report.Add("[OddEngine] npm run build:web exit code: $buildCode") | Out-Null
    foreach ($line in $buildOut) { $report.Add([string]$line) | Out-Null }
    if ($buildCode -ne 0) { $blocking = $true }
  } finally {
    Pop-Location
  }
}

if ($afterScore -gt 0) { $blocking = $true }
$status = if ($blocking) { "blocked" } else { "clean" }
$report.Add("") | Out-Null
$report.Add("[OddEngine] Status: $status") | Out-Null
[System.IO.File]::WriteAllLines($reportPath, $report, (New-Object System.Text.UTF8Encoding($false)))

$manifestObj = [ordered]@{
  pass = "v10.36.12d_FinalSingleLineMojibakeCleanCheckpointPass"
  root = $root
  checkpointDir = $checkpoint
  timestamp = (Get-Date).ToString("o")
  status = $status
  styles = @{
    before = $beforeScore
    after = $afterScore
    changedLines = $changed
    backup = $backup
    remainingReport = $(if ($afterScore -gt 0) { $remainingReport } else { $null })
  }
}
$manifestJson = $manifestObj | ConvertTo-Json -Depth 6
[System.IO.File]::WriteAllText($manifestPath, $manifestJson, (New-Object System.Text.UTF8Encoding($false)))

Write-Host ""
Write-Host "[OddEngine] Report written: $reportPath"
Write-Host "[OddEngine] Manifest written: $manifestPath"
if ($blocking) {
  Write-Host "[OddEngine] Blocking issue(s) remain. Do not tag yet."
  exit 1
}
Write-Host "[OddEngine] Clean checkpoint ready. You can tag v10.36.12-clean after reviewing git status."
exit 0
