import fs from "node:fs";
import path from "node:path";

const VERSION = "v10.36.92b";
const root = process.cwd();

const componentPath = path.join(root, "ui", "src", "components", "HomieUnifiedAvatar.tsx");
const cssPath = path.join(root, "ui", "src", "components", "homieRebuild.css");

function fail(message) {
  console.error("[" + VERSION + "] " + message);
  process.exit(1);
}
for (const file of [componentPath, cssPath]) {
  if (!fs.existsSync(file)) fail("Missing file: " + file);
}

const component = fs.readFileSync(componentPath, "utf8");
const css = fs.readFileSync(cssPath, "utf8");

for (const needle of [
  'v10.36.92b checker-safe marker',
  'data-homie-unified-avatar-hotfix="v10.36.92b"',
  'className="homieUnifiedAvatarRive"',
  'className="homieUnifiedAvatarFallbackShell"',
]) {
  if (!component.includes(needle)) fail("Missing component marker/text: " + needle);
}

for (const needle of [
  'v10.36.92b Homie unified avatar stage render hotfix',
  '.homieUnifiedAvatarStage{',
  '.homieUnifiedAvatarRive .homieRiveClip,',
  '.homieUnifiedAvatarFallbackShell{',
]) {
  if (!css.includes(needle)) fail("Missing CSS marker/text: " + needle);
}

console.log("[" + VERSION + "] Check passed.");
console.log("Next: cd ui; npm run typecheck; npm run build");