import fs from "node:fs";
import path from "node:path";

const VERSION = "v10.36.94";
const root = process.cwd();
const homiePath = path.join(root, "ui", "src", "panels", "Homie.tsx");

function fail(message) {
  console.error("[" + VERSION + "] " + message);
  process.exit(1);
}
if (!fs.existsSync(homiePath)) fail("Missing ui/src/panels/Homie.tsx");

const src = fs.readFileSync(homiePath, "utf8");

for (const needle of [
  'const [showLegacyAvatar, setShowLegacyAvatar] = useState(false);',
  'data-homie-hard-render-split="v10.36.94"',
  'data-homie-unified-lead="v10.36.94"',
  'data-homie-legacy-toggle="v10.36.94"',
  'data-homie-hard-render-legacy-gate="v10.36.94"',
  '{showLegacyAvatar ? (',
  'Unified companion lead',
  'Render split fixed',
  'Show legacy preview',
]) {
  if (!src.includes(needle)) fail("Missing marker/text: " + needle);
}

console.log("[" + VERSION + "] Check passed.");
console.log("Next: cd ui; npm run typecheck; npm run build");