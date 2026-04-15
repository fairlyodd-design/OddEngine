$ErrorActionPreference = "Stop"

function Resolve-RepoRoot {
  $candidates = @()
  if ($PSScriptRoot) { $candidates += $PSScriptRoot }
  if ($PSCommandPath) { $candidates += (Split-Path -Parent $PSCommandPath) }
  $cwdPath = (Get-Location).Path
  if ($cwdPath) { $candidates += $cwdPath }
  foreach ($c in $candidates) {
    if (-not $c) { continue }
    $direct = $c
    $parent = Split-Path -Parent $c
    foreach ($try in @($direct, $parent)) {
      if (-not $try) { continue }
      if (Test-Path (Join-Path $try "ui/src/App.tsx")) {
        return $try
      }
    }
  }
  throw "Could not locate OddEngine repo root from this script. Make sure this zip is extracted into C:\OddEngine and run the included BAT from there."
}

function Write-Utf8NoBom([string]$Path, [string]$Text) {
  $enc = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Text, $enc)
}

function Replace-Once([string]$Text, [string]$Find, [string]$Replace, [string]$Label) {
  if (-not $Text.Contains($Find)) { throw "Could not find anchor for $Label" }
  return $Text.Replace($Find, $Replace)
}

$root = Resolve-RepoRoot
$appPath = Join-Path $root "ui/src/App.tsx"
$tradingPath = Join-Path $root "ui/src/panels/Trading.tsx"

if (-not (Test-Path $appPath)) { throw "Missing App.tsx at $appPath" }
if (-not (Test-Path $tradingPath)) { throw "Missing Trading.tsx at $tradingPath" }

$appText = Get-Content -Raw -LiteralPath $appPath

if ($appText -notmatch 'lazyWithRetry') {
  $appText = [regex]::Replace(
    $appText,
    'import React,\s*\{[^}]*\}\s*from "react";',
    '$0' + "`r`n" + 'import { lazyWithRetry, preloadPanelModules } from "./lib/lazyWithRetry";',
    1
  )
}

$appText = [regex]::Replace(
  $appText,
  'const\s+([A-Za-z0-9_]+)\s*=\s*lazy\(\(\)\s*=>\s*import\("(\./panels/[^"]+)"\)\);',
  'const $1 = lazyWithRetry(() => import("$2"), "$1");'
)

if ($appText -notmatch 'preloadPanelModules\(\[') {
  $automationBlock = "  useEffect(() => {`r`n    startAutomationLoop();`r`n  }, []);"
  $prewarmBlock = @(
    '',
    '  useEffect(() => {',
    '    try {',
    '      const cleanup = preloadPanelModules(["Home", "Trading", "Homie", "Brain", "OddBrain", "Money", "Calendar"]);',
    '      return cleanup;',
    '    } catch {',
    '      return;',
    '    }',
    '  }, []);'
  ) -join "`r`n"
  $appText = Replace-Once $appText $automationBlock ($automationBlock + $prewarmBlock) "automation loop insertion"
}

Write-Utf8NoBom $appPath $appText

$tradingText = Get-Content -Raw -LiteralPath $tradingPath

if ($tradingText -notmatch 'SoftErrorGuard') {
  $tradingText = [regex]::Replace(
    $tradingText,
    'import React,\s*\{[^}]*\}\s*from "react";',
    '$0' + "`r`n" + 'import SoftErrorGuard from "../components/SoftErrorGuard";',
    1
  )
}

$tradingText = $tradingText -replace 'const savedUi = loadJSON<any>\(UI_KEY, null as any\);', 'const savedUi = useMemo(() => loadJSON<any>(UI_KEY, null as any), []);'
$tradingText = $tradingText -replace 'const displayChain = loading && lastGoodChainRef.current \? lastGoodChainRef.current : chain;', 'const displayChain = (loading || !!scanError) && lastGoodChainRef.current ? lastGoodChainRef.current : chain;'

$chartFrom = '<StableTradingViewChart symbol={inp.chartSymbol} interval={inp.chartInterval} />'
$chartTo = @(
  '<SoftErrorGuard label="TradingView chart" resetKey={`${inp.chartSymbol}:${inp.chartInterval}`}>',
  '            <StableTradingViewChart symbol={inp.chartSymbol} interval={inp.chartInterval} />',
  '          </SoftErrorGuard>'
) -join "`r`n"
if ($tradingText.Contains($chartFrom)) {
  $tradingText = $tradingText.Replace($chartFrom, $chartTo)
}

$curveFrom = '<StableOptionCurveChart chain={displayChain} selectedKey={selectedContract?.key ?? null} />'
$curveTo = @(
  '<SoftErrorGuard label="Option premium curve" resetKey={`${displayChain?.symbol || inp.symbol}:${selectedContract?.key ?? ""}:curve`}>',
  '            <StableOptionCurveChart chain={displayChain} selectedKey={selectedContract?.key ?? null} />',
  '          </SoftErrorGuard>'
) -join "`r`n"
if ($tradingText.Contains($curveFrom)) {
  $tradingText = $tradingText.Replace($curveFrom, $curveTo)
}

$oiFrom = '<StableOiBarChart contracts={deferredVisibleContracts} selectedKey={selectedContract?.key ?? null} />'
$oiTo = @(
  '<SoftErrorGuard label="Open interest bars" resetKey={`${displayChain?.symbol || inp.symbol}:${selectedContract?.key ?? ""}:oi`}>',
  '            <StableOiBarChart contracts={deferredVisibleContracts} selectedKey={selectedContract?.key ?? null} />',
  '          </SoftErrorGuard>'
) -join "`r`n"
if ($tradingText.Contains($oiFrom)) {
  $tradingText = $tradingText.Replace($oiFrom, $oiTo)
}

Write-Utf8NoBom $tradingPath $tradingText

Write-Host "Patched App.tsx and Trading.tsx successfully for v10.36.8."
Write-Host "Restart OddEngine now."
