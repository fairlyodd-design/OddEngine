$ErrorActionPreference = "Stop"

$root = (Get-Location).Path
$component = Join-Path $root "ui\src\components\FairlyGodModeHUD.tsx"
$styles = Join-Path $root "ui\src\styles.css"
$version = Join-Path $root "ui\src\lib\version.ts"
$payload = Join-Path $root "payload"

if (!(Test-Path $component)) { throw "Missing ui\src\components\FairlyGodModeHUD.tsx. Apply v10.37.7+ first." }
if (!(Test-Path $styles)) { throw "Missing ui\src\styles.css. Run from C:\OddEngine." }

Write-Host "[v10.37.9] Applying Panel Truth Receipts + Readiness Ledger..." -ForegroundColor Cyan

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$tsx = [System.IO.File]::ReadAllText($component, [System.Text.Encoding]::UTF8)

if ($tsx -notmatch 'RECEIPT_HISTORY_KEY') {
  $tsx = $tsx.Replace(
    'const RECEIPTS_KEY = "oddengine:fairlygodmode:truthReceipts:v1";',
    'const RECEIPTS_KEY = "oddengine:fairlygodmode:truthReceipts:v1";' + "`r`n" +
    'const RECEIPT_HISTORY_KEY = "oddengine:fairlygodmode:receiptScanHistory:v1";' + "`r`n" +
    'const RECEIPT_EXPORT_KEY = "oddengine:fairlygodmode:lastReceiptExport:v1";'
  )
}

if ($tsx -notmatch 'function formatAge') {
  $anchor = @'
function writeJSON(key: string, value: any) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // local operator state only
  }
}
'@
  $insert = $anchor + @'

