
import fs from "node:fs";
import path from "node:path";

const VERSION = "v10.36.76";
const root = process.cwd();
const buddyPath = path.join(root, "ui", "src", "components", "HomieBuddy.tsx");

function fail(message) {
  console.error("[" + VERSION + "] " + message);
  process.exit(1);
}

if (!fs.existsSync(buddyPath)) fail("Missing ui/src/components/HomieBuddy.tsx");
const tsx = fs.readFileSync(buddyPath, "utf8");

const needles = [
  "v10.36.76 checker-safe marker",
  "HOMIE_VOICE_MIN_EXTERNAL_RECORDING_MS = 3600",
  "HOMIE_VOICE_MAX_EXTERNAL_RECORDING_MS = 45000",
  "HOMIE_VOICE_MIN_AUDIO_BLOB_BYTES = 6000",
  "HOMIE_VOICE_EXTERNAL_POSTROLL_MS",
  "v10.36.76 partial bridge transcript guard",
  "Bridge only caught one word",
  "say one full sentence, pause, then click Stop listening",
];

for (const needle of needles) {
  if (!tsx.includes(needle)) fail("Missing marker/text: " + needle);
}

if (tsx.includes("recorder.start(250);")) fail("Old fragmented recorder.start(250) is still present.");

console.log("[" + VERSION + "] Check passed.");
console.log("Next: cd ui; npm run typecheck; npm run build");
