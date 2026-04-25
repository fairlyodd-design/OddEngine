import fs from "node:fs";
import path from "node:path";

const VERSION = "v10.36.67";
const root = process.cwd();

const buddyPath = path.join(root, "ui", "src", "components", "HomieBuddy.tsx");
const coachPath = path.join(root, "ui", "src", "lib", "homieCompanionCoach.ts");

function fail(message) {
  console.error("[" + VERSION + "] " + message);
  process.exit(1);
}

if (!fs.existsSync(buddyPath)) fail("Missing HomieBuddy.tsx");
if (!fs.existsSync(coachPath)) fail("Missing homieCompanionCoach.ts");

const buddy = fs.readFileSync(buddyPath, "utf8");
const coach = fs.readFileSync(coachPath, "utf8");

const buddyNeedles = [
  "v10.36.67 checker-safe marker",
  'data-homie-mic-reality="v10.36.67"',
  "Say test",
  "Mic permission",
  "Camera is visual only",
  "Mic heard:",
  "Listening — say one short sentence now."
];

for (const needle of buddyNeedles) {
  if (!buddy.includes(needle)) fail("Missing HomieBuddy marker/text: " + needle);
}

const coachNeedles = [
  "v10.36.67 checker-safe marker",
  "v10.36.67 Homie plain family companion tone helpers",
  "isHomieMicCameraQuestion",
  "companionInfoReply",
  "Speaker out: working",
  "Camera: visual only right now",
  "Homie should answer like a clear family/OS companion",
  "quick companion check"
];

for (const needle of coachNeedles) {
  if (!coach.includes(needle)) fail("Missing coach marker/text: " + needle);
}

console.log("[" + VERSION + "] Check passed.");
console.log("Next: cd ui; npm run typecheck; npm run build");