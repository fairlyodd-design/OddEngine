import fs from "node:fs";
import path from "node:path";

const VERSION = "v10.36.69";
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
  "v10.36.69 checker-safe marker",
  "homieMicDevices",
  "homieSelectedMicDeviceId",
  "homieMicDeviceStatus",
  "getHomieMicAudioConstraints",
  "refreshHomieMicDevices",
  "runHomieSelectedMicLevelCheck",
  'data-homie-mic-device-picker="v10.36.69"',
  "Test selected mic",
  "Refresh mics",
  "browser SpeechRecognition usually listens to the system default mic"
];

for (const needle of buddyNeedles) {
  if (!buddy.includes(needle)) fail("Missing HomieBuddy marker/text: " + needle);
}

const cssNeedles = [
  "v10.36.69 Homie Mic Device Picker",
  ".homieMicDevicePicker",
  ".homieMicDevicePicker select"
];

for (const needle of cssNeedles) {
  if (!css.includes(needle)) fail("Missing CSS marker/text: " + needle);
}

console.log("[" + VERSION + "] Check passed.");
console.log("Next: cd ui; npm run typecheck; npm run build");