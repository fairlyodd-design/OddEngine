
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

function ensureFile(filePath, label) {
  if (!fs.existsSync(filePath)) fail("Missing " + label + ": " + filePath);
}

function backup(filePath) {
  const dst = filePath + ".bak_" + VERSION;
  if (!fs.existsSync(dst)) fs.copyFileSync(filePath, dst);
}

function findFunctionSpan(text, fnName) {
  const start = text.indexOf("def " + fnName + "(");
  if (start === -1) return null;
  let end = text.indexOf("\ndef ", start + 1);
  if (end === -1) end = text.length;
  return { start, end };
}

ensureFile(transcriberPath, "backend_scaffold/homie_voice_transcribe.py");
backup(transcriberPath);

let py = fs.readFileSync(transcriberPath, "utf8");

if (!py.includes("def transcribe_with_faster_whisper")) fail("Could not find faster-whisper transcriber function.");
if (!py.includes("def transcribe_with_openai_whisper")) fail("Could not find openai-whisper transcriber function.");

if (!py.includes("v10.36.74 Homie STT accuracy helper settings")) {
  const anchor = "def has_module(name):\n    return importlib.util.find_spec(name) is not None\n";
  if (!py.includes(anchor)) fail("Could not find helper insertion anchor.");

  const helperBlock = anchor + "\n" + [
    "# ===== v10.36.74 Homie STT accuracy helper settings =====",
    "def env_bool(name, default=False):",
    "    raw = str(os.environ.get(name, \"\")).strip().lower()",
    "    if not raw:",
    "        return bool(default)",
    "    return raw in {\"1\", \"true\", \"yes\", \"on\"}",
    "",
    "",
    "def env_int(name, default):",
    "    try:",
    "        return int(os.environ.get(name, default))",
    "    except Exception:",
    "        return int(default)",
    "",
    "",
    "def env_float(name, default):",
    "    try:",
    "        return float(os.environ.get(name, default))",
    "    except Exception:",
    "        return float(default)",
    "",
    "",
    "def stt_initial_prompt():",
    "    return os.environ.get(",
    "        \"HOMIE_WHISPER_INITIAL_PROMPT\",",
    "        \"Homie is a FairlyOdd OS companion. Common phrases include: Homie, Render Lab, Writers Lounge, open panel, next step, bridge say test, correction, family, legacy, start listening, stop listening.\"",
    "    )",
    "# ===== v10.36.74 Homie STT accuracy helper settings END =====",
    ""
  ].join("\n");
  py = py.replace(anchor, helperBlock);
}

if (!py.includes('"accuracySettings"')) {
  py = py.replace(
    '"model": os.environ.get("HOMIE_WHISPER_MODEL", "tiny.en"),',
    '"model": os.environ.get("HOMIE_WHISPER_MODEL", "tiny.en"),\n        "accuracySettings": {\n            "beamSize": env_int("HOMIE_WHISPER_BEAM_SIZE", 5),\n            "vadFilter": env_bool("HOMIE_WHISPER_VAD", False),\n            "language": os.environ.get("HOMIE_WHISPER_LANGUAGE", "en"),\n            "temperature": env_float("HOMIE_WHISPER_TEMPERATURE", 0.0),\n        },'
  );
}

const fasterSpan = findFunctionSpan(py, "transcribe_with_faster_whisper");
if (!fasterSpan) fail("Could not locate faster-whisper function span.");

