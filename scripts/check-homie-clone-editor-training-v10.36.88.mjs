
import fs from "node:fs";
import path from "node:path";

const VERSION = "v10.36.88";
const root = process.cwd();

const checks = [
  path.join(root, "backend_scaffold", "homie-neural-voice-bridge.mjs"),
  path.join(root, "backend_scaffold", "homie_clone_profile.v1.json"),
  path.join(root, "backend_scaffold", "homie_clone_memory_bank.v1.json"),
  path.join(root, "backend_scaffold", "homie_clone_family_phrases.v1.json"),
  path.join(root, "backend_scaffold", "homie_clone_voice_training_manifest.v1.json"),
  path.join(root, "backend_scaffold", "homie_clone_profile_editor.v10.36.88.html"),
  path.join(root, "backend_scaffold", "homie_clone_voice_training_drop", "README_DROP_HOMIE_FAMILY_VOICE_SAMPLES.txt"),
  path.join(root, "RUN_HOMIE_NEURAL_VOICE_BRIDGE_v10.36.88.bat"),
  path.join(root, "TEST_HOMIE_NEURAL_VOICE_BRIDGE_v10.36.88.ps1"),
  path.join(root, "OPEN_HOMIE_CLONE_PROFILE_EDITOR_v10.36.88.bat"),
  path.join(root, "GENERATE_HOMIE_FAMILY_VOICE_TRAINING_MANIFEST_v10.36.88.ps1"),
  path.join(root, "README_HOMIE_CLONE_EDITOR_TRAINING_v10.36.88.txt"),
];

for (const file of checks) {
  if (!fs.existsSync(file)) {
    console.error("[" + VERSION + "] Missing file: " + file);
    process.exit(1);
  }
}

const bridge = fs.readFileSync(path.join(root, "backend_scaffold", "homie-neural-voice-bridge.mjs"), "utf8");
for (const needle of [
  "OddEngine Homie Clone Profile Editor + Family Voice Training Workflow Bridge v10.36.88",
  "/family-phrases",
  "/training-workflow",
  "/generate-training-manifest",
  "shapeCloneText",
  "phraseBlend",
  "buildTrainingManifest",
]) {
  if (!bridge.includes(needle)) {
    console.error("[" + VERSION + "] Missing bridge marker/text: " + needle);
    process.exit(1);
  }
}

console.log("[" + VERSION + "] Check passed.");
