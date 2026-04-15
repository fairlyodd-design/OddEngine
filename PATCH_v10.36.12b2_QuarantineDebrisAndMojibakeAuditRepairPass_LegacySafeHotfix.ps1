param(
  [switch]$NoPause
)

$ErrorActionPreference = "Stop"

function Resolve-OddEngineRoot {
  $candidates = @()
  if ($PSScriptRoot) { $candidates += $PSScriptRoot }
  if ($PSCommandPath) { $candidates += (Split-Path -Parent $PSCommandPath) }
  if ($MyInvocation.MyCommand.Path) { $candidates += (Split-Path -Parent $MyInvocation.MyCommand.Path) }
  $candidates += (Get-Location).Path

  foreach ($candidate in $candidates) {
    if (-not $candidate) { continue }
    $dir = [System.IO.Path]::GetFullPath($candidate)
    for ($i = 0; $i -lt 6; $i++) {
      if ((Test-Path (Join-Path $dir "package.json")) -and (Test-Path (Join-Path $dir "ui\src"))) {
        return $dir
      }
      $parent = Split-Path -Parent $dir
      if (-not $parent -or $parent -eq $dir) { break }
      $dir = $parent
    }
  }

  throw "Could not resolve OddEngine root. Run this from C:\OddEngine."
}

$root = Resolve-OddEngineRoot
Set-Location $root

Write-Host "[OddEngine] v10.36.12b2 Legacy-safe quarantine/debris/mojibake repair"
Write-Host "--------------------------------------------------------------------"
Write-Host "[OddEngine] Root: $root"

$scriptPath = Join-Path $root "scripts\v10.36.12b2_cleanup_audit.mjs"
if (-not (Test-Path $scriptPath)) {
  throw "Missing cleanup script: $scriptPath"
}

node $scriptPath
$exitCode = $LASTEXITCODE

if ($exitCode -eq 0) {
  Write-Host ""
  Write-Host "v10.36.12b2 cleanup/audit pass completed cleanly."
} else {
  Write-Host ""
  Write-Host "v10.36.12b2 cleanup/audit pass found issues. See checkpoints folder for the report."
}

if (-not $NoPause) {
  Write-Host ""
  Write-Host "Press any key to continue . . ."
  $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

exit $exitCode
