import fs from "node:fs";
import path from "node:path";

const VERSION = "v10.36.97";
const root = process.cwd();
const dstPath = path.join(root, "ui", "src", "panels", "Homie.tsx");

function fail(message) {
  console.error("[" + VERSION + "] " + message);
  process.exit(1);
}
ensure();

function ensure() {
  if (!fs.existsSync(dstPath)) fail("Missing ui/src/panels/Homie.tsx");
}

const src = fs.readFileSync(dstPath, "utf8");
for (const needle of [
  "v10.36.97 checker-safe marker",
  'data-homie-single-visual-owner="v10.36.97"',
  'data-homie-legacy-preview="v10.36.97"',
  'data-homie-guide-tab="v10.36.97"',
  "Unified companion lead",
  "Single visual owner",
  "Legacy preview",
  "Talk with Homie",
]) {
  if (!src.includes(needle)) fail("Missing marker/text: " + needle);
}

console.log("[" + VERSION + "] Check passed.");
console.log("Next: cd ui; npm run typecheck; npm run build");