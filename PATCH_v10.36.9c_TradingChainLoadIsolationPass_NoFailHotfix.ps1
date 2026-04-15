$ErrorActionPreference = 'Stop'

function Get-RepoRoot {
  $candidates = @()
  if ($PSScriptRoot) {
    $candidates += $PSScriptRoot
    try { $candidates += (Split-Path -Parent $PSScriptRoot) } catch {}
  }
  try { $candidates += (Get-Location).Path } catch {}
  $seen = @{}
  foreach ($base in $candidates) {
    if (-not $base) { continue }
    if ($seen.ContainsKey($base)) { continue }
    $seen[$base] = $true
    $direct = Join-Path $base 'ui\src\panels\Trading.tsx'
    if (Test-Path -LiteralPath $direct) { return $base }
    $child = Join-Path $base 'OddEngine\ui\src\panels\Trading.tsx'
    if (Test-Path -LiteralPath $child) { return (Join-Path $base 'OddEngine') }
  }
  throw 'Could not find ui\src\panels\Trading.tsx'
}

function Replace-Literal([string]$Text, [string]$Find, [string]$Replace) {
  if ([string]::IsNullOrEmpty($Find)) { return @{ text = $Text; changed = $false } }
  if ($Text.Contains($Find)) {
    return @{ text = $Text.Replace($Find, $Replace); changed = $true }
  }
  return @{ text = $Text; changed = $false }
}

$root = Get-RepoRoot
$path = Join-Path $root 'ui\src\panels\Trading.tsx'
$text = Get-Content -Raw -LiteralPath $path
$text = $text -replace "`r`n?", "`n"

$changes = 0

# 1) add a deferred displayChain so heavy child trees react more calmly
$r = Replace-Literal $text 'const displayChain = loading && lastGoodChainRef.current ? lastGoodChainRef.current : chain;' @'
const displayChain = loading && lastGoodChainRef.current ? lastGoodChainRef.current : chain;
  const stableDisplayChain = useDeferredValue(displayChain);
'@
$text = $r.text
if ($r.changed) { $changes++ }

# 2) derive heavy contract trees from the deferred display chain
$r = Replace-Literal $text 'const allContracts = useMemo(() => displayChain ? [...displayChain.calls, ...displayChain.puts] : [], [displayChain]);' @'
const allContracts = useMemo(() => stableDisplayChain ? [...stableDisplayChain.calls, ...stableDisplayChain.puts] : [], [stableDisplayChain]);
'@
$text = $r.text
if ($r.changed) { $changes++ }

$r = Replace-Literal $text 'if (!displayChain) return null;' 'if (!stableDisplayChain) return null;'
$text = $r.text
if ($r.changed) { $changes++ }

$r = Replace-Literal $text 'bestCall: pickBest(displayChain.calls, cfg),' 'bestCall: pickBest(stableDisplayChain.calls, cfg),'
$text = $r.text
if ($r.changed) { $changes++ }

$r = Replace-Literal $text 'bestPut: pickBest(displayChain.puts, cfg),' 'bestPut: pickBest(stableDisplayChain.puts, cfg),'
$text = $r.text
if ($r.changed) { $changes++ }

$r = Replace-Literal $text 'contracts: displayChain.calls.length + displayChain.puts.length,' 'contracts: stableDisplayChain.calls.length + stableDisplayChain.puts.length,'
$text = $r.text
if ($r.changed) { $changes++ }

$r = Replace-Literal $text '}, [displayChain, inp.maxAsk, inp.minOi, inp.targetSide]);' '}, [stableDisplayChain, inp.maxAsk, inp.minOi, inp.targetSide]);'
$text = $r.text
if ($r.changed) { $changes++ }

$r = Replace-Literal $text 'Expiry: ${selectedContract.expiration || displayChain?.expirationLabel || "—"}' 'Expiry: ${selectedContract.expiration || stableDisplayChain?.expirationLabel || "—"}'
$text = $r.text
if ($r.changed) { $changes++ }

$r = Replace-Literal $text 'Data source: ${displayChain?.sourceMode === "public_api" ? "Public API real-time chain" : "Public website delayed chain"}' 'Data source: ${stableDisplayChain?.sourceMode === "public_api" ? "Public API real-time chain" : "Public website delayed chain"}'
$text = $r.text
if ($r.changed) { $changes++ }

$r = Replace-Literal $text '}, [displayChain?.expirationLabel, displayChain?.sourceMode, inp, permission, score, selectedContract, tier]);' '}, [stableDisplayChain?.expirationLabel, stableDisplayChain?.sourceMode, inp, permission, score, selectedContract, tier]);'
$text = $r.text
if ($r.changed) { $changes++ }

$r = Replace-Literal $text 'if (!displayChain) return "Load a chain to generate a FairlyOdd thesis card and attack plan.";'
                      'if (!stableDisplayChain) return "Load a chain to generate a FairlyOdd thesis card and attack plan.";'
$text = $r.text
if ($r.changed) { $changes++ }

