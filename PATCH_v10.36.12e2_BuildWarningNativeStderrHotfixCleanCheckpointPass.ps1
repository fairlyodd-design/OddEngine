$ErrorActionPreference = "Stop"

function Resolve-OddRoot {
  $here = $PSScriptRoot
  if (-not $here -or $here.Trim().Length -eq 0) { $here = (Get-Location).Path }
  $candidate = $here
  while ($candidate -and $candidate.Length -gt 3) {
    if ((Test-Path (Join-Path $candidate "package.json")) -and (Test-Path (Join-Path $candidate "ui"))) { return $candidate }
    $parent = Split-Path -Parent $candidate
    if ($parent -eq $candidate) { break }
    $candidate = $parent
  }
  if ((Test-Path "C:\OddEngine\package.json") -and (Test-Path "C:\OddEngine\ui")) { return "C:\OddEngine" }
  throw "Could not locate OddEngine root. Run this from C:\OddEngine."
}

function New-Dir($Path) { if (-not (Test-Path $Path)) { New-Item -ItemType Directory -Force -Path $Path | Out-Null } }

function Count-MojibakeScore($Path) {
  if (-not (Test-Path $Path)) { return 9999 }
  $text = [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8)
  $score = 0
  $markers = @([char]0x00C3, [char]0x00C2, [char]0x00E2, [char]0x00F0)
  foreach ($m in $markers) { $score += ([regex]::Matches($text, [regex]::Escape([string]$m))).Count }
  return $score
}

function Invoke-NativeCommandSafe {
  param([string]$Command,[string]$WorkingDirectory,[string]$StdoutPath,[string]$StderrPath)
  if (Test-Path $StdoutPath) { Remove-Item -Force $StdoutPath }
  if (Test-Path $StderrPath) { Remove-Item -Force $StderrPath }

  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = "cmd.exe"
  $psi.Arguments = "/d /c " + $Command
  $psi.WorkingDirectory = $WorkingDirectory
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $true

  $p = New-Object System.Diagnostics.Process
  $p.StartInfo = $psi
  [void]$p.Start()
  $stdout = $p.StandardOutput.ReadToEnd()
  $stderr = $p.StandardError.ReadToEnd()
  $p.WaitForExit()

  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($StdoutPath, $stdout, $utf8NoBom)
  [System.IO.File]::WriteAllText($StderrPath, $stderr, $utf8NoBom)

  return @{ ExitCode = $p.ExitCode; Stdout = $stdout; Stderr = $stderr }
}