const fasterFunction = [
  "def transcribe_with_faster_whisper(audio_path, model_name):",
  "    from faster_whisper import WhisperModel",
  "",
  "    compute_type = os.environ.get(\"HOMIE_WHISPER_COMPUTE\", \"int8\")",
  "    device = os.environ.get(\"HOMIE_WHISPER_DEVICE\", \"cpu\")",
  "    beam_size = max(1, env_int(\"HOMIE_WHISPER_BEAM_SIZE\", 5))",
  "    best_of = max(1, env_int(\"HOMIE_WHISPER_BEST_OF\", 5))",
  "    vad_filter = env_bool(\"HOMIE_WHISPER_VAD\", False)",
  "    language = os.environ.get(\"HOMIE_WHISPER_LANGUAGE\", \"en\")",
  "    temperature = env_float(\"HOMIE_WHISPER_TEMPERATURE\", 0.0)",
  "    no_speech_threshold = env_float(\"HOMIE_WHISPER_NO_SPEECH_THRESHOLD\", 0.28)",
  "    compression_ratio_threshold = env_float(\"HOMIE_WHISPER_COMPRESSION_RATIO_THRESHOLD\", 2.4)",
  "    log_prob_threshold = env_float(\"HOMIE_WHISPER_LOG_PROB_THRESHOLD\", -1.2)",
  "",
  "    model = WhisperModel(model_name, device=device, compute_type=compute_type)",
  "    kwargs = {",
  "        \"language\": language,",
  "        \"task\": \"transcribe\",",
  "        \"beam_size\": beam_size,",
  "        \"best_of\": best_of,",
  "        \"temperature\": temperature,",
  "        \"vad_filter\": vad_filter,",
  "        \"condition_on_previous_text\": False,",
  "        \"initial_prompt\": stt_initial_prompt(),",
  "        \"no_speech_threshold\": no_speech_threshold,",
  "        \"compression_ratio_threshold\": compression_ratio_threshold,",
  "        \"log_prob_threshold\": log_prob_threshold,",
  "    }",
  "    if vad_filter:",
  "        kwargs[\"vad_parameters\"] = {",
  "            \"min_speech_duration_ms\": env_int(\"HOMIE_WHISPER_VAD_MIN_SPEECH_MS\", 150),",
  "            \"min_silence_duration_ms\": env_int(\"HOMIE_WHISPER_VAD_MIN_SILENCE_MS\", 500),",
  "            \"speech_pad_ms\": env_int(\"HOMIE_WHISPER_VAD_SPEECH_PAD_MS\", 300),",
  "        }",
  "",
  "    segments, info = model.transcribe(audio_path, **kwargs)",
  "    text = \" \".join((seg.text or \"\").strip() for seg in segments).strip()",
  "    return {",
  "        \"ok\": bool(text),",
  "        \"text\": text,",
  "        \"model\": f\"faster-whisper:{model_name}\",",
  "        \"detail\": (",
  "            f\"language={getattr(info, 'language', language)}; \"",
  "            f\"duration={getattr(info, 'duration', '')}; \"",
  "            f\"beam={beam_size}; best_of={best_of}; vad={vad_filter}; temp={temperature}\"",
  "        ),",
  "        \"accuracyMode\": \"v10.36.74-command-phrase-stabilized\",",
  "    }",
  "",
  ""
].join("\n");

py = py.slice(0, fasterSpan.start) + fasterFunction + py.slice(fasterSpan.end);

const openaiSpan = findFunctionSpan(py, "transcribe_with_openai_whisper");
if (!openaiSpan) fail("Could not locate openai-whisper function span.");

const openaiFunction = [
  "def transcribe_with_openai_whisper(audio_path, model_name):",
  "    import whisper",
  "    # openai-whisper model names do not include the .en suffix on some installs.",
  "    openai_model = model_name.replace(\".en\", \"\")",
  "    language = os.environ.get(\"HOMIE_WHISPER_LANGUAGE\", \"en\")",
  "    temperature = env_float(\"HOMIE_WHISPER_TEMPERATURE\", 0.0)",
  "    model = whisper.load_model(openai_model)",
  "    result = model.transcribe(",
  "        audio_path,",
  "        fp16=False,",
  "        language=language,",
  "        task=\"transcribe\",",
  "        temperature=temperature,",
  "        condition_on_previous_text=False,",
  "        initial_prompt=stt_initial_prompt(),",
  "        verbose=False,",
  "    )",
  "    text = str(result.get(\"text\", \"\")).strip()",
  "    return {",
  "        \"ok\": bool(text),",
  "        \"text\": text,",
  "        \"model\": f\"openai-whisper:{openai_model}\",",
  "        \"detail\": f\"openai-whisper fallback; language={language}; temp={temperature}\",",
  "        \"accuracyMode\": \"v10.36.74-command-phrase-stabilized\",",
  "    }",
  "",
  ""
].join("\n");

