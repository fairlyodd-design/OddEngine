import fs from "node:fs";
import path from "node:path";

const VERSION = "v10.36.98";
const root = process.cwd();
const target = path.join(root, "ui", "src", "panels", "Homie.tsx");

function fail(message) {
  console.error(`[${VERSION}] ${message}`);
  process.exit(1);
}
if (!fs.existsSync(target)) fail("Missing ui/src/panels/Homie.tsx");

const src = fs.readFileSync(target, "utf8");
for (const needle of [
  "v10.36.98 checker-safe marker",
  'data-homie-lead-avatar-premium="v10.36.98"',
  'data-homie-premium-parity-polish="v10.36.98"',
  "Premium parity polish",
  "Face proportion refined",
  "Glow softened",
  'data-homie-legacy-preview="v10.36.98"',
]) {
  if (!src.includes(needle)) fail("Missing marker/text: " + needle);
}
console.log(`[${VERSION}] Check passed.`);
console.log("Next: cd ui; npm run typecheck; npm run build");