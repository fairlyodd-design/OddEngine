$ErrorActionPreference = 'Stop'

function Resolve-RepoRoot {
  $candidates = @()
  if ($PSScriptRoot) { $candidates += $PSScriptRoot }
  $candidates += (Get-Location).Path
  foreach ($base in $candidates) {
    if (-not $base) { continue }
    $try1 = Join-Path $base 'ui\src\panels\Trading.tsx'
    if (Test-Path $try1) { return $base }
    $try2 = Join-Path $base 'OddEngine\ui\src\panels\Trading.tsx'
    if (Test-Path $try2) { return (Join-Path $base 'OddEngine') }
  }
  throw 'Could not find ui\src\panels\Trading.tsx. Unzip into C:\OddEngine and run again.'
}

function Require-Contains([string]$Text, [string]$Needle, [string]$Label) {
  if (-not $Text.Contains($Needle)) {
    throw "Could not find anchor for $Label"
  }
}

$root = Resolve-RepoRoot
$tradingPath = Join-Path $root 'ui\src\panels\Trading.tsx'
$text = Get-Content -Raw -LiteralPath $tradingPath
$text = $text -replace "`r`n", "`n"

Copy-Item -LiteralPath $tradingPath -Destination ($tradingPath + '.v10.36.9.bak') -Force

$stateAnchor = @'
  const [lastPlanBuiltAt, setLastPlanBuiltAt] = useState<number | null>(null);
  const [lastScanAt, setLastScanAt] = useState<number | null>(null);
'@
Require-Contains $text $stateAnchor 'state anchor'
$stateInsert = @'
  const [lastPlanBuiltAt, setLastPlanBuiltAt] = useState<number | null>(null);
  const [lastScanAt, setLastScanAt] = useState<number | null>(null);
  const [chainLoadMeta, setChainLoadMeta] = useState<{ symbol: string; expiration: string; mode: "website" | "api"; startedAt: number } | null>(null);
'@
$text = $text.Replace($stateAnchor, $stateInsert)

$displayAnchor = '  const displayChain = loading && lastGoodChainRef.current ? lastGoodChainRef.current : chain;'
Require-Contains $text $displayAnchor 'display chain anchor'
$displayInsert = @'
  const displayChain = loading && lastGoodChainRef.current ? lastGoodChainRef.current : chain;
  const isRefreshingChain = loading && !!displayChain;
  const chainLoadLabel = useMemo(() => {
    if (!chainLoadMeta) return "";
    const bits = @($chainLoadMeta.symbol);
    if ($chainLoadMeta.expiration) { $bits += $chainLoadMeta.expiration }
    $bits += ($chainLoadMeta.mode -eq "api" ? "API" : "Website")
    return [string]::Join(" • ", $bits);
  }, [chainLoadMeta]);
'@
$text = $text.Replace($displayAnchor, $displayInsert)

$autoSelectAnchor = @'
  const drawerCalls = useMemo(() => filteredContracts.filter((c) => c.side === "call").slice(0, 30), [filteredContracts]);
  const drawerPuts = useMemo(() => filteredContracts.filter((c) => c.side === "put").slice(0, 30), [filteredContracts]);
'@
Require-Contains $text $autoSelectAnchor 'drawer anchor'
$autoSelectInsert = @'
  const drawerCalls = useMemo(() => filteredContracts.filter((c) => c.side === "call").slice(0, 30), [filteredContracts]);
  const drawerPuts = useMemo(() => filteredContracts.filter((c) => c.side === "put").slice(0, 30), [filteredContracts]);

  useEffect(() => {
    if (loading || !displayChain) return;
    if (selectedContractKey && filteredContracts.some((c) => c.key === selectedContractKey)) return;
    const best = pickBest(filteredContracts.length ? filteredContracts : allContracts, { maxAsk: inp.maxAsk, minOi: inp.minOi, targetSide: inp.targetSide });
    if (best?.key && best.key !== selectedContractKey) {
      setSelectedContractKey(best.key);
      return;
    }
    if (!best && selectedContractKey) setSelectedContractKey(null);
  }, [loading, displayChain, selectedContractKey, filteredContracts, allContracts, inp.maxAsk, inp.minOi, inp.targetSide]);
'@
$text = $text.Replace($autoSelectAnchor, $autoSelectInsert)

