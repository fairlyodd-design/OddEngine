import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const tradingPath = path.join(root, 'ui', 'src', 'panels', 'Trading.tsx');
const reportPath = path.join(root, 'v10.36.14-trading-chain-containment-report.json');

function fail(message) {
  console.error(`\n❌ ${message}`);
  process.exit(1);
}

function writeReport(payload) {
  fs.writeFileSync(reportPath, JSON.stringify(payload, null, 2));
}

if (!fs.existsSync(tradingPath)) {
  fail(`Could not find ${path.relative(root, tradingPath)}. Run this from C:\\OddEngine.`);
}

let src = fs.readFileSync(tradingPath, 'utf8');
const original = src;
const notes = [];

function replaceOnce(label, find, replacement) {
  if (!src.includes(find)) {
    notes.push(`skip:${label}`);
    return false;
  }
  src = src.replace(find, replacement);
  notes.push(`patched:${label}`);
  return true;
}

function regexReplaceOnce(label, regex, replacement) {
  if (!regex.test(src)) {
    notes.push(`skip:${label}`);
    return false;
  }
  src = src.replace(regex, replacement);
  notes.push(`patched:${label}`);
  return true;
}

// 1) Stable constants for the chain island.
if (!src.includes('TRADING_CONTRACT_ROW_LIMIT')) {
  replaceOnce(
    'stable chain constants',
    'const TRADING_EVENT = "oddengine:money-changed";\n',
    'const TRADING_EVENT = "oddengine:money-changed";\n\n' +
      '// v10.36.14 — chain containment guardrails.\n' +
      '// Keep heavy options-chain renders inside a stable internal island so the outer OS/card layout never thrashes.\n' +
      'const TRADING_CONTRACT_ROW_LIMIT = 120;\n' +
      'const TRADING_DRAWER_ROW_LIMIT = 30;\n' +
      'const TRADING_CONTRACT_ISLAND_HEIGHT = 520;\n'
  );
}

