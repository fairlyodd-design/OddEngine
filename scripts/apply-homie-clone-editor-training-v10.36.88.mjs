
import fs from "node:fs";
import path from "node:path";

const VERSION = "v10.36.88";
const root = process.cwd();

function fail(message) {
  console.error("[" + VERSION + "] " + message);
  process.exit(1);
}

const targets = [
  ["files/backend_scaffold/homie-neural-voice-bridge.mjs", "backend_scaffold/homie-neural-voice-bridge.mjs"],
  ["files/backend_scaffold/homie_clone_profile.v1.json", "backend_scaffold/homie_clone_profile.v1.json"],
  ["files/backend_scaffold/homie_clone_memory_bank.v1.json", "backend_scaffold/homie_clone_memory_bank.v1.json"],
  ["files/backend_scaffold/homie_clone_family_phrases.v1.json", "backend_scaffold/homie_clone_family_phrases.v1.json"],
  ["files/backend_scaffold/homie_clone_voice_training_manifest.v1.json", "backend_scaffold/homie_clone_voice_training_manifest.v1.json"],
  ["files/backend_scaffold/homie_clone_profile_editor.v10.36.88.html", "backend_scaffold/homie_clone_profile_editor.v10.36.88.html"],
  ["files/backend_scaffold/homie_clone_voice_training_drop/README_DROP_HOMIE_FAMILY_VOICE_SAMPLES.txt", "backend_scaffold/homie_clone_voice_training_drop/README_DROP_HOMIE_FAMILY_VOICE_SAMPLES.txt"],
  ["files/RUN_HOMIE_NEURAL_VOICE_BRIDGE_v10.36.88.bat", "RUN_HOMIE_NEURAL_VOICE_BRIDGE_v10.36.88.bat"],
  ["files/TEST_HOMIE_NEURAL_VOICE_BRIDGE_v10.36.88.ps1", "TEST_HOMIE_NEURAL_VOICE_BRIDGE_v10.36.88.ps1"],
  ["files/OPEN_HOMIE_CLONE_PROFILE_EDITOR_v10.36.88.bat", "OPEN_HOMIE_CLONE_PROFILE_EDITOR_v10.36.88.bat"],
  ["files/GENERATE_HOMIE_FAMILY_VOICE_TRAINING_MANIFEST_v10.36.88.ps1", "GENERATE_HOMIE_FAMILY_VOICE_TRAINING_MANIFEST_v10.36.88.ps1"],
  ["files/README_HOMIE_CLONE_EDITOR_TRAINING_v10.36.88.txt", "README_HOMIE_CLONE_EDITOR_TRAINING_v10.36.88.txt"],
];

for (const [srcRel, dstRel] of targets) {
  const src = path.join(root, srcRel);
  const dst = path.join(root, dstRel);
  if (!fs.existsSync(src)) fail("Missing source file: " + src);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  if (fs.existsSync(dst) && !fs.existsSync(dst + ".bak_v10.36.88")) fs.copyFileSync(dst, dst + ".bak_v10.36.88");

  const preserveIfExists = [
    "backend_scaffold/homie_clone_profile.v1.json",
    "backend_scaffold/homie_clone_memory_bank.v1.json",
    "backend_scaffold/homie_clone_family_phrases.v1.json",
    "backend_scaffold/homie_clone_voice_training_manifest.v1.json",
  ];
  if (preserveIfExists.includes(dstRel) && fs.existsSync(dst)) {
    // keep user-edited state files intact
  } else {
    fs.copyFileSync(src, dst);
  }
}

console.log("[" + VERSION + "] Applied Homie clone profile editor and family voice training workflow pass.");
