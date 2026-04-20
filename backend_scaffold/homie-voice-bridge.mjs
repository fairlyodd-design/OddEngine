#!/usr/bin/env node
// OddEngine Homie Voice Bridge v10.36.45
// Local HTTP bridge for Homie's external/local mic lane.
// Endpoints:
//   GET  /health
//   GET  /doctor
//   GET  /last-error
//   POST /transcribe  { audioBase64, mimeType }

import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const VERSION = "v10.36.45";
const PORT = Number(process.env.HOMIE_VOICE_PORT || process.env.PORT || 8765);
const HOST = process.env.HOMIE_VOICE_HOST || "127.0.0.1";
const MAX_BODY_BYTES = Number(process.env.HOMIE_VOICE_MAX_BODY_BYTES || 32 * 1024 * 1024);
const TRANSCRIBE_TIMEOUT_MS = Number(process.env.HOMIE_VOICE_TRANSCRIBE_TIMEOUT_MS || 120000);
const MODEL_HINT = process.env.HOMIE_WHISPER_MODEL || "tiny.en";

const bridgeDir = path.dirname(fileURLToPath(import.meta.url));
const transcribeScript = path.join(bridgeDir, "homie_voice_transcribe.py");
const tempDir = path.join(os.tmpdir(), "oddengine-homie-voice");
const lastErrorPath = path.join(bridgeDir, "homie_voice_bridge_last_error.json");
fs.mkdirSync(tempDir, { recursive: true });

function nowIso() {
  return new Date().toISOString();
}

function writeLastError(payload) {
  try {
    const clean = {
      ts: nowIso(),
      version: VERSION,
      ...payload,
    };
    fs.writeFileSync(lastErrorPath, JSON.stringify(clean, null, 2), "utf8");
  } catch {
    // ignore
  }
}

function readLastError() {
  try {
    if (!fs.existsSync(lastErrorPath)) return null;
    return JSON.parse(fs.readFileSync(lastErrorPath, "utf8"));
  } catch {
    return null;
  }
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error(`Request too large. Max is ${MAX_BODY_BYTES} bytes.`));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function safeExtFromMime(mimeType = "") {
  const lower = String(mimeType || "").toLowerCase();
  if (lower.includes("wav")) return ".wav";
  if (lower.includes("mpeg") || lower.includes("mp3")) return ".mp3";
  if (lower.includes("ogg")) return ".ogg";
  if (lower.includes("mp4") || lower.includes("m4a")) return ".m4a";
  return ".webm";
}

function pythonCandidates() {
  const configured = process.env.HOMIE_PYTHON;
  const base = configured ? [configured] : [];
  if (process.platform === "win32") return [...base, "py", "python"];
  return [...base, "python3", "python"];
}

function runPython(args, options = {}) {
  return new Promise((resolve) => {
    const candidates = pythonCandidates();
    let index = 0;

    const tryNext = (lastError = "") => {
      const exe = candidates[index++];
      if (!exe) {
        resolve({ ok: false, error: lastError || "Python was not found. Install Python or set HOMIE_PYTHON." });
        return;
      }

      const finalArgs = exe === "py" ? ["-3", ...args] : [...args];
      const child = spawn(exe, finalArgs, {
        cwd: bridgeDir,
        windowsHide: true,
        env: { ...process.env, HOMIE_WHISPER_MODEL: MODEL_HINT },
      });

      let stdout = "";
      let stderr = "";
      const timer = setTimeout(() => {
        try { child.kill("SIGKILL"); } catch {}
      }, options.timeoutMs || TRANSCRIBE_TIMEOUT_MS);

      child.stdout.on("data", (buf) => { stdout += buf.toString(); });
      child.stderr.on("data", (buf) => { stderr += buf.toString(); });
      child.on("error", (err) => {
        clearTimeout(timer);
        tryNext(String(err?.message || err));
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        const raw = stdout.trim();
        const err = stderr.trim();
        if (!raw && code !== 0) {
          tryNext(err || `Python exited ${code}.`);
          return;
        }
        resolve({ ok: code === 0, code, stdout: raw, stderr: err, python: exe });
      });
    };

    tryNext();
  });
}

async function runDoctor() {
  if (!fs.existsSync(transcribeScript)) {
    return { ok: false, error: `Missing ${transcribeScript}`, service: "homie-voice-bridge", version: VERSION };
  }
  const result = await runPython([transcribeScript, "--doctor"], { timeoutMs: 30000 });
  let parsed = null;
  try { parsed = JSON.parse(result.stdout || "{}"); } catch {}
  if (parsed && typeof parsed === "object") {
    return { ...parsed, ok: !!parsed.ok, python: result.python || parsed.python, service: "homie-voice-bridge", version: VERSION };
  }
  return {
    ok: false,
    error: result.stderr || result.stdout || result.error || "Doctor did not return JSON.",
    python: result.python,
    service: "homie-voice-bridge",
    version: VERSION,
  };
}

async function runPythonTranscriber(audioPath, mimeType) {
  if (!fs.existsSync(transcribeScript)) {
    return { ok: false, error: `Missing ${transcribeScript}` };
  }

  const args = [transcribeScript, audioPath, mimeType || "audio/webm"];
  const result = await runPython(args, { timeoutMs: TRANSCRIBE_TIMEOUT_MS });
  let parsed = null;
  try { parsed = JSON.parse(result.stdout || "{}"); } catch {}
  if (parsed && typeof parsed === "object") {
    return {
      ...parsed,
      python: result.python || parsed.python,
      stderr: result.stderr || parsed.stderr || "",
      exitCode: result.code,
    };
  }
  return {
    ok: false,
    error: result.stdout || result.stderr || result.error || `Transcriber did not return JSON. Exit code ${result.code}.`,
    stderr: result.stderr || "",
    python: result.python,
    exitCode: result.code,
  };
}

