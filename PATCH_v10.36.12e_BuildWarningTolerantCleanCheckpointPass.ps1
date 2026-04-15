param()

$ErrorActionPreference = "Stop"

function Write-Step($msg) {
  Write-Host "[OddEngine] $msg"
}

function Get-RepoRoot {
  $scriptRoot = $PSScriptRoot
  if ([string]::IsNullOrWhiteSpace($scriptRoot)) {
    $scriptRoot = (Get-Location).Path
  }

  $candidate = $scriptRoot
  while ($candidate -and -not (Test-Path -LiteralPath (Join-Path $candidate "ui\src\styles.css"))) {
    $parent = Split-Path -Parent $candidate
    if ($parent -eq $candidate) { break }
    $candidate = $parent
  }

  if (-not (Test-Path -LiteralPath (Join-Path $candidate "ui\src\styles.css"))) {
    throw "Could not find OddEngine root from $scriptRoot. Run this from C:\OddEngine."
  }

  return $candidate
}

function Get-MojibakeScore([string]$Text) {
  $markers = @([char]0x00C3, [char]0x00C2, [char]0x00E2, [char]0x00F0)
  $score = 0
  foreach ($m in $markers) {
    $score += ([regex]::Matches($Text, [regex]::Escape([string]$m))).Count
  }
  return $score
}

function Run-CmdTolerant([string]$Label, [string]$Command, [string]$LogPath, [string]$Root) {
  Write-Step "Running $Label..."
  Push-Location $Root
  try {
    cmd.exe /d /c $Command > $LogPath 2>&1
    $exit = $LASTEXITCODE
  } finally {
    Pop-Location
  }

  if (Test-Path -LiteralPath $LogPath) {
    Get-Content -LiteralPath $LogPath | ForEach-Object { Write-Host $_ }
  }

  Write-Step "$Label exit code: $exit"
  return $exit
}

$Root = Get-RepoRoot
$PassName = "v10.36.12e_BuildWarningTolerantCleanCheckpointPass"
$Stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$Checkpoint = Join-Path $Root ("checkpoints\" + $PassName + "_" + $Stamp)
New-Item -ItemType Directory -Force -Path $Checkpoint | Out-Null

Write-Host "[OddEngine] v10.36.12e Build-Warning-Tolerant Clean Checkpoint"
Write-Host "----------------------------------------------------------------"
Write-Step "Root: $Root"
Write-Step "Checkpoint: $Checkpoint"

$Blockers = New-Object System.Collections.Generic.List[string]
$Warnings = New-Object System.Collections.Generic.List[string]

$duplicateTree = Join-Path $Root "ui\src\components\ui\src"
if (Test-Path -LiteralPath $duplicateTree) {
  $Blockers.Add("Duplicate nested source tree still exists: ui/src/components/ui/src")
} else {
  Write-Step "Duplicate nested source tree not present."
}

$patchDebris = @()
$srcRoot = Join-Path $Root "ui\src"
if (Test-Path -LiteralPath $srcRoot) {
  $patchDebris = Get-ChildItem -LiteralPath $srcRoot -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match "PATCH" -and $_.Extension -match "^\.(ts|tsx|d\.ts)$" }
}
if ($patchDebris.Count -gt 0) {
  $Blockers.Add("Patch debris under ui/src remains: " + $patchDebris.Count + " file(s)")
} else {
  Write-Step "No PATCH debris under ui/src."
}

$stylesPath = Join-Path $Root "ui\src\styles.css"
$stylesText = [System.IO.File]::ReadAllText($stylesPath)
$styleScore = Get-MojibakeScore $stylesText
Write-Step "styles.css mojibake score: $styleScore"
if ($styleScore -gt 0) {
  $Blockers.Add("ui/src/styles.css still contains possible mojibake markers (score $styleScore)")
}

$auditLog = Join-Path $Checkpoint "audit-runtime.log"
$buildLog = Join-Path $Checkpoint "build-web.log"

$auditExit = Run-CmdTolerant "npm run audit:runtime" "npm run audit:runtime" $auditLog $Root
if ($auditExit -ne 0) {
  $Blockers.Add("npm run audit:runtime failed with exit code $auditExit")
}

