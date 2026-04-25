import fs from "node:fs";
import path from "node:path";

const VERSION = "v10.36.81b";
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
  "v10.36.81b checker-safe marker",
  "function supportsHomieWebGL",
  "class HomieRiveBoundary",
  'setWebglStatus(supportsHomieWebGL() ? "ok" : "unsupported")',
  'Desktop fallback',
  'reason="Rive WebGL runtime failed in desktop mode."',
]) {
  if (!rive.includes(needle)) fail("Missing Rive marker/text: " + needle);
}

if (!css.includes("v10.36.81b Homie desktop webgl fallback hotfix")) fail("Missing CSS marker.");

console.log("[" + VERSION + "] Check passed.");
console.log("Next: cd ui; npm run typecheck; npm run build");