async function handleTranscribe(req, res) {
  let raw = "";
  try {
    raw = await readBody(req);
  } catch (error) {
    const payload = { ok: false, error: String(error?.message || error), service: "homie-voice-bridge", version: VERSION };
    writeLastError({ stage: "read-body", payload });
    sendJson(res, 413, payload);
    return;
  }

  let payload;
  try {
    payload = JSON.parse(raw || "{}");
  } catch {
    const response = { ok: false, error: "Invalid JSON body.", service: "homie-voice-bridge", version: VERSION };
    writeLastError({ stage: "parse-json", payload: response });
    sendJson(res, 400, response);
    return;
  }

  const audioBase64 = String(payload.audioBase64 || "");
  const mimeType = String(payload.mimeType || "audio/webm");
  if (!audioBase64) {
    const response = { ok: false, error: "Missing audioBase64.", service: "homie-voice-bridge", version: VERSION };
    writeLastError({ stage: "missing-audio", payload: response });
    sendJson(res, 400, response);
    return;
  }

  let audio;
  try {
    audio = Buffer.from(audioBase64, "base64");
  } catch {
    const response = { ok: false, error: "audioBase64 could not be decoded.", service: "homie-voice-bridge", version: VERSION };
    writeLastError({ stage: "decode-base64", payload: response });
    sendJson(res, 400, response);
    return;
  }

  if (audio.length < 1000) {
    const response = {
      ok: false,
      error: "Audio clip is too small to transcribe. Hold the mic a beat longer.",
      audioBytes: audio.length,
      service: "homie-voice-bridge",
      version: VERSION,
    };
    writeLastError({ stage: "audio-too-small", payload: response });
    sendJson(res, 200, response);
    return;
  }

  const ext = safeExtFromMime(mimeType);
  const filename = `homie-${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`;
  const audioPath = path.join(tempDir, filename);
  fs.writeFileSync(audioPath, audio);

  const started = Date.now();
  const result = await runPythonTranscriber(audioPath, mimeType);
  try { fs.unlinkSync(audioPath); } catch {}

  if (result?.ok && typeof result.text === "string" && result.text.trim()) {
    const response = {
      ok: true,
      text: result.text.trim(),
      model: result.model || MODEL_HINT,
      detail: result.detail || `Transcribed locally in ${Date.now() - started}ms.`,
      audioBytes: audio.length,
      python: result.python,
      service: "homie-voice-bridge",
      version: VERSION,
    };
    sendJson(res, 200, response);
    return;
  }

  const response = {
    ok: false,
    error: result?.error || "Local STT engine did not return a transcript.",
    detail: result?.detail || "Bridge is running, but Python STT or audio decoding may not be ready yet.",
    stderr: result?.stderr || "",
    exitCode: result?.exitCode,
    audioBytes: audio.length,
    python: result?.python,
    installHint: "Run INSTALL_HOMIE_VOICE_STT_DEPS_v10.36.45.bat, then restart START_ODDENGINE_ALL_v10.36.45.bat. If it still fails, run RUN_v10.36.45_HOMIE_VOICE_TRANSCRIPTION_DOCTOR_CHECK.bat.",
    service: "homie-voice-bridge",
    version: VERSION,
  };
  writeLastError({ stage: "transcribe", payload: response });
  sendJson(res, 200, response);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);
  if (req.method === "OPTIONS") {
    sendJson(res, 200, { ok: true });
    return;
  }
  if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
    sendJson(res, 200, {
      ok: true,
      service: "homie-voice-bridge",
      version: VERSION,
      port: PORT,
      health: `http://127.0.0.1:${PORT}/health`,
      doctor: `http://127.0.0.1:${PORT}/doctor`,
      lastError: `http://127.0.0.1:${PORT}/last-error`,
      transcribe: "/transcribe",
      stt: {
        mode: "python faster-whisper/openai-whisper",
        scriptPresent: fs.existsSync(transcribeScript),
        modelHint: MODEL_HINT,
      },
      note: "Health means the bridge is listening. Use /doctor to verify Python STT imports.",
    });
    return;
  }
  if (req.method === "GET" && url.pathname === "/doctor") {
    const doctor = await runDoctor();
    if (!doctor.ok) writeLastError({ stage: "doctor", payload: doctor });
    sendJson(res, 200, doctor);
    return;
  }
  if (req.method === "GET" && url.pathname === "/last-error") {
    sendJson(res, 200, { ok: true, service: "homie-voice-bridge", version: VERSION, lastError: readLastError() });
    return;
  }
  if (req.method === "POST" && url.pathname === "/transcribe") {
    await handleTranscribe(req, res);
    return;
  }
  sendJson(res, 404, { ok: false, error: "Not found", service: "homie-voice-bridge", version: VERSION });
});

server.on("error", (error) => {
  console.error(`[${VERSION}] Homie voice bridge failed:`, error);
  process.exitCode = 1;
});

server.listen(PORT, HOST, () => {
  console.log("========================================");
  console.log(`  Homie Voice Bridge ${VERSION}`);
  console.log("========================================");
  console.log(`Health:     http://${HOST}:${PORT}/health`);
  console.log(`Doctor:     http://${HOST}:${PORT}/doctor`);
  console.log(`Last error: http://${HOST}:${PORT}/last-error`);
  console.log(`Transcribe: http://${HOST}:${PORT}/transcribe`);
  console.log(`STT model:  ${MODEL_HINT}`);
  console.log("If transcription says deps are missing, run INSTALL_HOMIE_VOICE_STT_DEPS_v10.36.45.bat");
  console.log("Press Ctrl+C to stop.");
});
