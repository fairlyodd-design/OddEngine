
import fs from "node:fs";
import path from "node:path";

const VERSION = "v10.36.78";
const root = process.cwd();
const bridgePath = path.join(root, "backend_scaffold", "homie-voice-bridge.mjs");

function fail(message) {
  console.error("[" + VERSION + "] " + message);
  process.exit(1);
}

function backup(filePath) {
  const dst = filePath + ".bak_" + VERSION;
  if (!fs.existsSync(dst)) fs.copyFileSync(filePath, dst);
}

function replaceOnce(text, from, to, label) {
  if (!text.includes(from)) fail("Could not find anchor: " + label);
  return text.replace(from, to);
}

if (!fs.existsSync(bridgePath)) fail("Missing backend_scaffold/homie-voice-bridge.mjs");
backup(bridgePath);

let js = fs.readFileSync(bridgePath, "utf8");

if (!js.includes("POST /transcribe")) fail("Bridge file shape not recognized.");
if (!js.includes("function writeLastError")) fail("Missing writeLastError.");
if (!js.includes("async function handleTranscribe")) fail("Missing handleTranscribe.");

if (!js.includes("v10.36.78 checker-safe marker")) {
  js = js.replace(
    '// OddEngine Homie Voice Bridge v10.36.45',
    '// OddEngine Homie Voice Bridge v10.36.45\n// v10.36.78 checker-safe marker: transcription failure receipt + audio capture installed'
  );
}

// Add debug audio config.
if (!js.includes("HOMIE_VOICE_KEEP_AUDIO")) {
  js = replaceOnce(
    js,
    'const lastErrorPath = path.join(bridgeDir, "homie_voice_bridge_last_error.json");\nfs.mkdirSync(tempDir, { recursive: true });',
    [
      'const lastErrorPath = path.join(bridgeDir, "homie_voice_bridge_last_error.json");',
      'const KEEP_AUDIO_DEBUG = /^(1|true|yes|on)$/i.test(String(process.env.HOMIE_VOICE_KEEP_AUDIO || ""));',
      'const debugAudioDir = path.join(bridgeDir, "homie_voice_debug_audio");',
      'fs.mkdirSync(tempDir, { recursive: true });',
      'if (KEEP_AUDIO_DEBUG) fs.mkdirSync(debugAudioDir, { recursive: true });'
    ].join("\n"),
    "debug audio config"
  );
}

// Add helper to store last successful/failed raw audio.
if (!js.includes("function captureDebugAudio")) {
  js = replaceOnce(
    js,
    'function safeExtFromMime(mimeType = "") {',
    [
      'function captureDebugAudio(audioPath, filename) {',
      '  if (!KEEP_AUDIO_DEBUG) return "";',
      '  try {',
      '    const debugPath = path.join(debugAudioDir, filename);',
      '    fs.copyFileSync(audioPath, debugPath);',
      '    return debugPath;',
      '  } catch (error) {',
      '    writeLastError({ stage: "debug-audio-copy", error: String(error?.message || error) });',
      '    return "";',
      '  }',
      '}',
      '',
      'function safeExtFromMime(mimeType = "") {'
    ].join("\n"),
    "captureDebugAudio helper"
  );
}

// Add debug audio capture right after write.
if (!js.includes("const debugAudioPath = captureDebugAudio(audioPath, filename);")) {
  js = replaceOnce(
    js,
    'fs.writeFileSync(audioPath, audio);\n\n  const started = Date.now();',
    [
      'fs.writeFileSync(audioPath, audio);',
      'const debugAudioPath = captureDebugAudio(audioPath, filename);',
      '',
      'const started = Date.now();'
    ].join("\n  "),
    "debug audio capture after write"
  );
}

// Conditional delete: keep temp file when debug is on.
js = js.replace(
  'try { fs.unlinkSync(audioPath); } catch {}',
  'if (!KEEP_AUDIO_DEBUG) { try { fs.unlinkSync(audioPath); } catch {} }'
);

// Add debug fields to success response.
if (!js.includes("debugAudioPath: debugAudioPath || undefined")) {
  js = replaceOnce(
    js,
    'audioBytes: audio.length,\n      python: result.python,',
    'audioBytes: audio.length,\n      mimeType,\n      debugAudioPath: debugAudioPath || undefined,\n      transcribeMs: Date.now() - started,\n      python: result.python,',
    "success response debug fields"
  );
}

// Add debug fields to failure response.
if (!js.includes("debugAudioPath: debugAudioPath || undefined,\n    transcribeMs: Date.now() - started")) {
  js = replaceOnce(
    js,
    'audioBytes: audio.length,\n    python: result?.python,',
    'audioBytes: audio.length,\n    mimeType,\n    debugAudioPath: debugAudioPath || undefined,\n    transcribeMs: Date.now() - started,\n    python: result?.python,',
    "failure response debug fields"
  );
}

// Expand last-error stage payload already writes response; make sure audio debug note is present.
if (!js.includes("voiceDebugNote")) {
  js = replaceOnce(
    js,
    'installHint: "Run INSTALL_HOMIE_VOICE_STT_DEPS_v10.36.45.bat, then restart START_ODDENGINE_ALL_v10.36.45.bat. If it still fails, run RUN_v10.36.45_HOMIE_VOICE_TRANSCRIPTION_DOCTOR_CHECK.bat.",',
    'installHint: "Run INSTALL_HOMIE_VOICE_STT_DEPS_v10.36.45.bat, then restart the bridge. If it still fails, run TEST_HOMIE_VOICE_TRANSCRIPTION_FAILURE_v10.36.78.ps1.",\n    voiceDebugNote: KEEP_AUDIO_DEBUG ? "Raw mic audio was saved. Open backend_scaffold\\\\homie_voice_debug_audio and play the newest file." : "Set HOMIE_VOICE_KEEP_AUDIO=true or run the debug bridge BAT to save raw mic audio.",',
    "failure debug note"
  );
}

// Health should reveal debug setting.
if (!js.includes("debugAudioCapture")) {
  js = replaceOnce(
    js,
    'modelHint: MODEL_HINT,\n      },',
    'modelHint: MODEL_HINT,\n        debugAudioCapture: KEEP_AUDIO_DEBUG,\n      },',
    "health debug setting"
  );
}

fs.writeFileSync(bridgePath, js, "utf8");
console.log("[" + VERSION + "] Applied transcription failure receipt + audio capture patch.");
console.log("Touched:");
console.log("- backend_scaffold/homie-voice-bridge.mjs");
