import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const tradingPath = path.join(root, 'ui', 'src', 'panels', 'Trading.tsx');
const reportPath = path.join(root, 'v10.36.14g-trading-chain-containment-compile-restore-report.json');

const report = {
  pass: 'v10.36.14g_TradingChainContainmentCompileRestorePass',
  root,
  tradingPath,
  startedAt: new Date().toISOString(),
  actions: [],
  warnings: [],
  ok: false,
};

function fail(message) {
  report.ok = false;
  report.error = message;
  report.finishedAt = new Date().toISOString();
  try { fs.writeFileSync(reportPath, JSON.stringify(report, null, 2)); } catch {}
  console.error(`\nERROR: ${message}\n`);
  process.exit(1);
}

function action(message) {
  report.actions.push(message);
  console.log(`OK: ${message}`);
}

if (!fs.existsSync(tradingPath)) {
  fail('ui/src/panels/Trading.tsx was not found. Run this from C:\\OddEngine.');
}

let src = fs.readFileSync(tradingPath, 'utf8');
const original = src;

const backupPath = `${tradingPath}.bak_v10.36.14g_${Date.now()}`;
fs.writeFileSync(backupPath, original, 'utf8');
action(`backup created: ${path.relative(root, backupPath)}`);

// 1) Remove the broken abort-controller fragments from earlier failed passes.
// The existing scanRequestRef request-id guard already ignores late responses, so this restores compile safety.
const beforeAbortCleanup = src;
src = src
  .replace(/\s*const\s+abortController\s*=\s*new\s+AbortController\(\);\s*/g, '\n')
  .replace(/\s*chainAbortRef\.current\?\.abort\(\);\s*/g, '\n')
  .replace(/\s*chainAbortRef\.current\s*=\s*abortController;\s*/g, '\n')
  .replace(/\s*if\s*\(\s*chainAbortRef\.current\s*===\s*abortController\s*\)\s*chainAbortRef\.current\s*=\s*null;\s*/g, '\n')
  .replace(/\s*const\s+chainAbortRef\s*=\s*useRef\s*<\s*AbortController\s*\|\s*null\s*>\s*\(\s*null\s*\);\s*/g, '\n')
  .replace(/loadChainWebsite\(symbol\s*,\s*abortController\?\.signal\)/g, 'loadChainWebsite(symbol)')
  .replace(/loadChainWebsite\(symbol\s*,\s*abortController\.signal\)/g, 'loadChainWebsite(symbol)')
  .replace(/loadChainWebsite\(symbol\s*,\s*undefined\)/g, 'loadChainWebsite(symbol)');
if (src !== beforeAbortCleanup) action('removed broken abort-controller fragments and restored loadChainWebsite(symbol) calls');
else action('abort-controller cleanup found nothing to remove');

// 2) Insert containment constants without depending on the old missing constants block.
const constantsBlock = `\nconst TRADING_DRAWER_ROW_LIMIT = 30;\nconst TRADING_CONTRACT_ROW_LIMIT = 120;\nconst TRADING_CONTRACT_ISLAND_HEIGHT = 520;\n`;
if (!src.includes('const TRADING_DRAWER_ROW_LIMIT')) {
  if (src.includes('function clamp(n: number)')) {
    src = src.replace(/\nfunction clamp\(n: number\)/, `${constantsBlock}\nfunction clamp(n: number)`);
    action('inserted Trading containment constants before clamp()');
  } else if (src.includes('const TRADING_EVENT =')) {
    src = src.replace(/(const TRADING_EVENT\s*=\s*[^;]+;\s*)/, `$1${constantsBlock}`);
    action('inserted Trading containment constants after TRADING_EVENT');
  } else {
    fail('Could not insert containment constants. No clamp() or TRADING_EVENT anchor found.');
  }
} else {
  action('Trading containment constants already present');
}

