import fs from "node:fs";
import path from "node:path";

const VERSION = "v10.36.91";
const root = process.cwd();
const rivePath = path.join(root, "ui", "src", "components", "RiveHomie.tsx");
const cssPath = path.join(root, "ui", "src", "components", "homieRebuild.css");

function fail(message) {
  console.error("[" + VERSION + "] " + message);
  process.exit(1);
}

for (const file of [rivePath, cssPath]) {
  if (!fs.existsSync(file)) fail("Missing file: " + file);
}

const rive = fs.readFileSync(rivePath, "utf8");
const css = fs.readFileSync(cssPath, "utf8");

for (const needle of [
  "v10.36.91 checker-safe marker",
  "Desktop-safe avatar",
  "const hoodie = ctx.createLinearGradient(0, 4, 0, 160);",
  "const jeanGrad = ctx.createLinearGradient(0, 120, 0, 232);",
  "const capGrad = ctx.createLinearGradient(0, -158, 0, -92);",
  "const beardGrad = ctx.createLinearGradient(0, -22, 0, 72);",
  "const leftBlink = wink ? 0.12 : blink;",
]) {
  if (!rive.includes(needle)) fail("Missing Rive marker/text: " + needle);
}

for (const needle of [
  "v10.36.91 Homie memoji-inspired full-body hoodie avatar",
  ".homieCanvasFallbackClip{",
  ".homieCanvasFallbackBadge{",
  ".homieRebuildPresenceLine,",
]) {
  if (!css.includes(needle)) fail("Missing CSS marker/text: " + needle);
}

console.log("[" + VERSION + "] Check passed.");
console.log("Next: cd ui; npm run typecheck; npm run build");