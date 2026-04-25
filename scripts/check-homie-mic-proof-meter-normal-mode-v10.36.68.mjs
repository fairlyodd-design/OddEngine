import fs from "node:fs";
import path from "node:path";

const VERSION = "v10.36.68";
const root = process.cwd();

const buddyPath = path.join(root, "ui", "src", "components", "HomieBuddy.tsx");
const cssPath = path.join(root, "ui", "src", "components", "homieRebuild.css");
const coachPath = path.join(root, "ui", "src", "lib", "homieCompanionCoach.ts");

function fail(message) {
  console.error("[" + VERSION + "] " + message);
  process.exit(1);
}

for (const [file, label] of [[buddyPath, "HomieBuddy.tsx"], [cssPath, "homieRebuild.css"], [coachPath, "homieCompanionCoach.ts"]]) {
  if (!fs.existsSync(file)) fail("Missing " + label);
}

const buddy = fs.readFileSync(buddyPath, "utf8");
const css = fs.readFileSync(cssPath, "utf8");
const coach = fs.readFileSync(coachPath, "utf8");

const buddyNeedles = [
  "v10.36.68 checker-safe marker",
  "homieMicProofStatus",
  "homieMicLevel",
  "homieMicPeak",
  "runHomieMicProofTest",
  "startHomieMicLevelProbe",
  "finishHomieMicProofWithoutTranscript",
  'data-homie-mic-proof="v10.36.68"',
  "Permission means the browser may use the mic. Signal means audio moved. Transcript means Homie actually caught words.",
  "Clear family/OS companion replies. Grounding only when you ask for it."
];

for (const needle of buddyNeedles) {
  if (!buddy.includes(needle)) fail("Missing HomieBuddy marker/text: " + needle);
}

const cssNeedles = [
  "v10.36.68 Homie Mic Proof Meter",
  ".homieMicProofMeter",
  ".homieMicLevelTrack"
];

for (const needle of cssNeedles) {
  if (!css.includes(needle)) fail("Missing CSS marker/text: " + needle);
}

if (!coach.includes("v10.36.68 tone nudge") && !coach.includes("v10.36.67 Homie plain family companion tone helpers")) {
  fail("Coach tone helper marker missing.");
}

console.log("[" + VERSION + "] Check passed.");
console.log("Next: cd ui; npm run typecheck; npm run build");