// 3) Insert containedVisibleContracts declaration near deferredVisibleContracts.
if (!/const\s+containedVisibleContracts\s*=/.test(src)) {
  const anchor = '  const deferredVisibleContracts = useDeferredValue(visibleContracts);';
  const containedBlock = `${anchor}\n  const containedVisibleContracts = useMemo(\n    () => deferredVisibleContracts.slice(0, TRADING_CONTRACT_ROW_LIMIT),\n    [deferredVisibleContracts]\n  );`;
  if (src.includes(anchor)) {
    src = src.replace(anchor, containedBlock);
    action('inserted containedVisibleContracts row cap after deferredVisibleContracts');
  } else {
    fail('Could not insert containedVisibleContracts. deferredVisibleContracts anchor was not found.');
  }
} else {
  action('containedVisibleContracts already present');
}

// 4) If the table still maps the full deferred list, switch it to the capped list.
const beforeMapFix = src;
src = src.replace(/\{deferredVisibleContracts\.map\(\(c\)\s*=>\s*\{/g, '{containedVisibleContracts.map((c) => {');
src = src.replace(/\{deferredVisibleContracts\.map\(\(c:\s*PublicContract\)\s*=>\s*\{/g, '{containedVisibleContracts.map((c) => {');
if (src !== beforeMapFix) action('switched contracts table map to containedVisibleContracts');
else action('contracts table already maps containedVisibleContracts or no full-map pattern found');

// 5) Make empty-state logic compatible with row cap: it should test the full filtered list, not only capped rows.
// Keep as-is unless earlier patches accidentally changed it.
src = src.replace(/\{containedVisibleContracts\.length === 0 && \(/g, '{deferredVisibleContracts.length === 0 && (');

// 6) Add a harmless diagnostic marker to the contracts island if possible.
if (!src.includes('data-trading-chain-containment="v10.36.14g"')) {
  const markerPattern = /<div\s+className="tableWrap mt-4"/;
  if (markerPattern.test(src)) {
    src = src.replace(markerPattern, '<div data-trading-chain-containment="v10.36.14g" className="tableWrap mt-4"');
    action('added v10.36.14g diagnostic marker to contracts island');
  } else if (src.includes('data-trading-chain-containment="v10.36.14"')) {
    src = src.replace(/data-trading-chain-containment="v10\.36\.14[a-z]?"/g, 'data-trading-chain-containment="v10.36.14g"');
    action('updated existing diagnostic marker to v10.36.14g');
  } else {
    report.warnings.push('Could not add diagnostic marker; tableWrap anchor not found.');
  }
} else {
  action('diagnostic marker already present');
}

// 7) Ensure the table wrapper has containment sizing. Repair partial style blocks if the previous pass inserted constants.
// This script does not depend on CSS classes; inline style keeps the island stable even if global CSS changes.
if (src.includes('height: TRADING_CONTRACT_ISLAND_HEIGHT') || src.includes('maxHeight: TRADING_CONTRACT_ISLAND_HEIGHT')) {
  action('contracts island height constants are referenced');
} else {
  report.warnings.push('No inline TRADING_CONTRACT_ISLAND_HEIGHT reference found. The compile fix will still proceed; containment may rely on existing CSS.');
}

// Write patched file.
fs.writeFileSync(tradingPath, src, 'utf8');

// 8) Hard validation focused on compile blockers from the failed 14/14b/14c/14d/14e/14f attempts.
const final = fs.readFileSync(tradingPath, 'utf8');
const missing = [];
for (const token of [
  'const TRADING_DRAWER_ROW_LIMIT',
  'const TRADING_CONTRACT_ROW_LIMIT',
  'const TRADING_CONTRACT_ISLAND_HEIGHT',
  'const containedVisibleContracts',
  'containedVisibleContracts.map',
]) {
  if (!final.includes(token)) missing.push(token);
}
if (/abortController/.test(final)) missing.push('remove stray abortController reference');
if (/chainAbortRef/.test(final)) missing.push('remove stray chainAbortRef reference');
if (/loadChainWebsite\(symbol\s*,\s*abortController/.test(final)) missing.push('remove loadChainWebsite abortController argument');

if (missing.length) {
  fail(`Hard validation failed. Missing/failing: ${missing.join(', ')}`);
}

report.ok = true;
report.finishedAt = new Date().toISOString();
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log('\n✅ v10.36.14g Trading chain containment compile restore applied.');
console.log(`Report written to ${path.basename(reportPath)}`);
console.log('Next: run RUN_v10.36.14g_TRADING_CHAIN_CHECK.bat');
