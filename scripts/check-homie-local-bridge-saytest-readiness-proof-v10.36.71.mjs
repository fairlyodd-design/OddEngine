import fs from "node:fs";
import path from "node:path";

const VERSION = "v10.36.71";
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
  "v10.36.71 checker-safe marker",
  "homieBridgeProofStatus",
  "homieBridgeDoctorStatus",
  "homieBridgeRoundTripStatus",
  "runHomieDirectBridgeProof",
  "runHomieDirectBridgeDoctor",
  "runHomieLocalBridgeSayTest",
  "Bridge say test",
  'data-homie-bridge-proof="v10.36.71"',
  "Bridge transcript captured"
];

for (const needle of buddyNeedles) {
  if (!buddy.includes(needle)) fail("Missing HomieBuddy marker/text: " + needle);
}

const cssNeedles = [
  "v10.36.71 Homie Local Bridge Proof Card",
  ".homieBridgeProofCard",
  ".homieBridgeProofHead"
];

for (const needle of cssNeedles) {
  if (!css.includes(needle)) fail("Missing CSS marker/text: " + needle);
}

console.log("[" + VERSION + "] Check passed.");
console.log("Next: cd ui; npm run typecheck; npm run build");