function formatAge(ts?: number) {
  if (!ts) return "never";
  const delta = Math.max(0, Date.now() - ts);
  const mins = Math.floor(delta / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function safeDate(ts?: number) {
  if (!ts) return "never";
  try { return new Date(ts).toLocaleString(); } catch { return "unknown"; }
}

function copyText(text: string) {
  try {
    navigator.clipboard?.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function dataAgeForPanel(panelId: string, storageKeys: string[]) {
  let newest = 0;
  for (const key of storageKeys) {
    const value = readJSON<any>(key, null);
    if (value && typeof value === "object") {
      const candidates = [value.updatedAt, value.ts, value.lastUpdated, value.seededAt, value.createdAt].filter((v) => typeof v === "number");
      newest = Math.max(newest, ...candidates, 0);
    }
  }
  return newest || undefined;
}

'@
  if ($tsx.Contains($anchor)) { $tsx = $tsx.Replace($anchor, $insert) }
}

if ($tsx -notmatch 'receiptVersion: string;') {
  $tsx = $tsx.Replace('bestNextAction: string;' + "`r`n" + '};', 'bestNextAction: string;' + "`r`n" + '  dataAge?: number;' + "`r`n" + '  emptyStatePercent: number;' + "`r`n" + '  receiptVersion: string;' + "`r`n" + '};')
}

if ($tsx -notmatch 'receiptVersion: "v10.37.9"') {
  $tsx = $tsx.Replace(
    'bestNextAction: fixes[0],' + "`r`n" + '  };',
    'bestNextAction: fixes[0],' + "`r`n" +
    '    dataAge: dataAgeForPanel(meta.id, storageKeys),' + "`r`n" +
    '    emptyStatePercent: storageKeys.length ? Math.round((missingKeys.length / storageKeys.length) * 100) : 0,' + "`r`n" +
    '    receiptVersion: "v10.37.9",' + "`r`n" +
    '  };'
  )
}

$oldScan = @'
function scanReceipts() {
  const receipts = PANEL_META.map((panel) => scorePanel(panel.id));
  writeJSON(RECEIPTS_KEY, receipts);
  return receipts;
}
'@
$newScan = @'
function scanReceipts() {
  const receipts = PANEL_META.map((panel) => scorePanel(panel.id));
  const summary = {
    id: `scan_${Date.now()}`,
    ts: Date.now(),
    total: receipts.length,
    good: receipts.filter((r) => r.status === "good").length,
    warn: receipts.filter((r) => r.status === "warn").length,
    bad: receipts.filter((r) => r.status === "bad").length,
    topRisks: receipts.filter((r) => r.status !== "good").slice(0, 6).map((r) => ({
      panelId: r.panelId,
      status: r.status,
      reason: r.reasons[0],
    })),
  };
  writeJSON(RECEIPTS_KEY, receipts);
  const history = readJSON<any[]>(RECEIPT_HISTORY_KEY, []);
  writeJSON(RECEIPT_HISTORY_KEY, [summary, ...history].slice(0, 30));
  return receipts;
}
'@
if ($tsx.Contains($oldScan)) { $tsx = $tsx.Replace($oldScan, $newScan) }

if ($tsx -notmatch 'ledgerQuery') {
  $tsx = $tsx.Replace(
    'const [legacy, setLegacy] = useState(() => readJSON(LEGACY_KEY, defaultLegacyState()));',
    'const [legacy, setLegacy] = useState(() => readJSON(LEGACY_KEY, defaultLegacyState()));' + "`r`n" +
    '  const [ledgerQuery, setLedgerQuery] = useState("");' + "`r`n" +
    '  const [showReceiptJson, setShowReceiptJson] = useState(false);'
  )
}

if ($tsx -notmatch 'filteredReceipts') {
  $anchor = 'const overflowWarnings = typeof document === "undefined" ? 0 : Array.from(document.querySelectorAll<HTMLElement>(".panelMain .card")).filter((el) => el.scrollWidth > el.clientWidth + 8).length;'
  $insert = $anchor + "`r`n" + @'

  const filteredReceipts = useMemo(() => {
    const q = ledgerQuery.trim().toLowerCase();
    const list = receipts.length ? receipts : PANEL_META.map((p) => scorePanel(p.id));
    if (!q) return list;
    return list.filter((r) => `${r.panelId} ${r.title} ${r.section} ${r.status} ${r.reasons.join(" ")} ${r.bestNextAction}`.toLowerCase().includes(q));
  }, [receipts, ledgerQuery]);
'@
  $tsx = $tsx.Replace($anchor, $insert)
}

if ($tsx -notmatch 'function exportLedger') {
  $anchor = '  const panelGroups = useMemo(() => {'
  $insert = @'
  function exportLedger() {
    const data = {
      exportedAt: Date.now(),
      activePanel: active,
      receipts: receipts.length ? receipts : scanReceipts(),
      history: readJSON<any[]>(RECEIPT_HISTORY_KEY, []),
    };
    const json = JSON.stringify(data, null, 2);
    writeJSON(RECEIPT_EXPORT_KEY, data);
    copyText(json);
    window.alert("Truth receipt ledger copied to clipboard when available, and saved locally as lastReceiptExport.");
  }

  function copySelectedReceipt() {
    const json = JSON.stringify(selected, null, 2);
    copyText(json);
    window.alert("Selected panel receipt copied to clipboard when available.");
  }

'@ + $anchor
  $tsx = $tsx.Replace($anchor, $insert)
}

# Replace the Receipts tab using a broad regex from the opening condition to the next Homie tab condition.
$newBlock = @'
            {tab === "Receipts" && (
              <div className="fgGodSection">
                <div className="fgGodReasonCard">
                  <div className="fgGodReasonTitle">Panel Truth Receipts + Readiness Ledger</div>
                  <div className="fgGodReasonText">Receipts are local audit records generated by OS Doctor. They track readiness score, reasons, fixes, storage keys, data age, dependency notes, and best next action.</div>
                </div>

                <div className="fgGodLedgerToolbar">
                  <div className="left fgGodLedgerSearch">
                    <input value={ledgerQuery} onChange={(e) => setLedgerQuery(e.target.value)} placeholder="Search receipts by panel, risk, reason, fix..." />
                  </div>
                  <div className="right">
                    <button className="tabBtn active" onClick={() => setReceipts(scanReceipts())}>Run scan</button>
                    <button className="tabBtn" onClick={exportLedger}>Copy/export ledger</button>
                    <button className="tabBtn" onClick={() => setShowReceiptJson((v) => !v)}>{showReceiptJson ? "Hide JSON" : "Show JSON"}</button>
                  </div>
                </div>

                <div className="fgGodLedgerStats">
                  <div className="fgGodLedgerStat card softCard"><b>{filteredReceipts.length}</b><span>shown receipts</span></div>
                  <div className="fgGodLedgerStat card softCard"><b>{filteredReceipts.filter((r) => r.status === "bad").length}</b><span>bad</span></div>
                  <div className="fgGodLedgerStat card softCard"><b>{filteredReceipts.filter((r) => r.status === "warn").length}</b><span>warn</span></div>
                  <div className="fgGodLedgerStat card softCard"><b>{readJSON<any[]>(RECEIPT_HISTORY_KEY, []).length}</b><span>scan history</span></div>
                </div>

                <div className={`fgGodReceiptExpanded ${selected.status}`}>
                  <div className="fgGodReceiptHeader">
                    <div>
                      <h4>{selected.title} receipt</h4>
                      <p>{selected.status} - {selected.score}/100 - scanned {formatAge(selected.lastScan)} - data age {formatAge(selected.dataAge)}</p>
                    </div>
                    <div className="fgGodReceiptActions">
                      <button className="tabBtn" onClick={() => onNavigate(selected.panelId)}>Open</button>
                      <button className="tabBtn" onClick={() => { onNavigate(selected.panelId); setOpen(false); }}>Focus</button>
                      <button className="tabBtn" onClick={copySelectedReceipt}>Copy receipt</button>
                      <button className="tabBtn danger" onClick={() => safeReset(selected.panelId)}>Reset layout</button>
                    </div>
                  </div>
                  <div className="fgGodReceiptFacts">
                    <div className="fgGodReceiptFact"><b>Risk</b><span>{selected.currentRisk}</span></div>
                    <div className="fgGodReceiptFact"><b>Dependency</b><span>{selected.backendDependency}</span></div>
                    <div className="fgGodReceiptFact"><b>Empty state</b><span>{selected.emptyStatePercent}%</span></div>
                    <div className="fgGodReceiptFact"><b>Storage keys</b><span>{selected.storageKeys.length}</span></div>
                    <div className="fgGodReceiptFact"><b>Missing keys</b><span>{selected.missingKeys.length}</span></div>
                    <div className="fgGodReceiptFact"><b>Last opened</b><span>{safeDate(selected.lastOpened)}</span></div>
                  </div>
                  <div className="fgGodReceiptDetailGrid">
                    <div className="fgGodReceiptDetail">
                      <b>Reasons</b>
                      <ul>{selected.reasons.map((reason, idx) => <li key={idx}>{reason}</li>)}</ul>
                    </div>
                    <div className="fgGodReceiptDetail">
                      <b>Fixes</b>
                      <ul>{selected.fixes.map((fix, idx) => <li key={idx}>{fix}</li>)}</ul>
                    </div>
                  </div>
                  {showReceiptJson && <pre className="fgGodReceiptJson">{JSON.stringify(selected, null, 2)}</pre>}
                </div>

                <div className="fgGodReceiptList">
                  {filteredReceipts.map((r) => (
                    <div key={r.panelId} className={`fgGodReceipt ${r.status}`}>
                      <div>
                        <b>{r.title}</b>
                        <span>{r.status} - {r.score}/100 - data {formatAge(r.dataAge)} - {r.backendDependency}</span>
                        <small>{r.bestNextAction}</small>
                      </div>
                      <button className="tabBtn" onClick={() => setSelectedPanel(r.panelId)}>Inspect</button>
                    </div>
                  ))}
                </div>

                <div className="fgGodReasonCard">
                  <div className="fgGodReasonTitle">Scan history</div>
                  <div className="fgGodReasonText">Recent OS Doctor scans are stored locally so FairlyGodMode can show whether the OS is improving or drifting.</div>
                </div>
                <div className="fgGodLedgerHistory">
                  {readJSON<any[]>(RECEIPT_HISTORY_KEY, []).slice(0, 8).map((scan) => (
                    <div key={scan.id} className="fgGodLedgerHistoryItem">
                      <div>
                        <b>{safeDate(scan.ts)}</b>
                        <span>{scan.total} panels - {scan.good} good - {scan.warn} warn - {scan.bad} bad</span>
                      </div>
                      <button className="tabBtn" onClick={() => window.alert((scan.topRisks || []).map((r: any) => `${r.panelId}: ${r.reason}`).join("\n") || "No top risks in this scan.")}>Top risks</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

'@

$pattern = '(?s)\s*\{tab === "Receipts" && \([\s\S]*?\)\}\s*(?=\{tab === "Homie" && \()'
$tsx2 = [regex]::Replace($tsx, $pattern, "`r`n" + $newBlock)
if ($tsx2 -eq $tsx) {
  Write-Host "[v10.37.9] Receipts block regex did not match. Helpers/CSS still applied." -ForegroundColor Yellow
} else {
  $tsx = $tsx2
}

[System.IO.File]::WriteAllText($component, $tsx, $utf8NoBom)

$cssPayload = Join-Path $payload "PANEL_TRUTH_RECEIPTS_LEDGER.css"
$css = [System.IO.File]::ReadAllText($styles, [System.Text.Encoding]::UTF8)
$block = [System.IO.File]::ReadAllText($cssPayload, [System.Text.Encoding]::ASCII)
$start = "/* ===== v10.37.9 Panel Truth Receipts + Readiness Ledger ===== */"
$end = "/* ===== v10.37.9 Panel Truth Receipts + Readiness Ledger END ===== */"
$cssPattern = [regex]::Escape($start) + "[\s\S]*?" + [regex]::Escape($end)
$css = [regex]::Replace($css, $cssPattern, "", [System.Text.RegularExpressions.RegexOptions]::Singleline).TrimEnd()
[System.IO.File]::WriteAllText($styles, $css + "`r`n`r`n" + $block + "`r`n", $utf8NoBom)

if (Test-Path $version) {
  $ver = [System.IO.File]::ReadAllText($version, [System.Text.Encoding]::UTF8)
  $ver = [regex]::Replace($ver, 'export const APP_VERSION = ".*?";', 'export const APP_VERSION = "10.37.9";')
  if ($ver -notmatch 'PANEL_TRUTH_RECEIPTS_PASS') {
    $ver = $ver.TrimEnd() + "`r`n" + 'export const PANEL_TRUTH_RECEIPTS_PASS = "v10.37.9_PanelTruthReceiptsAndReadinessLedgerPass";' + "`r`n"
  }
  [System.IO.File]::WriteAllText($version, $ver, $utf8NoBom)
}

Write-Host "[v10.37.9] Applied." -ForegroundColor Green
Write-Host "Next:"
Write-Host "  npm --prefix ui run build"
Write-Host "  npm run dev:desktop"
