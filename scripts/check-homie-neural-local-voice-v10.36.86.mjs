import fs from "node:fs";
import path from "node:path";

const VERSION = "v10.36.86";
const root = process.cwd();

const checks = [
  path.join(root, "backend_scaffold", "homie-neural-voice-bridge.mjs"),
  path.join(root, "backend_scaffold", "homie_clone_profile.v1.json"),
  path.join(root, "RUN_HOMIE_NEURAL_VOICE_BRIDGE_v10.36.86.bat"),
  path.join(root, "TEST_HOMIE_NEURAL_VOICE_BRIDGE_v10.36.86.ps1"),
  path.join(root, "README_HOMIE_NEURAL_VOICE_BRIDGE_v10.36.86.txt")
];

for (const file of checks) {
  if (!fs.existsSync(file)) {
    console.error("[" + VERSION + "] Missing file: " + file);
    process.exit(1);
  }
}

const bridge = fs.readFileSync(path.join(root, "backend_scaffold", "homie-neural-voice-bridge.mjs"), "utf8");
const profile = fs.readFileSync(path.join(root, "backend_scaffold", "homie_clone_profile.v1.json"), "utf8");

for (const needle of [
  "OddEngine Homie Neural Voice Bridge v10.36.86",
  "defaultCloneProfile",
  "/preview",
  "/speak",
  "detectEmotion",
  "detectGesture",
  "shapeCloneText",
  "providerConfigured"
]) {
  if (!bridge.includes(needle)) {
    console.error("[" + VERSION + "] Missing bridge marker/text: " + needle);
    process.exit(1);
  }
}

for (const needle of [
  "\"schema\": \"oddengine.homie.clone-profile.v1\"",
  "\"displayName\": \"Homie\"",
  "\"signatureTone\":",
  "\"userLikenessNotes\":"
]) {
  if (!profile.includes(needle)) {
    console.error("[" + VERSION + "] Missing clone profile marker/text: " + needle);
    process.exit(1);
  }
}

console.log("[" + VERSION + "] Check passed.");
