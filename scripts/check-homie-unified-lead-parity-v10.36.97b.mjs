import fs from "node:fs";
import path from "node:path";

const VERSION = "v10.36.97b";
const root = process.cwd();
const dstPath = path.join(root, "ui", "src", "panels", "Homie.tsx");

function fail(message) {
  console.error("[" + VERSION + "] " + message);
  process.exit(1);
}
if (!fs.existsSync(dstPath)) fail("Missing ui/src/panels/Homie.tsx");

const src = fs.readFileSync(dstPath, "utf8");
for (const needle of [
  "v10.36.97b checker-safe marker",
  'data-homie-lead-avatar-parity="v10.36.97b"',
  'data-homie-lead-avatar-parity-hotfix="v10.36.97b"',
  "Lead avatar mount parity",
  "Same working companion shell as the right-side lane",
  "Legacy preview",
]) {
  if (!src.includes(needle)) fail("Missing marker/text: " + needle);
}

console.log("[" + VERSION + "] Check passed.");
console.log("Next: cd ui; npm run typecheck; npm run build");