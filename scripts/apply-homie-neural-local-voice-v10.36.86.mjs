import fs from "node:fs";
import path from "node:path";

const VERSION = "v10.36.86";
const root = process.cwd();

function fail(message) {
  console.error("[" + VERSION + "] " + message);
  process.exit(1);
}

const srcBridge = path.join(root, "files", "backend_scaffold", "homie-neural-voice-bridge.mjs");
const srcProfile = path.join(root, "files", "backend_scaffold", "homie_clone_profile.v1.json");
const dstBridge = path.join(root, "backend_scaffold", "homie-neural-voice-bridge.mjs");
const dstProfile = path.join(root, "backend_scaffold", "homie_clone_profile.v1.json");

for (const file of [srcBridge, srcProfile]) {
  if (!fs.existsSync(file)) fail("Missing source file: " + file);
}

fs.mkdirSync(path.dirname(dstBridge), { recursive: true });
if (fs.existsSync(dstBridge) && !fs.existsSync(dstBridge + ".bak_v10.36.86")) fs.copyFileSync(dstBridge, dstBridge + ".bak_v10.36.86");
if (fs.existsSync(dstProfile) && !fs.existsSync(dstProfile + ".bak_v10.36.86")) fs.copyFileSync(dstProfile, dstProfile + ".bak_v10.36.86");

fs.copyFileSync(srcBridge, dstBridge);
if (!fs.existsSync(dstProfile)) fs.copyFileSync(srcProfile, dstProfile);

for (const name of [
  "RUN_HOMIE_NEURAL_VOICE_BRIDGE_v10.36.86.bat",
  "TEST_HOMIE_NEURAL_VOICE_BRIDGE_v10.36.86.ps1",
  "README_HOMIE_NEURAL_VOICE_BRIDGE_v10.36.86.txt"
]) {
  const src = path.join(root, "files", name);
  const dst = path.join(root, name);
  if (!fs.existsSync(src)) fail("Missing file: " + src);
  fs.copyFileSync(src, dst);
}

console.log("[" + VERSION + "] Applied Homie neural local voice bridge and clone-design scaffolding.");
