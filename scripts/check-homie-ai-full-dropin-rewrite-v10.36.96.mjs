import fs from "node:fs";
import path from "node:path";

const VERSION = "v10.36.96";
const root = process.cwd();
const homiePath = path.join(root, "ui", "src", "panels", "Homie.tsx");

function fail(message) {
  console.error("[" + VERSION + "] " + message);
  process.exit(1);
}
if (!fs.existsSync(homiePath)) fail("Missing ui/src/panels/Homie.tsx");

const src = fs.readFileSync(homiePath, "utf8");

for (const needle of [
  'import HomieUnifiedAvatar from "../components/HomieUnifiedAvatar";',
  'const [showLegacyAvatar, setShowLegacyAvatar] = useState(false);',
  'data-homie-ai-full-dropin-rewrite="v10.36.96"',
  'data-homie-unified-lead="v10.36.96"',
  'data-homie-legacy-toggle="v10.36.96"',
  'data-homie-legacy-preview="v10.36.96"',
  'Unified companion lead',
  'Single companion lane',
  'Legacy preview',
  'Collapsed by default so it cannot define the main visual impression.',
]) {
  if (!src.includes(needle)) fail("Missing marker/text: " + needle);
}

console.log("[" + VERSION + "] Check passed.");
console.log("Next: cd ui; npm run typecheck; npm run build");