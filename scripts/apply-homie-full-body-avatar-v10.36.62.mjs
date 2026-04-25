import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const VERSION = "v10.36.62";
const PASS = "HomieFullBodyAvatarNotOrbPolishPass";
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
mustExist(componentSrc, "full-body Homie3D component source");

const ts = new Date().toISOString().replace(/[:.]/g, "-");
const backupPath = `${homiePath}.bak_${VERSION}_${ts}`;
fs.copyFileSync(homiePath, backupPath);

fs.mkdirSync(path.dirname(componentDst), { recursive: true });
fs.copyFileSync(componentSrc, componentDst);

let homie = fs.readFileSync(homiePath, "utf8");
const importLine = 'import Homie3DCompanion from "../components/Homie3DCompanion";';
if (!homie.includes(importLine)) {
  const firstImportRE = /(import[^\n]+\r?\n)/;
  if (!firstImportRE.test(homie)) fail("Could not find an import anchor in Homie.tsx");
  homie = homie.replace(firstImportRE, `$1${importLine}\n`);
}

const marker = "v10.36.62 checker-safe marker: Homie full-body not-orb companion polish installed";
if (!homie.includes(marker)) {
  homie = homie.replace(importLine, `${importLine}\n// ${marker}`);
}

const componentCall = '<Homie3DCompanion activePanelId={activePanelId} onNavigate={onNavigate} />';
if (!homie.includes(componentCall)) {
  const tabsRE = /(<div\s+className="tabs"\s+style=\{\{\s*marginBottom:\s*10\s*\}\}>)/;
  if (!tabsRE.test(homie)) fail("Could not find Homie tabs anchor in Homie.tsx");
  const block = `\n      <div data-homie-3d-companion-host="v10.36.62" data-homie-not-orb-mode="v10.36.62">\n        ${componentCall}\n      </div>\n`;
  homie = homie.replace(tabsRE, `${block}$1`);
} else {
  homie = homie.replace(/data-homie-3d-companion-host="v10\.36\.61"/g, 'data-homie-3d-companion-host="v10.36.62"');
  if (!homie.includes('data-homie-not-orb-mode="v10.36.62"')) {
    homie = homie.replace(/data-homie-3d-companion-host="v10\.36\.62"/, 'data-homie-3d-companion-host="v10.36.62" data-homie-not-orb-mode="v10.36.62"');
  }
}

fs.writeFileSync(homiePath, homie, "utf8");

console.log(`[${VERSION}] ${PASS} applied.`);
console.log(`[${VERSION}] Backup created: ${path.relative(repoRoot, backupPath)}`);
console.log(`[${VERSION}] Updated: ${path.relative(repoRoot, componentDst)}`);
console.log(`[${VERSION}] Homie is no longer just an orb. Full-body avatar component is installed.`);
