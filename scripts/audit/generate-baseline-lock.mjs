import fs from 'fs';
import path from 'path';

const root = process.cwd();
const panelsDir = path.join(root, 'ui', 'src', 'panels');
const appPath = path.join(root, 'ui', 'src', 'App.tsx');
const brainPath = path.join(root, 'ui', 'src', 'lib', 'brain.ts');
const outDir = path.join(root, 'docs', 'generated');

function readText(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function uniq(arr) {
  return [...new Set(arr)].sort((a, b) => a.localeCompare(b));
}

function collectPanelFiles() {
  if (!fs.existsSync(panelsDir)) {
    throw new Error(`Panels directory not found: ${panelsDir}`);
  }
  return fs.readdirSync(panelsDir)
    .filter((name) => /\.(tsx|ts|jsx|js)$/.test(name))
    .map((name) => ({
      file: name,
      id: name.replace(/\.(tsx|ts|jsx|js)$/i, ''),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function extractBalancedBlock(text, anchor, openChar = '{', closeChar = '}') {
  const start = text.indexOf(anchor);
  if (start === -1) return '';
  const blockStart = text.indexOf(openChar, start);
  if (blockStart === -1) return '';
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let escaped = false;
  for (let i = blockStart; i < text.length; i += 1) {
    const ch = text[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (!inDouble && !inTemplate && ch === "'") inSingle = !inSingle;
    else if (!inSingle && !inTemplate && ch === '"') inDouble = !inDouble;
    else if (!inSingle && !inDouble && ch === '`') inTemplate = !inTemplate;
    if (inSingle || inDouble || inTemplate) continue;
    if (ch === openChar) depth += 1;
    else if (ch === closeChar) {
      depth -= 1;
      if (depth === 0) {
        return text.slice(blockStart, i + 1);
      }
    }
  }
  return '';
}


function extractBalancedBlockAfterIndex(text, startSearch, openChar = '{', closeChar = '}') {
  const blockStart = text.indexOf(openChar, startSearch);
  if (blockStart === -1) return '';
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let escaped = false;
  for (let i = blockStart; i < text.length; i += 1) {
    const ch = text[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (!inDouble && !inTemplate && ch === "'") inSingle = !inSingle;
    else if (!inSingle && !inTemplate && ch === '"') inDouble = !inDouble;
    else if (!inSingle && !inDouble && ch === '`') inTemplate = !inTemplate;
    if (inSingle || inDouble || inTemplate) continue;
    if (ch === openChar) depth += 1;
    else if (ch === closeChar) {
      depth -= 1;
      if (depth === 0) {
        return text.slice(blockStart, i + 1);
      }
    }
  }
  return '';
}

function parseAppRegistry(appText) {
  const block = extractBalancedBlock(appText, 'const PANEL_COMPONENTS', '{', '}');
  const entries = [];
  const lazyPanelRx = /(\w+)\s*:\s*lazyPanel\(\s*['"]([^'"]+)['"]\s*\)/g;
  let m;
  while ((m = lazyPanelRx.exec(block))) {
    entries.push({
      key: m[1],
      target: m[2],
      kind: 'lazyPanel',
    });
  }

  const directLazyRx = /(\w+)\s*:\s*lazy\s*\(\s*\(\)\s*=>\s*import\(\s*['"]\.\/panels\/([^'"]+)['"]\s*\)\s*\)/g;
  while ((m = directLazyRx.exec(block))) {
    entries.push({
      key: m[1],
      target: path.basename(m[2]),
      kind: 'lazyImport',
    });
  }

  return entries.sort((a, b) => a.key.localeCompare(b.key));
}

function parseAppSwitchCases(appText) {
  const routes = [];
  const rx = /case\s+(?:'|")([^'"]+)(?:'|")\s*:/g;
  let m;
  while ((m = rx.exec(appText))) routes.push(m[1]);
  return uniq(routes);
}

function parseBrainRawMeta(brainText) {
  const rawStart = brainText.indexOf('const RAW_PANEL_META');
  const assignIndex = rawStart === -1 ? -1 : brainText.indexOf('=', rawStart);
  const block = (assignIndex === -1 ? '' : extractBalancedBlockAfterIndex(brainText, assignIndex, '[', ']')) || brainText;
  const ids = [];
  const hidden = new Set();
  const idRx = /id\s*:\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = idRx.exec(block))) {
    ids.push(m[1]);
    const end = block.indexOf('}', m.index);
    const snippet = block.slice(m.index, end === -1 ? Math.min(block.length, m.index + 400) : end + 1);
    if (/hiddenFromRail\s*:\s*true/.test(snippet)) hidden.add(m[1]);
  }
  return { ids: uniq(ids), hiddenIds: uniq([...hidden]) };
}

function parseCanonicalOverrides(brainText) {
  const block = extractBalancedBlock(brainText, 'const CANONICAL_PANEL_OVERRIDES', '{', '}');
  const map = {};
  const rx = /([A-Za-z0-9_]+)\s*:\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = rx.exec(block))) {
    map[m[1]] = m[2];
  }
  return map;
}

function parseAliasPairs(brainText) {
  const pairs = [];
  const rx = /pairs\.push\(([^\)]*)\)/g;
  let m;
  while ((m = rx.exec(brainText))) {
    const chunk = m[1];
    const pairRx = /\[\s*['"]([^'"]+)['"]\s*,\s*p\.id\s*\]/g;
    let p;
    while ((p = pairRx.exec(chunk))) pairs.push(p[1]);
  }
  return uniq(pairs);
}

function normalizeBrainPublicIds(rawIds, overrides, hiddenIds) {
  const out = [];
  for (const id of rawIds) {
    if (hiddenIds.includes(id)) continue;
    const canonical = overrides[id] || (id.endsWith('Panel') && rawIds.includes(id.replace(/Panel$/i, '')) ? id.replace(/Panel$/i, '') : id);
    out.push(canonical);
  }
  return uniq(out);
}

function analyzeBrainMentions(brainText, panelIds) {
  const mentions = {};
  for (const id of panelIds) {
    const literal = new RegExp(`['\"]${id}['\"]`, 'g');
    const word = new RegExp(`\\b${id}\\b`, 'g');
    mentions[id] = (brainText.match(literal)?.length || 0) + (brainText.match(word)?.length || 0);
  }
  return mentions;
}

function isTradingPanel(id) {
  return /(trade|trading|market|option|scanner|strategy|radar|flow|portfolio|institutional|risk|execution|simulator|capitalflow|fiftyto1k|timemachine)/i.test(id);
}

function formatList(items, empty = '- none') {
  if (!items.length) return empty;
  return items.map((item) => `- ${item}`).join('\n');
}

function main() {
  ensureDir(outDir);

  const panelFiles = collectPanelFiles();
  const panelIds = panelFiles.map((x) => x.id);
  const appText = readText(appPath);
  const brainText = readText(brainPath);

  const appRegistry = parseAppRegistry(appText);
  const appRegistryKeys = uniq(appRegistry.map((x) => x.key));
  const appRegistryTargets = uniq(appRegistry.map((x) => x.target));
  const appSwitchCases = parseAppSwitchCases(appText);
  const brainRaw = parseBrainRawMeta(brainText);
  const canonicalOverrides = parseCanonicalOverrides(brainText);
  const brainPublicIds = normalizeBrainPublicIds(brainRaw.ids, canonicalOverrides, brainRaw.hiddenIds);
  const brainMentions = analyzeBrainMentions(brainText, panelIds);
  const aliasSamples = parseAliasPairs(brainText);

  const appLoadableIds = uniq([...appRegistryKeys, ...appSwitchCases]);

  const missingInAppRegistry = panelIds.filter((id) => !appRegistryKeys.includes(id) && !appRegistryTargets.includes(id));
  const missingInAppLoadable = panelIds.filter((id) => !appLoadableIds.includes(id));
  const missingInBrainRaw = panelIds.filter((id) => !brainRaw.ids.includes(id));
  const missingInBrainPublic = panelIds.filter((id) => !brainPublicIds.includes(id));
  const orphanRegistryKeys = appRegistryKeys.filter((id) => !panelIds.includes(id));
  const orphanRegistryTargets = appRegistryTargets.filter((id) => !panelIds.includes(id));
  const orphanBrainRaw = brainRaw.ids.filter((id) => !panelIds.includes(id));

  const tradingPanels = panelIds.filter(isTradingPanel);
  const tradingStatus = tradingPanels.map((id) => ({
    id,
    hasFile: true,
    inAppRegistry: appRegistryKeys.includes(id) || appRegistryTargets.includes(id),
    loadableByApp: appLoadableIds.includes(id) || appRegistryKeys.includes(id) || appRegistryTargets.includes(id),
    inBrainRaw: brainRaw.ids.includes(id),
    inBrainPublic: brainPublicIds.includes(id),
    brainMentionCount: brainMentions[id] || 0,
  }));

  const manifest = {
    generatedAt: new Date().toISOString(),
    repoRoot: root,
    counts: {
      panelFiles: panelFiles.length,
      appRegistryEntries: appRegistry.length,
      appRegistryKeys: appRegistryKeys.length,
      appLoadableIds: appLoadableIds.length,
      appSwitchCases: appSwitchCases.length,
      brainRawIds: brainRaw.ids.length,
      brainPublicIds: brainPublicIds.length,
      brainMentionedPanels: panelIds.filter((id) => (brainMentions[id] || 0) > 0).length,
      tradingPanels: tradingPanels.length,
    },
    panelFiles,
    appRegistry,
    appRegistryKeys,
    appRegistryTargets,
    appSwitchCases,
    appLoadableIds,
    brainRawIds: brainRaw.ids,
    brainHiddenIds: brainRaw.hiddenIds,
    brainPublicIds,
    canonicalOverrides,
    aliasSamples,
    brainMentions,
    missingInAppRegistry,
    missingInAppLoadable,
    missingInBrainRaw,
    missingInBrainPublic,
    orphanRegistryKeys,
    orphanRegistryTargets,
    orphanBrainRaw,
    tradingStatus,
  };

  writeJson(path.join(outDir, 'baseline-lock-manifest.json'), manifest);
  writeJson(path.join(outDir, 'baseline-lock-panel-files.json'), panelFiles);
  writeJson(path.join(outDir, 'baseline-lock-app-registry.json'), appRegistry);
  writeJson(path.join(outDir, 'baseline-lock-app-loadable-ids.json'), appLoadableIds);
  writeJson(path.join(outDir, 'baseline-lock-brain-raw-ids.json'), brainRaw.ids);
  writeJson(path.join(outDir, 'baseline-lock-brain-public-ids.json'), brainPublicIds);
  writeJson(path.join(outDir, 'baseline-lock-trading-status.json'), tradingStatus);

  const report = `# App routing audit + trading baseline lock report

Generated: ${manifest.generatedAt}
Repo root: \`${root}\`

## Counts

- Panel files: ${manifest.counts.panelFiles}
- App registry entries: ${manifest.counts.appRegistryEntries}
- App loadable ids: ${manifest.counts.appLoadableIds}
- App switch-case routes: ${manifest.counts.appSwitchCases}
- Brain raw ids: ${manifest.counts.brainRawIds}
- Brain public ids: ${manifest.counts.brainPublicIds}
- Brain-mentioned panels: ${manifest.counts.brainMentionedPanels}
- Trading-related panels: ${manifest.counts.tradingPanels}

## What this audit understands now

- file-backed panels in \`ui/src/panels\`
- registry-backed panels in \`const PANEL_COMPONENTS\`
- dynamic \`lazyPanel("Name")\` wiring
- legacy \`case "PanelId":\` switch routes when present
- brain raw ids + canonical/public panel ids

## Missing in App registry

${formatList(missingInAppRegistry)}

## Missing in App loadable ids

${formatList(missingInAppLoadable)}

## Missing in Brain raw ids

${formatList(missingInBrainRaw)}

## Missing in Brain public ids

${formatList(missingInBrainPublic)}

## Orphan App registry keys

${formatList(orphanRegistryKeys)}

## Orphan App registry targets

${formatList(orphanRegistryTargets)}

## Orphan Brain raw ids

${formatList(orphanBrainRaw)}

## Trading panel status

${tradingStatus.map((row) => `- ${row.id}: registry=${row.inAppRegistry ? 'yes' : 'no'}, loadable=${row.loadableByApp ? 'yes' : 'no'}, brainRaw=${row.inBrainRaw ? 'yes' : 'no'}, brainPublic=${row.inBrainPublic ? 'yes' : 'no'}, mentions=${row.brainMentionCount}`).join('\n') || '- none'}

## Canonical override map

${Object.keys(canonicalOverrides).length ? Object.entries(canonicalOverrides).map(([from, to]) => `- ${from} → ${to}`).join('\n') : '- none'}

## Alias samples found in brain helpers

${formatList(aliasSamples.slice(0, 40))}

## Next move

Treat this report as the baseline truth source. Restore or re-wire only the panels marked as missing from the App registry or missing from App loadable ids, then re-run the audit before doing another feature pass.
`;

  fs.writeFileSync(path.join(outDir, 'baseline-lock-report.md'), report, 'utf8');

  console.log('App routing audit + trading baseline lock complete.');
  console.log(`Panel files: ${manifest.counts.panelFiles}`);
  console.log(`App registry entries: ${manifest.counts.appRegistryEntries}`);
  console.log(`App loadable ids: ${manifest.counts.appLoadableIds}`);
  console.log(`Brain raw ids: ${manifest.counts.brainRawIds}`);
  console.log(`Brain public ids: ${manifest.counts.brainPublicIds}`);
  console.log(`Trading panels: ${manifest.counts.tradingPanels}`);
  console.log(`Report: ${path.join(outDir, 'baseline-lock-report.md')}`);
}

main();
