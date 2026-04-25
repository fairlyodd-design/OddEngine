import fs from "node:fs";
import path from "node:path";

const VERSION = "v10.36.92";
const root = process.cwd();

const homiePath = path.join(root, "ui", "src", "panels", "Homie.tsx");
const unifiedPath = path.join(root, "ui", "src", "components", "HomieUnifiedAvatar.tsx");

function fail(message) {
  console.error("[" + VERSION + "] " + message);
  process.exit(1);
}
for (const file of [homiePath, unifiedPath]) {
  if (!fs.existsSync(file)) fail("Missing file: " + file);
}

const homie = fs.readFileSync(homiePath, "utf8");
const unified = fs.readFileSync(unifiedPath, "utf8");

for (const needle of [
  'import HomieUnifiedAvatar from "../components/HomieUnifiedAvatar";',
  'data-homie-visual-unify="v10.36.92"',
  'Unified companion preview',
  'Lock this visual lane',
]) {
  if (!homie.includes(needle)) fail("Missing Homie marker/text: " + needle);
}

for (const needle of [
  'v10.36.92 checker-safe marker',
  'data-homie-unified-avatar="v10.36.92"',
  'Unified Homie visual lane',
  'Memoji-inspired hoodie companion',
]) {
  if (!unified.includes(needle)) fail("Missing unified avatar marker/text: " + needle);
}

console.log("[" + VERSION + "] Check passed.");
console.log("Next: cd ui; npm run typecheck; npm run build");