$r = Replace-Literal $text '${displayChain.symbol || inp.symbol} is in ${tier} mode with ${filteredContracts.length} filtered contracts. ${lead ? `Best current fit is a ${side} ${lead.strike.toFixed(2)} into ${exp}.` : `Scan a cleaner chain for ${exp}.`}`'
                      '${stableDisplayChain.symbol || inp.symbol} is in ${tier} mode with ${filteredContracts.length} filtered contracts. ${lead ? `Best current fit is a ${side} ${lead.strike.toFixed(2)} into ${exp}.` : `Scan a cleaner chain for ${exp}.`}`'
$text = $r.text
if ($r.changed) { $changes++ }

$r = Replace-Literal $text '}, [displayChain, filteredContracts.length, inp.selectedExpiration, inp.symbol, spotlightContracts, tier]);'
                      '}, [stableDisplayChain, filteredContracts.length, inp.selectedExpiration, inp.symbol, spotlightContracts, tier]);'
$text = $r.text
if ($r.changed) { $changes++ }

$r = Replace-Literal $text 'chain={displayChain}' 'chain={stableDisplayChain}'
$text = $r.text
if ($r.changed) { $changes++ }

$r = Replace-Literal $text '<StableOptionCurveChart chain={displayChain} selectedKey={selectedContract?.key ?? null} />'
                      '<StableOptionCurveChart chain={stableDisplayChain} selectedKey={selectedContract?.key ?? null} />'
$text = $r.text
if ($r.changed) { $changes++ }

# 3) auto-recover selected contract after a fresh chain/expiration load
if ($text -notmatch 'Auto-recover selected contract after chain refresh') {
  $needle = '  const selectedContract = useMemo(() => {'
  $idx = $text.IndexOf($needle)
  if ($idx -ge 0) {
    $endNeedle = '  useEffect(() => {'
    $endIdx = $text.IndexOf($endNeedle, $idx)
    if ($endIdx -gt $idx) {
      $insert = @'

  // Auto-recover selected contract after chain refresh.
  useEffect(() => {
    if (!filteredContracts.length) return;
    if (selectedContractKey && filteredContracts.some((c) => c.key === selectedContractKey)) return;
    const nextBest = pickBest(filteredContracts, { maxAsk: inp.maxAsk, minOi: inp.minOi, targetSide: inp.targetSide }) || filteredContracts[0];
    if (nextBest?.key) setSelectedContractKey(nextBest.key);
  }, [filteredContracts, selectedContractKey, inp.maxAsk, inp.minOi, inp.targetSide]);

'@
      $text = $text.Insert($endIdx, $insert)
      $changes++
    }
  }
}

# 4) add a contained refresh message inside the source lane if the exact place exists
if ($text -notmatch 'Refreshing chain while keeping last-good layout visible') {
  $find = @'
          <div className="row wrap mt-5">
            <button onClick={() => void scanSymbol(undefined, inp.selectedExpiration)} disabled={loading}>{loading ? "Scanning…" : "Scan symbol"}</button>
            <button onClick={() => void scanWatchlist()} disabled={watchlistBusy}>{watchlistBusy ? "Scanning watchlist…" : "Scan watchlist"}</button>
            <button onClick={() => void refreshGreeks(true)} disabled={greeksBusy || inp.dataMode !== "api"}>{greeksBusy ? "Loading greeks…" : "Refresh greeks"}</button>
            <button onClick={() => void openExternal(buildPublicChainUrl(inp.symbol))}>Open on Public</button>
          </div>
'@
  $replace = @'
          <div className="row wrap mt-5">
            <button onClick={() => void scanSymbol(undefined, inp.selectedExpiration)} disabled={loading}>{loading ? "Scanning…" : "Scan symbol"}</button>
            <button onClick={() => void scanWatchlist()} disabled={watchlistBusy}>{watchlistBusy ? "Scanning watchlist…" : "Scan watchlist"}</button>
            <button onClick={() => void refreshGreeks(true)} disabled={greeksBusy || inp.dataMode !== "api"}>{greeksBusy ? "Loading greeks…" : "Refresh greeks"}</button>
            <button onClick={() => void openExternal(buildPublicChainUrl(inp.symbol))}>Open on Public</button>
          </div>
          {loading && lastGoodChainRef.current && (
            <div className="card mt-4" style={{ background: "rgba(15,22,34,0.45)" }}>
              <div style={{ fontWeight: 800 }}>Refreshing chain while keeping last-good layout visible</div>
              <div className="small mt-2">Chart, drawer, and contracts stay mounted while the next chain lands.</div>
            </div>
          )}
'@
  $r = Replace-Literal $text $find $replace
  $text = $r.text
  if ($r.changed) { $changes++ }
}

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($path, $text, $utf8NoBom)

Write-Host ("Patched Trading.tsx successfully for v10.36.9c. Changes applied: " + $changes)
if ($changes -eq 0) {
  Write-Host 'No exact matches were found in the local Trading.tsx. The safest fallback is:'
  Write-Host 'git checkout origin/main -- ui/src/panels/Trading.tsx'
}
Write-Host 'Restart OddEngine now.'
