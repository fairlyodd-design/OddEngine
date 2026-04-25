import fs from "node:fs";
import path from "node:path";
const VERSION = "v10.36.73c";
const root = process.cwd();
const buddyPath = path.join(root, "ui", "src", "components", "HomieBuddy.tsx");
const coachPath = path.join(root, "ui", "src", "lib", "homieCompanionCoach.ts");
const batPath = path.join(root, "RUN_HOMIE_VOICE_BRIDGE_HIGH_ACCURACY_v10.36.73.bat");
function fail(message){ console.error("["+VERSION+"] "+message); process.exit(1); }
function countMatches(text, needle){ return text.split(needle).length - 1; }
for (const p of [buddyPath, coachPath, batPath]) if (!fs.existsSync(p)) fail("Missing " + p);
const buddy = fs.readFileSync(buddyPath, "utf8");
const coach = fs.readFileSync(coachPath, "utf8");
const bat = fs.readFileSync(batPath, "utf8");
for (const name of ["normalizeHomieBridgeBaseUrl", "isDesktopBridgeUnavailable", "homieBridgeFetchJson", "callHomieVoiceBridgeProbe", "callHomieVoiceBridgeTranscribe"]) {
  const count = countMatches(buddy, "function " + name) + countMatches(buddy, "async function " + name);
  if (count > 1) fail("Duplicate bridge helper remains: " + name + " count=" + count);
}
for (const needle of ["v10.36.73c checker-safe marker", "runHomieLocalBridgeSayTest", 'data-homie-bridge-say-test="v10.36.73c"']) {
  if (!buddy.includes(needle)) fail("Missing HomieBuddy marker/text: " + needle);
}
for (const needle of ["v10.36.73c checker-safe marker", "homieV73cShortAck", "homieV73cDriftReply", "Anytime, Homie"]) {
  if (!coach.includes(needle)) fail("Missing coach marker/text: " + needle);
}
if (!bat.includes("HOMIE_WHISPER_MODEL=base.en")) fail("High accuracy bridge launcher is missing base.en setting.");
console.log("["+VERSION+"] Check passed.");
console.log("Next: cd ui; npm run typecheck; npm run build");
