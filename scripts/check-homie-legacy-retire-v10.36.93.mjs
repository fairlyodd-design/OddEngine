import fs from "node:fs";
import path from "node:path";

const VERSION = "v10.36.93";
const root = process.cwd();
const homiePath = path.join(root, "ui", "src", "panels", "Homie.tsx");

function fail(message) {
  console.error("[" + VERSION + "] " + message);
  process.exit(1);
}
if (!fs.existsSync(homiePath)) fail("Missing Homie.tsx");

const src = fs.readFileSync(homiePath, "utf8");

for (const needle of [
  'const [showLegacyAvatar, setShowLegacyAvatar] = useState(false);',
  'const homiePanelRef = useRef<HTMLDivElement | null>(null);',
  'data-homie-legacy-stage-retired="v10.36.93"',
  'data-homie-unified-lead="v10.36.93"',
  'data-homie-legacy-disclosure="v10.36.93"',
  'Unified companion lead',
  'Legacy preview',
  'Lock this lead lane',
  'Show legacy preview',
]) {
  if (!src.includes(needle)) fail("Missing Homie marker/text: " + needle);
}

console.log("[" + VERSION + "] Check passed.");
console.log("Next: cd ui; npm run typecheck; npm run build");