// 2) Make requestText browser fetch abort-capable. Desktop bridge requests still use the existing request-id guard.
regexReplaceOnce(
  'requestText signal type',
  /async function requestText\(opts: \{ url: string; method\?: string; headers\?: Record<string, string>; body\?: string; timeoutMs\?: number; maxBytes\?: number \}\): Promise<string> \{/,
  'async function requestText(opts: { url: string; method?: string; headers?: Record<string, string>; body?: string; timeoutMs?: number; maxBytes?: number; signal?: AbortSignal }): Promise<string> {'
);

replaceOnce(
  'browser fetch abort signal',
  '    body: opts.body,\n  });',
  '    body: opts.body,\n    signal: opts.signal,\n  });'
);

regexReplaceOnce(
  'requestJson signal type',
  /async function requestJson<T = any>\(opts: \{ url: string; method\?: string; headers\?: Record<string, string>; body\?: any; timeoutMs\?: number; maxBytes\?: number \}\): Promise<T> \{/,
  'async function requestJson<T = any>(opts: { url: string; method?: string; headers?: Record<string, string>; body?: any; timeoutMs?: number; maxBytes?: number; signal?: AbortSignal }): Promise<T> {'
);

// 3) Website chain scan can now receive abort signals.
regexReplaceOnce(
  'loadChainWebsite signal param',
  /async function loadChainWebsite\(symbol: string\): Promise<ChainLoadResult> \{\n    const url = buildPublicChainUrl\(symbol\);\n    const html = await requestText\(\{ url, timeoutMs: 16000, maxBytes: 3_500_000 \}\);/,
  'async function loadChainWebsite(symbol: string, signal?: AbortSignal): Promise<ChainLoadResult> {\n    const url = buildPublicChainUrl(symbol);\n    const html = await requestText({ url, timeoutMs: 16000, maxBytes: 3_500_000, signal });'
);

// 4) Add a browser abort ref beside the existing stale request guard.
if (!src.includes('chainAbortRef')) {
  replaceOnce(
    'chain abort ref',
    '  const scanRequestRef = useRef(0);\n',
    '  const scanRequestRef = useRef(0);\n  const chainAbortRef = useRef<AbortController | null>(null);\n'
  );
}

// 5) Abort older browser website scans and pass the signal into website mode.
if (!src.includes('const abortController = typeof AbortController !== "undefined"')) {
  replaceOnce(
    'scanSymbol abort controller',
    '    const requestId = ++scanRequestRef.current;\n    setLoading(true);',
    '    const requestId = ++scanRequestRef.current;\n    try { chainAbortRef.current?.abort(); } catch {}\n    const abortController = typeof AbortController !== "undefined" ? new AbortController() : null;\n    chainAbortRef.current = abortController;\n    setLoading(true);'
  );
}

replaceOnce(
  'scanSymbol website signal pass',
  '      const result = inp.dataMode === "api" ? await loadChainApi(symbol, expirationArg) : await loadChainWebsite(symbol);',
  '      const result = inp.dataMode === "api" ? await loadChainApi(symbol, expirationArg) : await loadChainWebsite(symbol, abortController?.signal);'
);

replaceOnce(
  'ignore abort errors',
  '      setScanError(err instanceof Error ? err.message : String(err));\n      if (!lastGoodChainRef.current) setChain(null);',
  '      if (err instanceof DOMException && err.name === "AbortError") return;\n      setScanError(err instanceof Error ? err.message : String(err));\n      if (!lastGoodChainRef.current) setChain(null);'
);

replaceOnce(
  'clear abort ref',
  '      if (requestId === scanRequestRef.current) setLoading(false);',
  '      if (requestId === scanRequestRef.current) {\n        if (chainAbortRef.current === abortController) chainAbortRef.current = null;\n        setLoading(false);\n      }'
);

// 6) Drawer lists already slice to 30; make the slice self-documenting and stable.
replaceOnce(
  'drawer calls row limit',
  '  const drawerCalls = useMemo(() => filteredContracts.filter((c) => c.side === "call").slice(0, 30), [filteredContracts]);',
  '  const drawerCalls = useMemo(() => filteredContracts.filter((c) => c.side === "call").slice(0, TRADING_DRAWER_ROW_LIMIT), [filteredContracts]);'
);
replaceOnce(
  'drawer puts row limit',
  '  const drawerPuts = useMemo(() => filteredContracts.filter((c) => c.side === "put").slice(0, 30), [filteredContracts]);',
  '  const drawerPuts = useMemo(() => filteredContracts.filter((c) => c.side === "put").slice(0, TRADING_DRAWER_ROW_LIMIT), [filteredContracts]);'
);

// 7) Cap rendered contract rows while preserving the full filtered count for accuracy.
if (!src.includes('containedVisibleContracts')) {
  replaceOnce(
    'contained visible rows memo',
    '  const deferredFilteredContracts = useDeferredValue(filteredContracts);\n  const deferredVisibleContracts = useDeferredValue(visibleContracts);\n',
    '  const deferredFilteredContracts = useDeferredValue(filteredContracts);\n  const deferredVisibleContracts = useDeferredValue(visibleContracts);\n  const containedVisibleContracts = useMemo(() => deferredVisibleContracts.slice(0, TRADING_CONTRACT_ROW_LIMIT), [deferredVisibleContracts]);\n  const hiddenVisibleContractCount = Math.max(0, deferredVisibleContracts.length - containedVisibleContracts.length);\n'
  );
}

replaceOnce(
  'contracts showing count',
  '            <div className="small">Showing {visibleContracts.length} rows after filters</div>',
  '            <div className="small">Showing {Math.min(visibleContracts.length, TRADING_CONTRACT_ROW_LIMIT)} of {visibleContracts.length} rows after filters</div>'
);

// 8) Add a stable, non-collapsing loading line inside the contracts island.
if (!src.includes('tradingChainStableLoadingLine')) {
  replaceOnce(
    'stable loading line before table',
    '        <div className="tableWrap mt-4">',
    '        {loading && (\n          <div className="small tradingChainStableLoadingLine" style={{ minHeight: 28, display: "flex", alignItems: "center", gap: 8, opacity: 0.9 }}>\n            <span className="badge warn">Loading chain…</span>\n            <span>Holding the last stable table height while the new chain resolves.</span>\n          </div>\n        )}\n\n        <div\n          className="tableWrap mt-4 tradingChainContainmentIsland"\n          data-trading-chain-island="true"\n          style={{\n            height: TRADING_CONTRACT_ISLAND_HEIGHT,\n            maxHeight: TRADING_CONTRACT_ISLAND_HEIGHT,\n            overflow: "auto",\n            overscrollBehavior: "contain",\n            contain: "layout paint",\n            border: "1px solid var(--line)",\n            borderRadius: 14,\n            background: "rgba(5, 8, 13, 0.22)",\n          }}\n        >'
  );
}

replaceOnce(
  'contract table map cap',
  '              {deferredVisibleContracts.map((c) => {',
  '              {containedVisibleContracts.map((c) => {'
);

if (!src.includes('hiddenVisibleContractCount > 0')) {
  replaceOnce(
    'hidden rows notice',
    '              {deferredVisibleContracts.length === 0 && (\n                <tr><td colSpan={12} className="small">No contracts matched your filters yet.</td></tr>\n              )}',
    '              {hiddenVisibleContractCount > 0 && (\n                <tr>\n                  <td colSpan={12} className="small">\n                    Showing the first {TRADING_CONTRACT_ROW_LIMIT} stable rows. Narrow search, side, OI, max ask, or strike bucket to reveal {hiddenVisibleContractCount} more.\n                  </td>\n                </tr>\n              )}\n              {deferredVisibleContracts.length === 0 && (\n                <tr><td colSpan={12} className="small">No contracts matched your filters yet.</td></tr>\n              )}'
  );
}

// 9) Add a small diagnostic marker to the root card so screenshots make the applied pass obvious without changing layout.
replaceOnce(
  'root containment marker',
  '    <div className="card tradingPanelRoot">',
  '    <div className="card tradingPanelRoot" data-trading-chain-containment="v10.36.14">'
);

if (src === original) {
  writeReport({ ok: true, changed: false, notes, message: 'Trading containment patch was already applied or no patch targets matched.' });
  console.log('✅ v10.36.14 Trading containment patch appears already applied.');
  process.exit(0);
}

fs.writeFileSync(tradingPath, src, 'utf8');
writeReport({ ok: true, changed: true, notes, file: path.relative(root, tradingPath) });
console.log('✅ v10.36.14 Trading chain containment patch applied.');
console.log(`Report written to ${path.relative(root, reportPath)}`);
