
import fs from "node:fs";
import path from "node:path";

const VERSION = "v10.36.78";
const root = process.cwd();
const bridgePath = path.join(root, "backend_scaffold", "homie-voice-bridge.mjs");

function fail(message) {
  console.error("[" + VERSION + "] " + message);
  process.exit(1);
}

if (!fs.existsSync(bridgePath)) fail("Missing backend_scaffold/homie-voice-bridge.mjs");
const js = fs.readFileSync(bridgePath, "utf8");

const needles = [
  "v10.36.78 checker-safe marker",
  "HOMIE_VOICE_KEEP_AUDIO",
  "debugAudioDir",
  "captureDebugAudio",
  "debugAudioPath",
  "transcribeMs",
  "voiceDebugNote",
  "debugAudioCapture",
  "TEST_HOMIE_VOICE_TRANSCRIPTION_FAILURE_v10.36.78.ps1"
];

for (const needle of needles) {
  if (!js.includes(needle)) fail("Missing bridge marker/text: " + needle);
}

console.log("[" + VERSION + "] Check passed.");
console.log("Next: stop old bridge and run RUN_HOMIE_VOICE_BRIDGE_DEBUG_CAPTURE_v10.36.78.bat");