$root = Resolve-OddRoot
Set-Location $root
$passName = "v10.36.12e2_BuildWarningNativeStderrHotfixCleanCheckpointPass"
$stamp = (Get-Date).ToString("yyyyMMdd_HHmmss")
$checkpoint = Join-Path $root ("checkpoints\" + $passName + "_" + $stamp)
New-Dir $checkpoint

$reportPath = Join-Path $checkpoint "RUNTIME_AUDIT_REPORT.txt"
$manifestPath = Join-Path $checkpoint "checkpoint-manifest.json"
$auditOut = Join-Path $checkpoint "audit_runtime.stdout.txt"
$auditErr = Join-Path $checkpoint "audit_runtime.stderr.txt"
$buildOut = Join-Path $checkpoint "build_web.stdout.txt"
$buildErr = Join-Path $checkpoint "build_web.stderr.txt"

$report = New-Object System.Collections.Generic.List[string]
function Log($s) { $script:report.Add($s); Write-Host $s }

$blockers = New-Object System.Collections.Generic.List[string]
$warnings = New-Object System.Collections.Generic.List[string]

Log "[OddEngine] v10.36.12e2 Build Warning Native-Stderr Hotfix Clean Checkpoint"
Log "--------------------------------------------------------------------------"
Log "[OddEngine] Root: $root"
Log "[OddEngine] Checkpoint: $checkpoint"

$duplicateTree = Join-Path $root "ui\src\components\ui\src"
if (Test-Path $duplicateTree) {
  $blockers.Add("Duplicate nested source tree still exists: ui/src/components/ui/src")
  Log "[OddEngine] Duplicate nested source tree: PRESENT"
} else { Log "[OddEngine] Duplicate nested source tree not present." }

$srcRoot = Join-Path $root "ui\src"
$patchDebris = @()
if (Test-Path $srcRoot) {
  $patchDebris = Get-ChildItem -Path $srcRoot -Recurse -File -ErrorAction SilentlyContinue | Where-Object {
    $_.Name -match "PATCH" -and ($_.Extension -match "^\.(ts|tsx|d\.ts)$")
  }
}
if ($patchDebris.Count -gt 0) {
  $blockers.Add("PATCH debris still exists under ui/src: " + $patchDebris.Count)
  Log "[OddEngine] PATCH debris under ui/src: $($patchDebris.Count)"
} else { Log "[OddEngine] No PATCH debris under ui/src." }

$stylesPath = Join-Path $root "ui\src\styles.css"
$mojiScore = Count-MojibakeScore $stylesPath
Log "[OddEngine] styles.css mojibake score: $mojiScore"
if ($mojiScore -ne 0) { $blockers.Add("ui/src/styles.css mojibake score is not zero: $mojiScore") }

Log "[OddEngine] Running npm run audit:runtime..."
$audit = Invoke-NativeCommandSafe -Command "npm run audit:runtime" -WorkingDirectory $root -StdoutPath $auditOut -StderrPath $auditErr
if ($audit.Stdout.Trim().Length -gt 0) { Write-Host $audit.Stdout }
if ($audit.Stderr.Trim().Length -gt 0) { Write-Host $audit.Stderr }
Log "[OddEngine] npm run audit:runtime exit code: $($audit.ExitCode)"
if ($audit.ExitCode -ne 0) { $blockers.Add("npm run audit:runtime failed with exit code $($audit.ExitCode)") }

Log "[OddEngine] Running npm run build:web..."
$build = Invoke-NativeCommandSafe -Command "npm run build:web" -WorkingDirectory $root -StdoutPath $buildOut -StderrPath $buildErr
if ($build.Stdout.Trim().Length -gt 0) { Write-Host $build.Stdout }
if ($build.Stderr.Trim().Length -gt 0) { Write-Host $build.Stderr }
Log "[OddEngine] npm run build:web exit code: $($build.ExitCode)"

$combinedBuild = ($build.Stdout + "`n" + $build.Stderr)
if ($combinedBuild -match "Circular chunk:") {
  $warnings.Add("Circular chunk warnings detected but treated as non-blocking when build exit code is 0.")
  Log "[OddEngine] Non-blocking warning: circular chunk warning detected."
}
if ($build.ExitCode -ne 0) { $blockers.Add("npm run build:web failed with exit code $($build.ExitCode)") }

$gitAvailable = $false
$gitClean = $false
try {
  $gitProbe = Invoke-NativeCommandSafe -Command "git status --porcelain" -WorkingDirectory $root -StdoutPath (Join-Path $checkpoint "git_status.stdout.txt") -StderrPath (Join-Path $checkpoint "git_status.stderr.txt")
  if ($gitProbe.ExitCode -eq 0) {
    $gitAvailable = $true
    if ($gitProbe.Stdout.Trim().Length -eq 0) { $gitClean = $true }
  }
} catch {}
if ($gitAvailable) {
  if ($gitClean) { Log "[OddEngine] Git working tree is clean." }
  else { $warnings.Add("Git working tree has local changes. Commit before tagging."); Log "[OddEngine] Git working tree has local changes. Commit before tagging." }
} else {
  $warnings.Add("Git status unavailable.")
  Log "[OddEngine] Git status unavailable."
}

$status = "passed"
if ($blockers.Count -gt 0) { $status = "blocked" }

Log ""
if ($status -eq "passed") {
  Log "[OddEngine] CLEAN CHECKPOINT PASSED."
  Log "[OddEngine] Safe to commit/tag after reviewing git status."
  Log "[OddEngine] Suggested tag after commit: v10.36.12-clean"
} else {
  Log "[OddEngine] Blocking issue(s) remain. Do not tag yet."
  foreach ($b in $blockers) { Log "  - $b" }
}
if ($warnings.Count -gt 0) {
  Log "[OddEngine] Warning(s):"
  foreach ($w in $warnings) { Log "  - $w" }
}

$manifest = [ordered]@{
  pass = $passName
  root = $root
  checkpointDir = $checkpoint
  timestamp = (Get-Date).ToUniversalTime().ToString("o")
  status = $status
  blockers = @($blockers)
  warnings = @($warnings)
  styles = @{ mojibakeScore = $mojiScore }
  audit = @{ exitCode = $audit.ExitCode; stdout = "audit_runtime.stdout.txt"; stderr = "audit_runtime.stderr.txt" }
  build = @{ exitCode = $build.ExitCode; stdout = "build_web.stdout.txt"; stderr = "build_web.stderr.txt"; circularChunkWarningsNonBlocking = $true }
  git = @{ available = $gitAvailable; clean = $gitClean }
}
$manifest | ConvertTo-Json -Depth 8 | Out-File -FilePath $manifestPath -Encoding utf8
$report | Out-File -FilePath $reportPath -Encoding utf8
Log "[OddEngine] Report written: $reportPath"
Log "[OddEngine] Manifest written: $manifestPath"

if ($status -ne "passed") { exit 1 }
exit 0
