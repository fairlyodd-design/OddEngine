param()

$ErrorActionPreference = "Stop"

function Resolve-OddRoot {
  $candidates = @()
  if ($PSScriptRoot) { $candidates += $PSScriptRoot }
  if ($PWD) { $candidates += $PWD.Path }
  if ($PSScriptRoot) { $candidates += (Split-Path -Parent $PSScriptRoot) }
  foreach ($base in $candidates) {
    if (-not $base) { continue }
    $current = [System.IO.Path]::GetFullPath($base)
    for ($i = 0; $i -lt 6; $i++) {
      if ((Test-Path (Join-Path $current "package.json")) -and (Test-Path (Join-Path $current "ui\src"))) {
        return $current
      }
      $parent = Split-Path -Parent $current
      if (-not $parent -or $parent -eq $current) { break }
      $current = $parent
    }
  }
  throw "Could not resolve OddEngine root. Run this from C:\OddEngine."
}

$root = Resolve-OddRoot
Set-Location $root

$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$checkpointDir = Join-Path $root "checkpoints\v10.36.12b_QuarantineDebrisAndMojibakeAuditRepairPass_$stamp"
$quarantineDir = Join-Path $checkpointDir "quarantine"
New-Item -ItemType Directory -Force -Path $checkpointDir, $quarantineDir | Out-Null

$report = New-Object System.Collections.Generic.List[string]
$report.Add("[OddEngine] v10.36.12b Quarantine Debris + Mojibake Audit Repair")
$report.Add("[OddEngine] Root: $root")
$report.Add("")

function Move-ToQuarantine {
  param(
    [Parameter(Mandatory=$true)][string]$PathToMove,
    [Parameter(Mandatory=$true)][string]$Reason
  )
  if (-not (Test-Path -LiteralPath $PathToMove)) { return $false }
  $relative = [System.IO.Path]::GetRelativePath($root, $PathToMove)
  $safeRelative = $relative -replace "[:]", "_"
  $dest = Join-Path $quarantineDir $safeRelative
  $destParent = Split-Path -Parent $dest
  New-Item -ItemType Directory -Force -Path $destParent | Out-Null
  Move-Item -LiteralPath $PathToMove -Destination $dest -Force
  $report.Add("QUARANTINED [$Reason]: $relative -> $([System.IO.Path]::GetRelativePath($root, $dest))")
  return $true
}

$uiSrc = Join-Path $root "ui\src"
$duplicateTree = Join-Path $uiSrc "components\ui\src"

if (Test-Path -LiteralPath $duplicateTree) {
  Move-ToQuarantine -PathToMove $duplicateTree -Reason "duplicate nested ui/src tree" | Out-Null
} else {
  $report.Add("OK: duplicate nested ui/src tree not present.")
}

$patchCandidates = @()
if (Test-Path -LiteralPath $uiSrc) {
  $patchCandidates = Get-ChildItem -LiteralPath $uiSrc -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object {
      $rel = [System.IO.Path]::GetRelativePath($uiSrc, $_.FullName)
      ($_.Name -match "(?i)patch") -or ($rel -match "(?i)(^|[\\/]).*PATCH.*\.(ts|tsx|d\.ts)$")
    } |
    Sort-Object FullName
}

$patchCount = 0
foreach ($file in $patchCandidates) {
  if (Test-Path -LiteralPath $file.FullName) {
    if (Move-ToQuarantine -PathToMove $file.FullName -Reason "patch debris under ui/src") {
      $patchCount++
    }
  }
}
$report.Add("Patch debris quarantined: $patchCount file(s).")

$nodeRepairScript = Join-Path $root "scripts\repair-v10.36.12b-mojibake.mjs"
if (Test-Path -LiteralPath $nodeRepairScript) {
  $report.Add("")
  $report.Add("[OddEngine] Running mojibake repair helper...")
  $nodeOut = & node $nodeRepairScript 2>&1
  $nodeExit = $LASTEXITCODE
  foreach ($line in $nodeOut) { $report.Add("[mojibake] $line") }
  if ($nodeExit -ne 0) {
    $report.Add("[OddEngine] Mojibake helper exited with code $nodeExit")
  }
} else {
  $report.Add("WARN: missing $nodeRepairScript")
}

$report.Add("")
$report.Add("[OddEngine] Running npm run audit:runtime...")
$auditOut = & npm run audit:runtime 2>&1
$auditExit = $LASTEXITCODE
foreach ($line in $auditOut) { $report.Add("[audit] $line") }

$report.Add("")
$report.Add("[OddEngine] Running npm run build:web...")
$buildOut = & npm run build:web 2>&1
$buildExit = $LASTEXITCODE
foreach ($line in $buildOut) { $report.Add("[build] $line") }

$report.Add("")
$report.Add("auditExit=$auditExit")
$report.Add("buildExit=$buildExit")

$reportPath = Join-Path $checkpointDir "RUNTIME_AUDIT_REPAIR_REPORT.txt"
$report | Set-Content -LiteralPath $reportPath -Encoding UTF8

$manifest = [ordered]@{
  pass = "v10.36.12b_QuarantineDebrisAndMojibakeAuditRepairPass"
  timestamp = $stamp
  root = $root
  duplicateTreeQuarantined = -not (Test-Path -LiteralPath $duplicateTree)
  patchDebrisQuarantined = $patchCount
  auditExit = $auditExit
  buildExit = $buildExit
  report = [System.IO.Path]::GetRelativePath($root, $reportPath)
}
$manifestPath = Join-Path $checkpointDir "checkpoint-manifest.json"
$manifest | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $manifestPath -Encoding UTF8

Write-Host ""
Write-Host "[OddEngine] v10.36.12b cleanup/audit report written:" -ForegroundColor Cyan
Write-Host "  $([System.IO.Path]::GetRelativePath($root, $reportPath))"
Write-Host ""
if ($auditExit -eq 0 -and $buildExit -eq 0) {
  Write-Host "[OddEngine] v10.36.12b audit/build passed." -ForegroundColor Green
  Write-Host "Next: run v10.36.12 again to create the clean checkpoint/tag once git is clean."
} else {
  Write-Host "[OddEngine] v10.36.12b still found blocking issues." -ForegroundColor Yellow
  Write-Host "Open the report above and paste the first TypeScript/Vite error."
}

exit ([Math]::Max($auditExit, $buildExit))
