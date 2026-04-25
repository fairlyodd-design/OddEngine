import fs from "node:fs";
import path from "node:path";

const VERSION = "v10.36.70";
const root = process.cwd();

const buddyPath = path.join(root, "ui", "src", "components", "HomieBuddy.tsx");

function fail(message) {
  console.error("[" + VERSION + "] " + message);
  process.exit(1);
}

if (!fs.existsSync(buddyPath)) fail("Missing ui/src/components/HomieBuddy.tsx");

const buddy = fs.readFileSync(buddyPath, "utf8");

const needles = [
  "v10.36.70 checker-safe marker",
  "v10.36.70 Homie direct browser bridge helpers",
  "callHomieVoiceBridgeProbe",
  "callHomieVoiceBridgeTranscribe",
  "homieBridgeFetchJson",
  "/health",
  "/transcribe",
  "Use local bridge",
  "Direct browser bridge is ready"
];

for (const needle of needles) {
  if (!buddy.includes(needle)) fail("Missing HomieBuddy marker/text: " + needle);
}

if (buddy.includes("External/local voice bridge transcription is only available in desktop mode.")) {
  fail("Old desktop-only transcription guard is still present.");
}

console.log("[" + VERSION + "] Check passed.");
console.log("Next: cd ui; npm run typecheck; npm run build");