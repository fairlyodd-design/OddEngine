import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const VERSION = "v10.36.61";
const PASS = "Homie3DFullCompanionMicCamPresencePass";
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
mustExist(componentSrc, "pass component source");

const ts = new Date().toISOString().replace(/[:.]/g, "-");
const backupPath = `${homiePath}.bak_${VERSION}_${ts}`;
fs.copyFileSync(homiePath, backupPath);

fs.mkdirSync(path.dirname(componentDst), { recursive: true });
fs.copyFileSync(componentSrc, componentDst);

let homie = fs.readFileSync(homiePath, "utf8");

if (!homie.includes('Homie3DCompanion from "../components/Homie3DCompanion"')) {
  const importNeedle = 'import React, { useEffect, useMemo, useRef, useState } from "react";\n';
  if (!homie.includes(importNeedle)) fail("Could not find React import anchor in Homie.tsx");
  homie = homie.replace(importNeedle, `${importNeedle}import Homie3DCompanion from "../components/Homie3DCompanion";\n`);
}

if (!homie.includes('data-homie-3d-companion-host="v10.36.61"')) {
  const tabsNeedle = '      <div className="tabs" style={{ marginBottom: 10 }}>';
  if (!homie.includes(tabsNeedle)) fail("Could not find Homie tabs anchor in Homie.tsx");

  const block = `      <div data-homie-3d-companion-host="v10.36.61">\n        <Homie3DCompanion activePanelId={activePanelId} onNavigate={onNavigate} />\n      </div>\n\n`;
  homie = homie.replace(tabsNeedle, `${block}${tabsNeedle}`);
}

fs.writeFileSync(homiePath, homie, "utf8");

console.log(`[${VERSION}] ${PASS} applied.`);
console.log(`[${VERSION}] Backup created: ${path.relative(repoRoot, backupPath)}`);
console.log(`[${VERSION}] Added/updated: ${path.relative(repoRoot, componentDst)}`);
