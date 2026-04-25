
import fs from "node:fs";
import path from "node:path";

const VERSION = "v10.36.87";
const root = process.cwd();

function fail(message) {
  console.error("[" + VERSION + "] " + message);
  process.exit(1);
}

const targets = [
  ["files/backend_scaffold/homie-neural-voice-bridge.mjs", "backend_scaffold/homie-neural-voice-bridge.mjs"],
  ["files/backend_scaffold/homie_clone_profile.v1.json", "backend_scaffold/homie_clone_profile.v1.json"],
  ["files/backend_scaffold/homie_clone_memory_bank.v1.json", "backend_scaffold/homie_clone_memory_bank.v1.json"],
  ["files/backend_scaffold/homie_clone_ingest_drop/README_DROP_HOMIE_CLONE_MEMORY.txt", "backend_scaffold/homie_clone_ingest_drop/README_DROP_HOMIE_CLONE_MEMORY.txt"],
  ["files/RUN_HOMIE_NEURAL_VOICE_BRIDGE_v10.36.87.bat", "RUN_HOMIE_NEURAL_VOICE_BRIDGE_v10.36.87.bat"],
  ["files/TEST_HOMIE_NEURAL_VOICE_BRIDGE_v10.36.87.ps1", "TEST_HOMIE_NEURAL_VOICE_BRIDGE_v10.36.87.ps1"],
  ["files/INGEST_HOMIE_CLONE_DROP_FOLDER_v10.36.87.ps1", "INGEST_HOMIE_CLONE_DROP_FOLDER_v10.36.87.ps1"],
  ["files/EXPORT_HOMIE_CLONE_STUDIO_PACK_v10.36.87.ps1", "EXPORT_HOMIE_CLONE_STUDIO_PACK_v10.36.87.ps1"],
  ["files/README_HOMIE_CLONE_STUDIO_MEMORY_v10.36.87.txt", "README_HOMIE_CLONE_STUDIO_MEMORY_v10.36.87.txt"],
];

for (const [srcRel, dstRel] of targets) {
  const src = path.join(root, srcRel);
  const dst = path.join(root, dstRel);
  if (!fs.existsSync(src)) fail("Missing source file: " + src);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  if (fs.existsSync(dst) && !fs.existsSync(dst + ".bak_v10.36.87")) fs.copyFileSync(dst, dst + ".bak_v10.36.87");
  if (dstRel.endsWith("homie_clone_profile.v1.json") && fs.existsSync(dst)) {
    // preserve user edits if profile already exists
  } else if (dstRel.endsWith("homie_clone_memory_bank.v1.json") && fs.existsSync(dst)) {
    // preserve memory bank if it already exists
  } else {
    fs.copyFileSync(src, dst);
  }
}

console.log("[" + VERSION + "] Applied Homie clone profile studio + memory ingestion pass.");