$buildExit = Run-CmdTolerant "npm run build:web" "npm run build:web" $buildLog $Root
if ($buildExit -ne 0) {
  $Blockers.Add("npm run build:web failed with exit code $buildExit")
}

$buildText = ""
if (Test-Path -LiteralPath $buildLog) {
  $buildText = [System.IO.File]::ReadAllText($buildLog)
}
if ($buildText -match "Circular chunk:") {
  $Warnings.Add("Vite/Rollup circular chunk warning detected. Build exit code was $buildExit, so this is non-blocking for this checkpoint.")
}

$gitStatus = ""
try {
  Push-Location $Root
  $gitStatus = (cmd.exe /d /c "git status --short" 2>$null) -join "`n"
  Pop-Location
} catch {
  $gitStatus = "git status unavailable"
}
[System.IO.File]::WriteAllText((Join-Path $Checkpoint "git-status-short.txt"), $gitStatus, (New-Object System.Text.UTF8Encoding($false)))

$status = "blocked"
if ($Blockers.Count -eq 0) {
  $status = "clean"
}

$report = New-Object System.Collections.Generic.List[string]
$report.Add("[OddEngine] $PassName")
$report.Add("Root: $Root")
$report.Add("Checkpoint: $Checkpoint")
$report.Add("Status: $status")
$report.Add("")
$report.Add("Checks:")
$report.Add("- Duplicate tree present: " + (Test-Path -LiteralPath $duplicateTree))
$report.Add("- Patch debris count: " + $patchDebris.Count)
$report.Add("- styles.css mojibake score: " + $styleScore)
$report.Add("- audit exit code: " + $auditExit)
$report.Add("- build exit code: " + $buildExit)
$report.Add("")
if ($Warnings.Count -gt 0) {
  $report.Add("Warnings:")
  foreach ($w in $Warnings) { $report.Add("- " + $w) }
  $report.Add("")
}
if ($Blockers.Count -gt 0) {
  $report.Add("Blockers:")
  foreach ($b in $Blockers) { $report.Add("- " + $b) }
} else {
  $report.Add("Blockers: none")
  $report.Add("")
  $report.Add("Clean checkpoint is ready.")
  $report.Add("Recommended next commands after deleting/ignoring runner files:")
  $report.Add("  git add ui/src/styles.css checkpoints")
  $report.Add("  git commit -m ""v10.36.12 clean runtime checkpoint""")
  $report.Add("  git tag v10.36.12-clean")
  $report.Add("  git push origin main --tags")
}
[System.IO.File]::WriteAllText((Join-Path $Checkpoint "RUNTIME_AUDIT_REPORT.txt"), ($report -join "`r`n"), (New-Object System.Text.UTF8Encoding($false)))

$manifest = @{
  pass = $PassName
  root = $Root
  checkpointDir = $Checkpoint
  timestamp = (Get-Date).ToUniversalTime().ToString("o")
  status = $status
  blockers = @($Blockers)
  warnings = @($Warnings)
  styles = @{
    mojibakeScore = $styleScore
  }
  commands = @{
    auditRuntimeExitCode = $auditExit
    buildWebExitCode = $buildExit
  }
}
$manifestJson = $manifest | ConvertTo-Json -Depth 8
[System.IO.File]::WriteAllText((Join-Path $Checkpoint "checkpoint-manifest.json"), $manifestJson, (New-Object System.Text.UTF8Encoding($false)))

Write-Host ""
if ($Blockers.Count -eq 0) {
  Write-Step "CLEAN CHECKPOINT PASSED."
  if ($Warnings.Count -gt 0) {
    Write-Step "Non-blocking warning(s) recorded:"
    foreach ($w in $Warnings) { Write-Host "  - $w" }
  }
  Write-Step "Report written: $(Join-Path $Checkpoint "RUNTIME_AUDIT_REPORT.txt")"
  Write-Step "Manifest written: $(Join-Path $Checkpoint "checkpoint-manifest.json")"
  exit 0
}

Write-Step "Blocking issue(s) remain. Do not tag yet."
foreach ($b in $Blockers) { Write-Host "  - $b" }
Write-Step "Report written: $(Join-Path $Checkpoint "RUNTIME_AUDIT_REPORT.txt")"
Write-Step "Manifest written: $(Join-Path $Checkpoint "checkpoint-manifest.json")"
exit 1
