$ErrorActionPreference = 'Stop'

function Resolve-RepoRoot {
  $candidates = @()
  if ($PSScriptRoot) { $candidates += $PSScriptRoot }
  if ($PSCommandPath) { $candidates += (Split-Path -Parent $PSCommandPath) }
  try { $candidates += (Get-Location).Path } catch {}

  foreach ($base in $candidates) {
    if (-not $base) { continue }
    $direct = $base
    $child = Join-Path $base 'OddEngine'
    foreach ($candidate in @($direct, $child)) {
      if ((Test-Path (Join-Path $candidate 'ui\src\panels\Home.tsx')) -and (Test-Path (Join-Path $candidate 'ui\src\lib\operatorBrain.ts'))) {
        return $candidate
      }
    }
  }

  throw 'Could not resolve OddEngine repo root.'
}

$repoRoot = Resolve-RepoRoot
$homePath = Join-Path $repoRoot 'ui\src\panels\Home.tsx'
if (-not (Test-Path $homePath)) {
  throw "Could not find Home.tsx at $homePath"
}

$text = Get-Content -Raw -LiteralPath $homePath
$text = $text -replace "`r`n", "`n"

$normalizedImport = 'import { getOperatorBrainSnapshot, runOperatorBrainNextAction } from "../lib/operatorBrain";'

# Remove any existing operatorBrain imports to avoid duplicate identifiers.
$text = [regex]::Replace(
  $text,
  '(?m)^\s*import\s*\{[^\n]*\}\s*from\s*"\.\./lib/operatorBrain";\s*\n?',
  ''
)

if ($text -match 'import \{ PHOENIX_WATCHLIST, topPhoenixSignals \} from "\.\./lib/marketDataPhoenix";') {
  $text = $text -replace 'import \{ PHOENIX_WATCHLIST, topPhoenixSignals \} from "\.\./lib/marketDataPhoenix";', "import { PHOENIX_WATCHLIST, topPhoenixSignals } from \"../lib/marketDataPhoenix\";`n$normalizedImport"
} elseif ($text -match 'import \{ CALENDAR_EVENT, addQuickEvent, listUpcoming, focusCalendarDate, type CalEvent \} from "\.\./lib/calendarStore";') {
  $text = $text -replace 'import \{ CALENDAR_EVENT, addQuickEvent, listUpcoming, focusCalendarDate, type CalEvent \} from "\.\./lib/calendarStore";', "import { CALENDAR_EVENT, addQuickEvent, listUpcoming, focusCalendarDate, type CalEvent } from \"../lib/calendarStore\";`n$normalizedImport"
} else {
  # Fallback: prepend after the React import.
  $text = [regex]::Replace($text, '(?m)^(import React[^\n]*;\n)', "`$1$normalizedImport`n", 1)
}

$text = $text -replace "`n", "`r`n"
Set-Content -LiteralPath $homePath -Value $text -Encoding utf8
Write-Host 'Patched Home.tsx successfully for v10.36.8c.'
Write-Host 'Restart OddEngine now.'
