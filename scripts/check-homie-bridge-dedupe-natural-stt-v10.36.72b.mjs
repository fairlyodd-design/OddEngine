import fs from "node:fs";
import path from "node:path";

const VERSION = "v10.36.72b";
const root = process.cwd();

const buddyPath = path.join(root, "ui", "src", "components", "HomieBuddy.tsx");
const coachPath = path.join(root, "ui", "src", "lib", "homieCompanionCoach.ts");
const cssPath = path.join(root, "ui", "src", "components", "homieRebuild.css");
const batPath = path.join(root, "RUN_HOMIE_VOICE_BRIDGE_HIGH_ACCURACY_v10.36.72.bat");

function fail(message) {
  console.error("[" + VERSION + "] " + message);
  process.exit(1);
}

function countMatches(text, needle) {
  return text.split(needle).length - 1;
}

for (const [file, label] of [[buddyPath, "HomieBuddy.tsx"], [coachPath, "homieCompanionCoach.ts"], [cssPath, "homieRebuild.css"], [batPath, "high accuracy bridge bat"]]) {
  if (!fs.existsSync(file)) fail("Missing " + label + ": " + file);
}

const buddy = fs.readFileSync(buddyPath, "utf8");
const coach = fs.readFileSync(coachPath, "utf8");
const css = fs.readFileSync(cssPath, "utf8");
const bat = fs.readFileSync(batPath, "utf8");

const duplicateFunctionNeedles = [
  "function normalizeHomieBridgeBaseUrl",
  "function isDesktopBridgeUnavailable",
  "async function homieBridgeFetchJson",
  "async function callHomieVoiceBridgeProbe",
  "async function callHomieVoiceBridgeTranscribe",
];

for (const needle of duplicateFunctionNeedles) {
  const count = countMatches(buddy, needle);
  if (count !== 1) fail("Expected exactly one " + needle + ", found " + count);
}

const buddyNeedles = [
  "v10.36.72b checker-safe marker",
  "Use local bridge",
  "Probe 8765",
  "RUN_HOMIE_VOICE_BRIDGE_HIGH_ACCURACY_v10.36.72.bat"
];

for (const needle of buddyNeedles) {
  if (!buddy.includes(needle)) fail("Missing HomieBuddy marker/text: " + needle);
}

const coachNeedles = [
  "v10.36.72b checker-safe marker",
  "v10.36.72b Homie natural STT repair helpers",
  "homieLooksLikeSTTDrift",
  "buildHomieTinyAckReply",
  "buildHomieSTTDriftReply",
  "Anytime, Homie",
  "I won’t pretend I understood it perfectly"
];

for (const needle of coachNeedles) {
  if (!coach.includes(needle)) fail("Missing coach marker/text: " + needle);
}

if (coach.includes("Useful read: keep Homie as an informational family/OS companion first")) {
  fail("Old repetitive informational boilerplate still present.");
}

if (!css.includes("v10.36.72b Homie STT Natural Reply Repair")) fail("Missing CSS marker.");
if (!bat.includes("HOMIE_WHISPER_MODEL=base.en")) fail("High accuracy bridge bat missing base.en setting.");

console.log("[" + VERSION + "] Check passed.");
console.log("Next: cd ui; npm run typecheck; npm run build");