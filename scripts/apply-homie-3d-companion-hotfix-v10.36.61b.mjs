import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const VERSION = "v10.36.61b";
const PASS = "Homie3DCompanionApplyAndTypecheckHotfixPass";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = process.cwd();
const passRoot = path.resolve(__dirname, "..");

function fail(msg) {
  console.error(`[${VERSION}] ${msg}`);
  process.exit(1);
}

function mustExist(filePath, label) {
  if (!fs.existsSync(filePath)) fail(`Missing ${label}: ${filePath}`);
}

const homiePath = path.join(repoRoot, "ui", "src", "panels", "Homie.tsx");
const componentSrc = path.join(passRoot, "ui", "src", "components", "Homie3DCompanion.tsx");
const componentDst = path.join(repoRoot, "ui", "src", "components", "Homie3DCompanion.tsx");

mustExist(homiePath, "Homie panel");
mustExist(componentSrc, "fixed Homie3D component source");

const ts = new Date().toISOString().replace(/[:.]/g, "-");
const backupPath = `${homiePath}.bak_${VERSION}_${ts}`;
fs.copyFileSync(homiePath, backupPath);

fs.mkdirSync(path.dirname(componentDst), { recursive: true });
fs.copyFileSync(componentSrc, componentDst);

let homie = fs.readFileSync(homiePath, "utf8");

const importLine = 'import Homie3DCompanion from "../components/Homie3DCompanion";';
if (!homie.includes(importLine)) {
  const reactImportRE = /(import\s+React\s*,\s*\{[^\n]*useState[^\n]*\}\s+from\s+["']react["'];\r?\n)/;
  if (reactImportRE.test(homie)) {
    homie = homie.replace(reactImportRE, `$1${importLine}\n`);
  } else {
    const firstImportRE = /(import[^\n]+\r?\n)/;
    if (!firstImportRE.test(homie)) fail("Could not find any import anchor in Homie.tsx");
    homie = homie.replace(firstImportRE, `$1${importLine}\n`);
  }
}

const hostAttr = 'data-homie-3d-companion-host="v10.36.61"';
if (!homie.includes(hostAttr)) {
  const tabsRE = /(\r?\n\s*<div\s+className="tabs"\s+style=\{\{\s*marginBottom:\s*10\s*\}\}>)/;
  if (!tabsRE.test(homie)) fail("Could not find Homie tabs anchor in Homie.tsx");
  const block = `\n      <div data-homie-3d-companion-host="v10.36.61" data-homie-3d-hotfix="v10.36.61b">\n        <Homie3DCompanion activePanelId={activePanelId} onNavigate={onNavigate} />\n      </div>\n`;
  homie = homie.replace(tabsRE, `${block}$1`);
} else if (!homie.includes('data-homie-3d-hotfix="v10.36.61b"')) {
  homie = homie.replace(hostAttr, `${hostAttr} data-homie-3d-hotfix="v10.36.61b"`);
}

if (!homie.includes("v10.36.61b checker-safe marker")) {
  homie = homie.replace(importLine, `${importLine}\n// v10.36.61b checker-safe marker: Homie 3D apply/typecheck hotfix installed`);
}

fs.writeFileSync(homiePath, homie, "utf8");

console.log(`[${VERSION}] ${PASS} applied.`);
console.log(`[${VERSION}] Backup created: ${path.relative(repoRoot, backupPath)}`);
console.log(`[${VERSION}] Added/updated: ${path.relative(repoRoot, componentDst)}`);
console.log(`[${VERSION}] Homie.tsx import/block patch is CRLF-safe.`);