py = py.slice(0, openaiSpan.start) + openaiFunction + py.slice(openaiSpan.end);

if (!py.includes("v10.36.74 checker-safe marker")) {
  py = py.replace(
    'VERSION = "v10.36.45"',
    'VERSION = "v10.36.45"\n# v10.36.74 checker-safe marker: STT accuracy boost applied'
  );
}

fs.writeFileSync(transcriberPath, py, "utf8");

const balancedBat = [
  "@echo off",
  "setlocal",
  "cd /d \"%~dp0\"",
  "echo ========================================",
  "echo   Homie Voice Bridge BALANCED ACCURACY",
  "echo ========================================",
  "echo.",
  "echo Uses base.en + beam search + VAD off for short command accuracy.",
  "echo Stop any old 8765 bridge first with Ctrl+C.",
  "echo First run may download/load the model and take longer.",
  "echo.",
  "set HOMIE_WHISPER_MODEL=base.en",
  "set HOMIE_WHISPER_BEAM_SIZE=5",
  "set HOMIE_WHISPER_BEST_OF=5",
  "set HOMIE_WHISPER_VAD=false",
  "set HOMIE_WHISPER_LANGUAGE=en",
  "set HOMIE_WHISPER_TEMPERATURE=0",
  "set HOMIE_WHISPER_NO_SPEECH_THRESHOLD=0.28",
  "set HOMIE_WHISPER_LOG_PROB_THRESHOLD=-1.2",
  "set HOMIE_WHISPER_COMPUTE=int8",
  "set HOMIE_WHISPER_DEVICE=cpu",
  "set HOMIE_VOICE_TRANSCRIBE_TIMEOUT_MS=180000",
  "set HOMIE_VOICE_PORT=8765",
  "node backend_scaffold\\homie-voice-bridge.mjs",
  "pause"
].join("\r\n");

fs.writeFileSync(balancedBatPath, balancedBat, "utf8");

const maxBat = [
  "@echo off",
  "setlocal",
  "cd /d \"%~dp0\"",
  "echo ========================================",
  "echo   Homie Voice Bridge MAX ACCURACY",
  "echo ========================================",
  "echo.",
  "echo Uses small.en + beam search. Slower but usually better than base.en.",
  "echo Stop any old 8765 bridge first with Ctrl+C.",
  "echo First run may download/load the model and take longer.",
  "echo.",
  "set HOMIE_WHISPER_MODEL=small.en",
  "set HOMIE_WHISPER_BEAM_SIZE=5",
  "set HOMIE_WHISPER_BEST_OF=5",
  "set HOMIE_WHISPER_VAD=false",
  "set HOMIE_WHISPER_LANGUAGE=en",
  "set HOMIE_WHISPER_TEMPERATURE=0",
  "set HOMIE_WHISPER_NO_SPEECH_THRESHOLD=0.25",
  "set HOMIE_WHISPER_LOG_PROB_THRESHOLD=-1.3",
  "set HOMIE_WHISPER_COMPUTE=int8",
  "set HOMIE_WHISPER_DEVICE=cpu",
  "set HOMIE_VOICE_TRANSCRIBE_TIMEOUT_MS=240000",
  "set HOMIE_VOICE_PORT=8765",
  "node backend_scaffold\\homie-voice-bridge.mjs",
  "pause"
].join("\r\n");

fs.writeFileSync(maxBatPath, maxBat, "utf8");

console.log("[" + VERSION + "] Applied Homie STT accuracy boost.");
console.log("Touched:");
console.log("- backend_scaffold/homie_voice_transcribe.py");
console.log("- RUN_HOMIE_VOICE_BRIDGE_BALANCED_ACCURACY_v10.36.74.bat");
console.log("- RUN_HOMIE_VOICE_BRIDGE_MAX_ACCURACY_v10.36.74.bat");
