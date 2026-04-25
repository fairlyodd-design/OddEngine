import fs from "node:fs";
import path from "node:path";

const VERSION = "v10.36.99";
const root = process.cwd();
const dstPath = path.join(root, "ui", "src", "panels", "Homie.tsx");

function fail(message) {
  console.error(`[${VERSION}] ${message}`);
  process.exit(1);
}
if (!fs.existsSync(dstPath)) fail("Missing ui/src/panels/Homie.tsx");

const src = fs.readFileSync(dstPath, "utf8");
for (const needle of [
  "v10.36.99 checker-safe marker",
  'data-homie-lead-avatar-hero="v10.36.99"',
  'data-homie-hero-parity-match="v10.36.99"',
  "Hero parity + right-lane match",
  "Head shape tightened",
  "Eye spacing tuned",
  "Mouth shape refined",
  "Aura softened",
  'data-homie-legacy-preview="v10.36.99"',
]) {
  if (!src.includes(needle)) fail("Missing marker/text: " + needle);
}
console.log(`[${VERSION}] Check passed.`);
console.log("Next: cd ui; npm run typecheck; npm run build");