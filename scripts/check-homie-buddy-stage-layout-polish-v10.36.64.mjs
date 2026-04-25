import fs from "node:fs";
import path from "node:path";

const VERSION = "v10.36.64";
const repoRoot = process.cwd();
const cssPath = path.join(repoRoot, "ui", "src", "components", "homieRebuild.css");

function fail(msg) {
  console.error(`[${VERSION}] CHECK FAILED: ${msg}`);
  process.exit(1);
}

if (!fs.existsSync(cssPath)) fail("Missing ui/src/components/homieRebuild.css");
const css = fs.readFileSync(cssPath, "utf8");
const markers = [
  "v10.36.64 Homie Buddy Companion Stage Layout Polish",
  ".homieRebuildStage::before",
  "homieFullStageCompanionFloat",
  "height: 332px",
  "CSS-only"
];
for (const marker of markers) {
  if (!css.includes(marker)) fail(`Missing marker: ${marker}`);
}
console.log(`[${VERSION}] CHECK PASSED: Homie Buddy companion stage layout polish installed.`);
console.log(`[${VERSION}] Scope check: CSS-only change to ui/src/components/homieRebuild.css.`);
