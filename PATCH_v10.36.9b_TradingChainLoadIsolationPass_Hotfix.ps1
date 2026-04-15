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

function Replace-OnceRegex([string]$Text, [string]$Pattern, [string]$Replacement, [string]$Label) {
  $rx = [regex]::new($Pattern, [System.Text.RegularExpressions.RegexOptions]::Multiline)
  if (-not $rx.IsMatch($Text)) {
    throw "Could not find anchor for $Label"
  }
  return $rx.Replace($Text, $Replacement, 1)
}

$root = Resolve-RepoRoot
$tradingPath = Join-Path $root 'ui\src\panels\Trading.tsx'
$text = Get-Content -Raw -LiteralPath $tradingPath
$text = $text -replace "`r`n", "`n"

Copy-Item -LiteralPath $tradingPath -Destination ($tradingPath + '.v10.36.9b.bak') -Force

if ($text -notmatch 'chainLoadMeta') {
  $text = Replace-OnceRegex $text '(^\s*const \[lastScanAt, setLastScanAt\] = useState<number \| null>\(null\);\s*$)' @'
  const [lastScanAt, setLastScanAt] = useState<number | null>(null);
  const [chainLoadMeta, setChainLoadMeta] = useState<{ symbol: string; expiration: string; mode: "website" | "api"; startedAt: number } | null>(null);
'@ 'lastScanAt state'
}

if ($text -notmatch 'isRefreshingChain') {
  $text = Replace-OnceRegex $text '(^\s*const displayChain = loading && lastGoodChainRef\.current \? lastGoodChainRef\.current : chain;\s*$)' @'
  const displayChain = loading && lastGoodChainRef.current ? lastGoodChainRef.current : chain;
  const isRefreshingChain = loading && !!displayChain;
  const chainLoadLabel = useMemo(() => {
    if (!chainLoadMeta) return "";
    const bits = [chainLoadMeta.symbol];
    if (chainLoadMeta.expiration) bits.push(chainLoadMeta.expiration);
    bits.push(chainLoadMeta.mode === "api" ? "API" : "Website");
    return bits.join(" • ");
  }, [chainLoadMeta]);
'@ 'displayChain line'
}

if ($text -notmatch 'if \(loading \|\| !displayChain\) return;') {
  $text = Replace-OnceRegex $text '(?ms)(^\s*const drawerCalls = useMemo\(\(\) => filteredContracts\.filter\(\(c\) => c\.side === "call"\)\.slice\(0, 30\), \[filteredContracts\]\);\s*$\n^\s*const drawerPuts = useMemo\(\(\) => filteredContracts\.filter\(\(c\) => c\.side === "put"\)\.slice\(0, 30\), \[filteredContracts\]\);\s*$)' @'
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
'@ 'drawer rows'
}

if ($text -notmatch 'setChainLoadMeta\(') {
  $text = Replace-OnceRegex $text '(^\s*const requestId = \+\+scanRequestRef\.current;\s*$)' @'
    const requestId = ++scanRequestRef.current;
    setChainLoadMeta({
      symbol,
      expiration: String(expirationArg || inp.selectedExpiration || ""),
      mode: inp.dataMode,
      startedAt: Date.now(),
    });
'@ 'scan request id'
}

$text = $text -replace "\n\s*setSelectedContractKey\(null\);\n\s*setActiveStrikeBucket\(null\);", "`n      setActiveStrikeBucket(null);"

$text = $text -replace 'if \(requestId === scanRequestRef\.current\) setLoading\(false\);', @'
if (requestId === scanRequestRef.current) {
        setLoading(false);
        setChainLoadMeta(null);
      }
'@

if ($text -notmatch 'Refreshing chain without dropping the panel') {
  $text = $text -replace '(?ms)(<div className="row wrap mt-5">\s*<button onClick=\{\(\) => void scanSymbol\(undefined, inp\.selectedExpiration\)\} disabled=\{loading\}>\{loading \? "Scanning…" : "Scan symbol"\}</button>\s*<button onClick=\{\(\) => void scanWatchlist\(\)\} disabled=\{watchlistBusy\}>\{watchlistBusy \? "Scanning watchlist…" : "Scan watchlist"\}</button>\s*<button onClick=\{\(\) => void refreshGreeks\(true\)\} disabled=\{greeksBusy \|\| inp\.dataMode !== "api"\}>\{greeksBusy \? "Loading greeks…" : "Refresh greeks"\}</button>\s*<button onClick=\{\(\) => void openExternal\(buildPublicChainUrl\(inp\.symbol\)\)\}>Open on Public</button>\s*</div>)', '$1`n          {isRefreshingChain && (`n            <div className="card mt-4" style={{ background: "rgba(15,22,34,0.45)", border: "1px solid rgba(96,165,250,0.22)" }}>`n              <div style={{ fontWeight: 800 }}>Refreshing chain without dropping the panel</div>`n              <div className="small mt-2">Showing the last good chain while the next response loads{chainLoadLabel ? ` • ${chainLoadLabel}` : ""}.</div>`n            </div>`n          )}'
}

if ($text -notmatch 'Refreshing contracts in-place') {
  $text = $text -replace '(?ms)(<div style=\{\{ fontWeight: 900 \}\}>Contracts</div>\s*<div className="small">Search contracts, group strikes, then click a row to pin it into the Sniper plan and drawer\.</div>)', '$1`n            {isRefreshingChain && <div className="small mt-2" style={{ color: "#93c5fd" }}>Refreshing contracts in-place — chart and drawer stay mounted.</div>}'
}

$writeText = $text -replace "`n", "`r`n"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($tradingPath, $writeText, $utf8NoBom)
Write-Host 'Patched Trading.tsx successfully for v10.36.9b.'
Write-Host 'Restart OddEngine now.'
