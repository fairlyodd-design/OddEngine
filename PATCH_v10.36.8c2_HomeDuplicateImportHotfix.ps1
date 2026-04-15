$ErrorActionPreference = 'Stop'

function Resolve-RepoRoot {
  $candidates = @()
  if ($PSScriptRoot) { $candidates += $PSScriptRoot }
  if ($PSCommandPath) { $candidates += (Split-Path -Parent $PSCommandPath) }
  $candidates += (Get-Location).Path
  $candidates += 'C:\OddEngine'

  foreach ($base in $candidates) {
    if (-not $base) { continue }
    $trimmed = $base.TrimEnd('\\','/')
    $direct = $trimmed
    $child = Join-Path $trimmed 'OddEngine'

    foreach ($root in @($direct, $child)) {
      if (-not $root) { continue }
      $homePath = Join-Path $root 'ui\src\panels\Home.tsx'
      if (Test-Path -LiteralPath $homePath) {
        return $root
      }
    }
  }

  throw 'Could not locate OddEngine root containing ui\\src\\panels\\Home.tsx'
}

$repoRoot = Resolve-RepoRoot
$homePath = Join-Path $repoRoot 'ui\src\panels\Home.tsx'
$text = Get-Content -Raw -LiteralPath $homePath

$normalizedImport = 'import { getOperatorBrainSnapshot, runOperatorBrainNextAction } from "../lib/operatorBrain";'

# Remove every existing operatorBrain import line so we can reinsert exactly one clean copy.
$lines = ($text -replace "`r", '') -split "`n"
$filtered = New-Object System.Collections.Generic.List[string]
foreach ($line in $lines) {
  if ($line -like '*from "../lib/operatorBrain";*') { continue }
  [void]$filtered.Add($line)
}

$insertIndex = -1
for ($i = 0; $i -lt $filtered.Count; $i++) {
  if ($filtered[$i] -like '*from "../lib/marketDataPhoenix";*') {
    $insertIndex = $i + 1
    break
  }
}
if ($insertIndex -lt 0) {
  for ($i = $filtered.Count - 1; $i -ge 0; $i--) {
    if ($filtered[$i] -match '^\s*import\s+') {
      $insertIndex = $i + 1
      break
    }
  }
}
if ($insertIndex -lt 0) {
  throw 'Could not find import block anchor in Home.tsx'
}

$final = New-Object System.Collections.Generic.List[string]
for ($i = 0; $i -lt $filtered.Count; $i++) {
  [void]$final.Add($filtered[$i])
  if ($i -eq ($insertIndex - 1)) {
    [void]$final.Add($normalizedImport)
  }
}

$finalText = ($final -join "`r`n")
Set-Content -LiteralPath $homePath -Value $finalText -Encoding UTF8

Write-Host 'Patched Home.tsx successfully for v10.36.8c2.'
Write-Host 'Restart OddEngine now.'
