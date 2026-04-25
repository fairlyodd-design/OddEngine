import fs from "node:fs";
import path from "node:path";

const VERSION = "v10.36.89";
const root = process.cwd();

const appPath = path.join(root, "ui", "src", "App.tsx");
const brainPath = path.join(root, "ui", "src", "lib", "brain.ts");
const panelPath = path.join(root, "ui", "src", "panels", "HomieCloneStudio.tsx");

function fail(message) {
  console.error("[" + VERSION + "] " + message);
  process.exit(1);
}
for (const file of [appPath, brainPath, panelPath]) {
  if (!fs.existsSync(file)) fail("Missing file: " + file);
}

const app = fs.readFileSync(appPath, "utf8");
const brain = fs.readFileSync(brainPath, "utf8");
const panel = fs.readFileSync(panelPath, "utf8");

for (const needle of [
  'const HomieCloneStudio = lazy(() => import("./panels/HomieCloneStudio"));',
  'case "HomieCloneStudio": return <HomieCloneStudio onNavigate={setActive} />;'
]) {
  if (!app.includes(needle)) fail("Missing App marker/text: " + needle);
}
for (const needle of [
  'id:"HomieCloneStudio"',
  'title:"Homie Clone Studio"',
  'sub:"Profile + family voice workflow"'
]) {
  if (!brain.includes(needle)) fail("Missing brain marker/text: " + needle);
}
for (const needle of [
  'data-homie-clone-os-editor="v10.36.89"',
  'data-homie-clone-consent-guide="v10.36.89"',
  'Guided voice consent workflow',
  'Generate training manifest'
]) {
  if (!panel.includes(needle)) fail("Missing panel marker/text: " + needle);
}

console.log("[" + VERSION + "] Check passed.");
console.log("Next: cd ui; npm run typecheck; npm run build");
