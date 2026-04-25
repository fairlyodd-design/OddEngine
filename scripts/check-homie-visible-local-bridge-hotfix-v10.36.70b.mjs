import fs from "node:fs";
import path from "node:path";

const VERSION = "v10.36.70b";
const root = process.cwd();
const buddyPath = path.join(root, "ui", "src", "components", "HomieBuddy.tsx");
const cssPath = path.join(root, "ui", "src", "components", "homieRebuild.css");

function fail(message) {
  console.error("[" + VERSION + "] " + message);
  process.exit(1);
}

if (!fs.existsSync(buddyPath)) fail("Missing HomieBuddy.tsx");
if (!fs.existsSync(cssPath)) fail("Missing homieRebuild.css");

const buddy = fs.readFileSync(buddyPath, "utf8");
const css = fs.readFileSync(cssPath, "utf8");

const buddyNeedles = [
  "v10.36.70b checker-safe marker",
  "v10.36.70b Homie visible local bridge helpers",
  "activateHomieLocalBridgeNow",
  "callHomieVoiceBridgeProbe",
  "callHomieVoiceBridgeTranscribe",
  'data-homie-visible-bridge-controls="v10.36.70b"',
  'data-homie-top-bridge-button="v10.36.70b"',
  "Use local bridge",
  "Probe 8765",
  "Direct browser bridge is ready"
];

for (const needle of buddyNeedles) {
  if (!buddy.includes(needle)) fail("Missing HomieBuddy marker/text: " + needle);
}

if (buddy.includes("External/local voice bridge transcription is only available in desktop mode.")) {
  fail("Old desktop-only transcription guard is still present.");
}

const cssNeedles = [
  "v10.36.70b Homie Visible Local Bridge Controls",
  ".homieVisibleBridgeControls",
  ".homieBridgeInlineTip"
];

for (const needle of cssNeedles) {
  if (!css.includes(needle)) fail("Missing CSS marker/text: " + needle);
}

console.log("[" + VERSION + "] Check passed.");
console.log("Next: cd ui; npm run typecheck; npm run build");