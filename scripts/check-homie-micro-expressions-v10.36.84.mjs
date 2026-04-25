import fs from "node:fs";
import path from "node:path";

const VERSION = "v10.36.84";
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
  "v10.36.84 checker-safe marker",
  "const blinkA = reduceMotion ? 1 : (Math.sin(time * 0.83) > 0.989 ? 0.08 : 1);",
  "const browRaise = moodGood ? 1.8 : moodWarn ? -1.2 : 0.8 + (isListening ? 1.6 : 0);",
  "const mouthSmile = mouthBase + mouthSpeak + (isListening ? 2.2 : 0);",
  "Canvas presence",
]) {
  if (!rive.includes(needle)) fail("Missing Rive marker/text: " + needle);
}
for (const needle of [
  "v10.36.84 Homie micro-expressions + premium idle presence",
  ".homieCanvasFallbackClip{",
  ".homieCanvasFallbackBadge{",
  ".homieRebuildPresenceLine,",
]) {
  if (!css.includes(needle)) fail("Missing CSS marker/text: " + needle);
}
console.log("[" + VERSION + "] Check passed.");
console.log("Next: cd ui; npm run typecheck; npm run build");