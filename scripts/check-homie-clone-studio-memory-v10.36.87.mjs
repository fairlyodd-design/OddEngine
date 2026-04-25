
import fs from "node:fs";
import path from "node:path";

const VERSION = "v10.36.87";
const root = process.cwd();

const checks = [
  path.join(root, "backend_scaffold", "homie-neural-voice-bridge.mjs"),
  path.join(root, "backend_scaffold", "homie_clone_profile.v1.json"),
  path.join(root, "backend_scaffold", "homie_clone_memory_bank.v1.json"),
  path.join(root, "backend_scaffold", "homie_clone_ingest_drop", "README_DROP_HOMIE_CLONE_MEMORY.txt"),
  path.join(root, "RUN_HOMIE_NEURAL_VOICE_BRIDGE_v10.36.87.bat"),
  path.join(root, "TEST_HOMIE_NEURAL_VOICE_BRIDGE_v10.36.87.ps1"),
  path.join(root, "INGEST_HOMIE_CLONE_DROP_FOLDER_v10.36.87.ps1"),
  path.join(root, "EXPORT_HOMIE_CLONE_STUDIO_PACK_v10.36.87.ps1"),
  path.join(root, "README_HOMIE_CLONE_STUDIO_MEMORY_v10.36.87.txt"),
];

for (const file of checks) {
  if (!fs.existsSync(file)) {
    console.error("[" + VERSION + "] Missing file: " + file);
    process.exit(1);
  }
}

const bridge = fs.readFileSync(path.join(root, "backend_scaffold", "homie-neural-voice-bridge.mjs"), "utf8");
for (const needle of [
  "OddEngine Homie Clone Studio + Memory Bridge v10.36.87",
  "/memory-bank",
  "/ingest-memory",
  "/build-studio-pack",
  "shapeCloneText",
  "memoryBlend",
  "buildStudioPack",
]) {
  if (!bridge.includes(needle)) {
    console.error("[" + VERSION + "] Missing bridge marker/text: " + needle);
    process.exit(1);
  }
}

console.log("[" + VERSION + "] Check passed.");
