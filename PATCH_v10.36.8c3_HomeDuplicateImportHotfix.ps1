$ErrorActionPreference = "Stop"

$scriptDir = if ($PSScriptRoot) {
  $PSScriptRoot
} elseif ($PSCommandPath) {
  Split-Path -Parent $PSCommandPath
} else {
  (Get-Location).Path
}

$candidates = @(
  (Join-Path $scriptDir "ui\src\panels\Home.tsx"),
  (Join-Path $scriptDir "OddEngine\ui\src\panels\Home.tsx"),
  "C:\OddEngine\ui\src\panels\Home.tsx"
) | Select-Object -Unique

$homePath = $candidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $homePath) {
  throw "Could not find ui\src\panels\Home.tsx. Checked:`n - $($candidates -join "`n - ")"
}

$lines = [System.Collections.Generic.List[string]]::new()
Get-Content -LiteralPath $homePath | ForEach-Object { [void]$lines.Add($_) }

$normalizedImport = 'import { getOperatorBrainSnapshot, runOperatorBrainNextAction } from "../lib/operatorBrain";'

for ($i = $lines.Count - 1; $i -ge 0; $i--) {
  if ($lines[$i] -match '^\s*import\s+\{.*\}\s+from\s+"../lib/operatorBrain";\s*$') {
    $lines.RemoveAt($i)
  }
}

$insertAt = -1
for ($i = 0; $i -lt $lines.Count; $i++) {
  if ($lines[$i] -like '*marketDataPhoenix*') {
    $insertAt = $i + 1
    break
  }
}

if ($insertAt -lt 0) {
  $lastImport = -1
  for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match '^\s*import\s+') {
      $lastImport = $i
    } elseif ($lastImport -ge 0) {
      break
    }
  }
  if ($lastImport -ge 0) {
    $insertAt = $lastImport + 1
  } else {
    $insertAt = 0
  }
}

$lines.Insert($insertAt, $normalizedImport)

$seenNormalized = $false
for ($i = $lines.Count - 1; $i -ge 0; $i--) {
  if ($lines[$i] -eq $normalizedImport) {
    if (-not $seenNormalized) {
      $seenNormalized = $true
    } else {
      $lines.RemoveAt($i)
    }
  }
}

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllLines($homePath, $lines, $utf8NoBom)

Write-Host "Patched Home.tsx successfully for v10.36.8c3."
Write-Host "Restart OddEngine now."
