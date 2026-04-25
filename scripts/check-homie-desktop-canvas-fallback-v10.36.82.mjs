import fs from "node:fs";
import path from "node:path";

const VERSION = "v10.36.82";
const root = process.cwd();
const rivePath = path.join(root, "ui", "src", "components", "RiveHomie.tsx");
const cssPath = path.join(root, "ui", "src", "components", "homieRebuild.css");

function fail(message) {
  console.error("[" + VERSION + "] " + message);
  process.exit(1);
}
if (!fs.existsSync(rivePath)) fail("Missing RiveHomie.tsx");
if (!fs.existsSync(cssPath)) fail("Missing homieRebuild.css");

const rive = fs.readFileSync(rivePath, "utf8");
const css = fs.readFileSync(cssPath, "utf8");

for (const needle of [
  "v10.36.82 checker-safe marker",
  "function supportsHomieWebGL",
  "function CanvasHomieFallback",
  "Canvas fallback",
  "Loading avatar",
  "Desktop canvas avatar fallback installed",
]) {
  if (!rive.includes(needle)) fail("Missing Rive marker/text: " + needle);
}
for (const needle of [
  "v10.36.82 Homie desktop canvas fallback + launcher polish",
  ".homieCanvasFallbackWrap{",
  ".homieCanvasFallbackCanvas{",
  ".homieCanvasFallbackBadge{",
]) {
  if (!css.includes(needle)) fail("Missing CSS marker/text: " + needle);
}
console.log("[" + VERSION + "] Check passed.");
console.log("Next: cd ui; npm run typecheck; npm run build");