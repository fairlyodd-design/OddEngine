import fs from "node:fs";
import path from "node:path";

const VERSION = "v10.36.90";
const root = process.cwd();
const homiePath = path.join(root, "ui", "src", "panels", "Homie.tsx");

function fail(message) {
  console.error("[" + VERSION + "] " + message);
  process.exit(1);
}
if (!fs.existsSync(homiePath)) fail("Missing Homie.tsx");

const src = fs.readFileSync(homiePath, "utf8");

for (const needle of [
  'data-homie-clone-quick-access="v10.36.90"',
  'data-homie-clone-bridge-readiness="v10.36.90"',
  'Open Clone Studio',
  'Help me shape Homie to feel more like me without sounding fake or corporate.',
  'Honest lane: this shapes tone, phrases, memory, and workflow.',
]) {
  if (!src.includes(needle)) fail("Missing Homie marker/text: " + needle);
}

console.log("[" + VERSION + "] Check passed.");
console.log("Next: cd ui; npm run typecheck; npm run build");