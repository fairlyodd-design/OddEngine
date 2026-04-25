import fs from "node:fs";
import path from "node:path";

const VERSION = "v10.36.89b";
const root = process.cwd();
const panelPath = path.join(root, "ui", "src", "panels", "HomieCloneStudio.tsx");

function fail(message) {
  console.error("[" + VERSION + "] " + message);
  process.exit(1);
}
if (!fs.existsSync(panelPath)) fail("Missing file: " + panelPath);

const src = fs.readFileSync(panelPath, "utf8");

for (const needle of [
  'v10.36.89b checker-safe marker',
  'Format: <code className="mono">{\'[{"text":"Keep the room calm.","lane":"family","notes":"core tone"}]\'}</code>',
]) {
  if (!src.includes(needle)) fail("Missing marker/text: " + needle);
}

console.log("[" + VERSION + "] Check passed.");
console.log("Next: cd ui; npm run typecheck; npm run build");