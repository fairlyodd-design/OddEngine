$ErrorActionPreference = 'Stop'

function Get-RepoRoot {
  $roots = @()
  if ($PSScriptRoot) { $roots += $PSScriptRoot }
  if ($PSCommandPath) { $roots += [System.IO.Path]::GetDirectoryName($PSCommandPath) }
  $roots += (Get-Location).Path

  foreach ($root in $roots) {
    if (-not $root) { continue }
    $candidates = @($root, (Split-Path -Parent $root))
    foreach ($candidate in $candidates) {
      if (-not $candidate) { continue }
      $stylesPath = Join-Path $candidate 'ui\src\styles.css'
      if (Test-Path -LiteralPath $stylesPath) {
        return $candidate
      }
    }
  }

  throw 'Could not find ui\src\styles.css from patch script location.'
}

$repoRoot = Get-RepoRoot
$stylesPath = Join-Path $repoRoot 'ui\src\styles.css'
$content = Get-Content -Raw -LiteralPath $stylesPath

$markerPattern = '(?s)/\* v10\.36\.10c_START \*/.*?/\* v10\.36\.10c_END \*/\r?\n?'
$content = [regex]::Replace($content, $markerPattern, '')

$block = @'
/* v10.36.10c_START */
.tradingPanelRoot{
  isolation: isolate;
  background: #0a1018 !important;
  background-image: none !important;
}

.tradingPanelRoot .card,
.tradingPanelRoot .softCard,
.tradingPanelRoot .spotlightCard,
.tradingPanelRoot .timelineCard,
.tradingPanelRoot .missionCard,
.tradingPanelRoot .drawerStat,
.tradingPanelRoot .subCard,
.tradingPanelRoot .optionDrawer,
.tradingPanelRoot .tradingLaneCard,
.tradingPanelRoot .heroCard{
  background: #0b1018 !important;
  background-image: none !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  box-shadow: 0 8px 22px rgba(0,0,0,0.22) !important;
  filter: none !important;
}

.tradingPanelRoot > .card,
.tradingPanelRoot .quickActionCard,
.tradingPanelRoot .spotlightCard,
.tradingPanelRoot .softCard,
.tradingPanelRoot .heroCard{
  background: #0d1320 !important;
}

.tradingPanelRoot .tradingLaneChart,
.tradingPanelRoot .tradingLaneSource,
.tradingPanelRoot .tradingLaneContracts,
.tradingPanelRoot .tradingLaneDrawer,
.tradingPanelRoot .tradingLaneTicket,
.tradingPanelRoot .tradingLanePlan{
  background: #091018 !important;
}

.tradingPanelRoot .dataTable th{
  background: #0b1018 !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}

.tradingPanelRoot .tableWrap,
.tradingPanelRoot .optionDrawer,
.tradingPanelRoot .tradingLaneChart,
.tradingPanelRoot .tradingLaneSource,
.tradingPanelRoot .tradingLaneContracts,
.tradingPanelRoot .tradingLaneDrawer,
.tradingPanelRoot .tradingLaneTicket,
.tradingPanelRoot .tradingLanePlan,
.tradingPanelRoot iframe,
.tradingPanelRoot svg,
.tradingPanelRoot .dataTable{
  contain: paint;
  isolation: isolate;
  transform: translateZ(0);
  backface-visibility: hidden;
}

.tradingPanelRoot .card:hover,
.tradingPanelRoot .tabBtn:hover,
.tradingPanelRoot button:hover,
.tradingPanelRoot .timelineCard:hover,
.tradingPanelRoot .missionCard:hover,
.tradingPanelRoot .dataTable tbody tr:hover{
  transform: none !important;
  filter: none !important;
}

.tradingPanelRoot .dataTable tbody tr:hover{
  background: rgba(255,255,255,0.02) !important;
}

.tradingPanelRoot .bestRow,
.tradingPanelRoot .dataTable tbody tr.selected{
  background: rgba(96,165,250,0.10) !important;
}

.tradingPanelRoot .badge,
.tradingPanelRoot .assistantChipWrap{
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}

@media (prefers-reduced-motion: no-preference){
  .tradingPanelRoot .card,
  .tradingPanelRoot .tabBtn,
  .tradingPanelRoot button,
  .tradingPanelRoot .dataTable tbody tr{
    transition: background-color 0s, border-color 0s, box-shadow 0s, transform 0s, filter 0s !important;
  }
}
/* v10.36.10c_END */
'@

$content = $content.TrimEnd() + "`r`n`r`n" + $block + "`r`n"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($stylesPath, $content, $utf8NoBom)

Write-Host 'Appended v10.36.10c Trading opaque/no-wash CSS block.'
Write-Host 'Patched styles.css successfully for v10.36.10c.'
Write-Host 'Restart OddEngine now.'
