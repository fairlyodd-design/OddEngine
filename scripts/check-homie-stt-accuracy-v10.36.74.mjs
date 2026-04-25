
import fs from "node:fs";
import path from "node:path";

const VERSION = "v10.36.74";
const root = process.cwd();

const transcriberPath = path.join(root, "backend_scaffold", "homie_voice_transcribe.py");
const balancedBatPath = path.join(root, "RUN_HOMIE_VOICE_BRIDGE_BALANCED_ACCURACY_v10.36.74.bat");
const maxBatPath = path.join(root, "RUN_HOMIE_VOICE_BRIDGE_MAX_ACCURACY_v10.36.74.bat");

function fail(message) {
  console.error("[" + VERSION + "] " + message);
  process.exit(1);
}

for (const [file, label] of [[transcriberPath, "transcriber"], [balancedBatPath, "balanced bat"], [maxBatPath, "max bat"]]) {
  if (!fs.existsSync(file)) fail("Missing " + label + ": " + file);
}

const py = fs.readFileSync(transcriberPath, "utf8");
const balanced = fs.readFileSync(balancedBatPath, "utf8");
const max = fs.readFileSync(maxBatPath, "utf8");

const pyNeedles = [
  "v10.36.74 checker-safe marker",
  "v10.36.74 Homie STT accuracy helper settings",
  "env_bool",
  "env_int",
  "stt_initial_prompt",
  "beam_size = max(1, env_int(\"HOMIE_WHISPER_BEAM_SIZE\", 5))",
  "vad_filter = env_bool(\"HOMIE_WHISPER_VAD\", False)",
  "condition_on_previous_text",
  "accuracyMode",
  "v10.36.74-command-phrase-stabilized",
];

for (const needle of pyNeedles) {
  if (!py.includes(needle)) fail("Missing transcriber marker/text: " + needle);
}

if (!balanced.includes("HOMIE_WHISPER_MODEL=base.en")) fail("Balanced bridge does not use base.en.");
if (!balanced.includes("HOMIE_WHISPER_VAD=false")) fail("Balanced bridge does not disable VAD.");
if (!max.includes("HOMIE_WHISPER_MODEL=small.en")) fail("Max bridge does not use small.en.");
if (!max.includes("HOMIE_WHISPER_BEAM_SIZE=5")) fail("Max bridge missing beam size.");

console.log("[" + VERSION + "] Check passed.");
console.log("Next: stop old bridge; run RUN_HOMIE_VOICE_BRIDGE_BALANCED_ACCURACY_v10.36.74.bat");