$scanAnchor = @'
  async function scanSymbol(symbolArg?: string, expirationArg?: string) {
    const symbol = (symbolArg || inp.symbol).trim().toUpperCase();
    if (!symbol) return;
    const requestId = ++scanRequestRef.current;
    setLoading(true);
    setScanError(null);
'@
Require-Contains $text $scanAnchor 'scan start anchor'
$scanInsert = @'
  async function scanSymbol(symbolArg?: string, expirationArg?: string) {
    const symbol = (symbolArg || inp.symbol).trim().toUpperCase();
    if (!symbol) return;
    const requestId = ++scanRequestRef.current;
    setChainLoadMeta({
      symbol,
      expiration: String(expirationArg || inp.selectedExpiration || ""),
      mode: inp.dataMode,
      startedAt: Date.now(),
    });
    setLoading(true);
    setScanError(null);
'@
$text = $text.Replace($scanAnchor, $scanInsert)

$text = $text.Replace('      setSelectedContractKey(null);' + "`n", '')

$finallyAnchor = @'
    } finally {
      if (requestId === scanRequestRef.current) setLoading(false);
    }
  }
'@
Require-Contains $text $finallyAnchor 'scan finally anchor'
$finallyInsert = @'
    } finally {
      if (requestId === scanRequestRef.current) {
        setLoading(false);
        setChainLoadMeta(null);
      }
    }
  }
'@
$text = $text.Replace($finallyAnchor, $finallyInsert)

$sourceButtonsAnchor = @'
          <div className="row wrap mt-5">
            <button onClick={() => void scanSymbol(undefined, inp.selectedExpiration)} disabled={loading}>{loading ? "Scanning…" : "Scan symbol"}</button>
            <button onClick={() => void scanWatchlist()} disabled={watchlistBusy}>{watchlistBusy ? "Scanning watchlist…" : "Scan watchlist"}</button>
            <button onClick={() => void refreshGreeks(true)} disabled={greeksBusy || inp.dataMode !== "api"}>{greeksBusy ? "Loading greeks…" : "Refresh greeks"}</button>
            <button onClick={() => void openExternal(buildPublicChainUrl(inp.symbol))}>Open on Public</button>
          </div>
'@
Require-Contains $text $sourceButtonsAnchor 'source buttons anchor'
$sourceButtonsInsert = @'
          <div className="row wrap mt-5">
            <button onClick={() => void scanSymbol(undefined, inp.selectedExpiration)} disabled={loading}>{loading ? "Scanning…" : "Scan symbol"}</button>
            <button onClick={() => void scanWatchlist()} disabled={watchlistBusy}>{watchlistBusy ? "Scanning watchlist…" : "Scan watchlist"}</button>
            <button onClick={() => void refreshGreeks(true)} disabled={greeksBusy || inp.dataMode !== "api"}>{greeksBusy ? "Loading greeks…" : "Refresh greeks"}</button>
            <button onClick={() => void openExternal(buildPublicChainUrl(inp.symbol))}>Open on Public</button>
          </div>
          {isRefreshingChain && (
            <div className="card mt-4" style={{ background: "rgba(15,22,34,0.45)", border: "1px solid rgba(96,165,250,0.22)" }}>
              <div style={{ fontWeight: 800 }}>Refreshing chain without dropping the panel</div>
              <div className="small mt-2">Showing the last good chain while the next response loads{chainLoadLabel ? ` • ${chainLoadLabel}` : ""}.</div>
            </div>
          )}
'@
$text = $text.Replace($sourceButtonsAnchor, $sourceButtonsInsert)

$contractsHeaderAnchor = @'
        <div className="cluster spread start">
          <div>
            <div style={{ fontWeight: 900 }}>Contracts</div>
            <div className="small">Search contracts, group strikes, then click a row to pin it into the Sniper plan and drawer.</div>
          </div>
'@
Require-Contains $text $contractsHeaderAnchor 'contracts header anchor'
$contractsHeaderInsert = @'
        <div className="cluster spread start">
          <div>
            <div style={{ fontWeight: 900 }}>Contracts</div>
            <div className="small">Search contracts, group strikes, then click a row to pin it into the Sniper plan and drawer.</div>
            {isRefreshingChain && <div className="small mt-2" style={{ color: "#93c5fd" }}>Refreshing contracts in-place — chart and drawer stay mounted.</div>}
          </div>
'@
$text = $text.Replace($contractsHeaderAnchor, $contractsHeaderInsert)

$writeText = $text -replace "`n", "`r`n"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($tradingPath, $writeText, $utf8NoBom)
Write-Host 'Patched Trading.tsx successfully for v10.36.9.'
Write-Host 'Restart OddEngine now.'
