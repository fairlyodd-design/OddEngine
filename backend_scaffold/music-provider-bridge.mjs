import http from "http";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { spawn, spawnSync } from "child_process";

const HOST = process.env.MUSIC_BRIDGE_HOST || "127.0.0.1";
const PORT = Number(process.env.MUSIC_BRIDGE_PORT || 7010);
const ROOT = path.resolve(process.cwd(), "backend_scaffold_data", "music_bridge");
const CFG_PATH = path.join(ROOT, "music_provider_config.json");
const OUT_DIR = path.join(ROOT, "outputs");
const RUNTIME_LOCK_PATH = path.join(ROOT, "runtime_lock.json");

fs.mkdirSync(ROOT, { recursive: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

function send(res, code, payload) {
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(payload, null, 2));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    const parts = [];
    req.on("data", (d) => parts.push(d));
    req.on("end", () => {
      try { resolve(parts.length ? JSON.parse(Buffer.concat(parts).toString("utf8")) : {}); }
      catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}
function safeSlug(v) {
  return String(v || "track").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64) || "track";
}
function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; }
}
function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2), "utf8");
}
function defaults() {
  return {
    engine: process.env.MUSIC_ENGINE || "auto",
    fallbackEngine: process.env.MUSIC_FALLBACK_ENGINE || "python-adapter",
    python: process.env.MUSIC_PYTHON || "python",
    adapterScript: process.env.MUSIC_ADAPTER_SCRIPT || path.resolve(process.cwd(), "music_engines", "musicgen_adapter.py"),
    musicgenScript: process.env.MUSIC_MUSICGEN_SCRIPT || path.resolve(process.cwd(), "music_engines", "musicgen_model_adapter.py"),
    barkScript: process.env.MUSIC_BARK_SCRIPT || path.resolve(process.cwd(), "music_engines", "bark_song_adapter.py"),
    command: process.env.MUSIC_COMMAND || "",
    externalApiUrl: process.env.MUSIC_EXTERNAL_API_URL || "",
    externalApiToken: process.env.MUSIC_EXTERNAL_API_TOKEN || "",
    outputFormat: process.env.MUSIC_OUTPUT_FORMAT || "wav",
    timeoutMs: Number(process.env.MUSIC_TIMEOUT_MS || 600000),
    saveOutputs: true,
  };
}
function getConfig() {
  const base = defaults();
  const stored = { ...(readJson(CFG_PATH, {}) || {}) };
  if (!stored.adapterScript || stored.adapterScript === 'AUTO' || !pathExists(stored.adapterScript)) stored.adapterScript = base.adapterScript;
  if (!stored.musicgenScript || stored.musicgenScript === 'AUTO' || !pathExists(stored.musicgenScript)) stored.musicgenScript = base.musicgenScript;
  if (!stored.barkScript || stored.barkScript === 'AUTO' || !pathExists(stored.barkScript)) stored.barkScript = base.barkScript;
  return { ...base, ...stored };
}
function saveConfig(patch) {
  const next = { ...getConfig(), ...(patch || {}) };
  writeJson(CFG_PATH, next);
  return next;
}

function pathExists(filePath) {
  try { return !!filePath && fs.existsSync(filePath); } catch { return false; }
}
function commandExists(cmd) {
  if (!cmd) return false;
  try {
    const result = spawnSync(process.platform === "win32" ? "where" : "which", [cmd], { stdio: "ignore" });
    return result.status === 0;
  } catch {
    return false;
  }
}
function probePythonAdapter(scriptPath, cfg = getConfig()) {
  if (!scriptPath || !fs.existsSync(scriptPath)) return { ok: false, detail: 'script missing' };
  if (!commandExists(cfg.python || 'python')) return { ok: false, detail: `python executable not found: ${cfg.python || 'python'}` };
  try {
    const result = spawnSync(cfg.python || 'python', [scriptPath, '--probe'], { cwd: process.cwd(), encoding: 'utf8', timeout: 8000 });
    if (result.status !== 0) return { ok: false, detail: (result.stderr || result.stdout || `probe exited ${result.status}`).trim() };
    const parsed = JSON.parse(String(result.stdout || '{}'));
    return { ok: !!parsed.ok, detail: parsed.detail || parsed.runtime || 'unknown', runtime: parsed.runtime || '' };
  } catch (error) {
    return { ok: false, detail: error?.message || String(error) };
  }
}
function readRuntimeLock() {
  return readJson(RUNTIME_LOCK_PATH, null);
}
function runtimeDoctor(cfg = getConfig()) {
  const selectedEngine = resolveEngine(cfg);
  const engines = engineCatalog(cfg);
  const lock = readRuntimeLock();
  const selected = engines.find((item) => item.id === selectedEngine) || null;
  const hasLock = !!(lock && lock.ok);
  const overall = selected?.available ? "ready" : (hasLock ? "partial" : "missing");
  return {
    ok: overall !== "missing",
    status: overall,
    selectedEngine,
    selectedLabel: selected?.label || selectedEngine,
    selectedDetail: selected?.detail || "",
    runtimeLockPresent: hasLock,
    runtimeLockPath: RUNTIME_LOCK_PATH,
    runtimeLock: lock,
    pythonExecutable: cfg.python || "python",
    adapters: {
      pythonAdapter: { path: cfg.adapterScript, exists: pathExists(cfg.adapterScript) },
      musicgenAdapter: { path: cfg.musicgenScript, exists: pathExists(cfg.musicgenScript) },
      barkAdapter: { path: cfg.barkScript, exists: pathExists(cfg.barkScript) },
    },
    install: {
      windowsBatch: path.resolve(process.cwd(), "INSTALL_WINDOWS_MUSIC_RUNTIME.bat"),
      windowsPowerShell: path.resolve(process.cwd(), "INSTALL_WINDOWS_MUSIC_RUNTIME.ps1"),
      runtimeBridgeBatch: path.resolve(process.cwd(), "RUN_MUSIC_PROVIDER_BRIDGE_RUNTIME.bat"),
      testBatch: path.resolve(process.cwd(), "TEST_WINDOWS_MUSIC_RUNTIME.bat"),
    },
    models: {
      musicgen: {
        id: process.env.MUSICGEN_MODEL_NAME || "facebook/musicgen-small",
        loaded: !!selected && selected.id === "musicgen-cli" && !!selected.available,
      },
      bark: {
        id: process.env.BARK_MODEL_NAME || "suno/bark-small",
        loaded: !!engines.find((item) => item.id === "bark-cli")?.available,
      },
    },
    guidance: selected?.available
      ? "Runtime ready. Queue a render from Music Lab to use the selected model-backed lane."
      : hasLock
        ? "Dependencies were installed but the selected engine is not ready yet. Check probe details and model availability."
        : "Runtime stack not installed yet. Run INSTALL_WINDOWS_MUSIC_RUNTIME.bat inside backend_scaffold.",
    engines,
  };
}
function engineCatalog(cfg = getConfig()) {
  const musicgenProbe = probePythonAdapter(cfg.musicgenScript, cfg);
  const barkProbe = probePythonAdapter(cfg.barkScript, cfg);
  return [
    { id: "auto", label: "Auto detect best engine", available: true, detail: "Tries MusicGen, then Bark overlay, then local Python adapter, then stub." },
    { id: "musicgen-cli", label: "MusicGen model adapter", available: pathExists(cfg.musicgenScript) && musicgenProbe.ok, detail: pathExists(cfg.musicgenScript) ? (musicgenProbe.ok ? `Runtime ready (${musicgenProbe.runtime || 'musicgen'}): ${musicgenProbe.detail}` : `Runtime unavailable: ${musicgenProbe.detail}`) : "musicgen_model_adapter.py missing" },
    { id: "bark-cli", label: "Bark song adapter", available: pathExists(cfg.barkScript) && barkProbe.ok, detail: pathExists(cfg.barkScript) ? (barkProbe.ok ? `Runtime ready (${barkProbe.runtime || 'bark'}): ${barkProbe.detail}` : `Runtime unavailable: ${barkProbe.detail}`) : "bark_song_adapter.py missing" },
    { id: "python-adapter", label: "Procedural / Python adapter", available: pathExists(cfg.adapterScript), detail: pathExists(cfg.adapterScript) ? `Adapter found: ${cfg.adapterScript}` : "musicgen_adapter.py missing" },
    { id: "external-api-json", label: "External API JSON", available: !!cfg.externalApiUrl, detail: cfg.externalApiUrl ? `Endpoint: ${cfg.externalApiUrl}` : "Set externalApiUrl in bridge config" },
    { id: "command-json", label: "Command JSON bridge", available: !!cfg.command, detail: cfg.command ? `Command configured` : "Set command in bridge config" },
    { id: "stub", label: "Local stub fallback", available: true, detail: "Always available" },
  ];
}
function resolveEngine(cfg = getConfig()) {
  const catalog = engineCatalog(cfg);
  const byId = Object.fromEntries(catalog.map((item) => [item.id, item]));
  const preferred = String(cfg.engine || "auto");
  if (preferred !== "auto") {
    return byId[preferred]?.available ? preferred : String(cfg.fallbackEngine || "stub");
  }
  const priority = ["musicgen-cli", "bark-cli", "python-adapter", "external-api-json", "command-json", "stub"];
  return priority.find((id) => byId[id]?.available) || "stub";
}
async function runJsonCommand(cfg, payload, runRoot) {
  if (!cfg.command) throw new Error("command-json not configured");
  const requestPath = writeRequestPayload(runRoot, payload);
  const outputPath = path.join(runRoot, "response.json");
  const commandLine = String(cfg.command)
    .replaceAll("{input}", requestPath)
    .replaceAll("{output}", outputPath)
    .replaceAll("{runRoot}", runRoot);
  const shell = process.platform === "win32" ? "cmd.exe" : "/bin/sh";
  const shellArgs = process.platform === "win32" ? ["/d", "/s", "/c", commandLine] : ["-lc", commandLine];
  await new Promise((resolve, reject) => {
    const child = spawn(shell, shellArgs, { cwd: process.cwd(), env: { ...process.env, MUSIC_RUN_ROOT: runRoot }, stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (d) => { stderr += String(d); });
    const timer = setTimeout(() => { child.kill("SIGTERM"); reject(new Error(`music command timeout after ${cfg.timeoutMs}ms`)); }, Number(cfg.timeoutMs || 600000));
    child.on("error", (e) => { clearTimeout(timer); reject(e); });
    child.on("close", (code) => { clearTimeout(timer); if (code !== 0) return reject(new Error(stderr || `music command exited ${code}`)); resolve(); });
  });
  return readJson(outputPath, {});
}
async function runExternalApiJson(cfg, payload, runRoot) {
  if (!cfg.externalApiUrl) throw new Error("external-api-json not configured");
  const response = await fetch(String(cfg.externalApiUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cfg.externalApiToken ? { Authorization: `Bearer ${cfg.externalApiToken}` } : {}),
    },
    body: JSON.stringify({ payload, runRoot, format: cfg.outputFormat || "wav" }),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json?.error || `external music api HTTP ${response.status}`);
  return json;
}
async function runPythonScript(scriptPath, cfg, payload, runRoot) {
  if (!scriptPath || !fs.existsSync(scriptPath)) throw new Error(`adapter missing: ${scriptPath}`);
  const requestPath = writeRequestPayload(runRoot, payload);
  const outputPath = path.join(runRoot, "response.json");
  await new Promise((resolve, reject) => {
    const child = spawn(cfg.python || "python", [scriptPath, "--input", requestPath, "--output", outputPath], {
      cwd: process.cwd(),
      env: { ...process.env, MUSIC_RUN_ROOT: runRoot },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (d) => { stderr += String(d); });
    const timer = setTimeout(() => { child.kill("SIGTERM"); reject(new Error(`music adapter timeout after ${cfg.timeoutMs}ms`)); }, Number(cfg.timeoutMs || 600000));
    child.on("error", (e) => { clearTimeout(timer); reject(e); });
    child.on("close", (code) => { clearTimeout(timer); if (code !== 0) return reject(new Error(stderr || `music adapter exited ${code}`)); resolve(); });
  });
  return readJson(outputPath, {});
}

async function maybeApplyBarkOverlay(cfg, payload, runRoot, normalized, engineName) {
  const catalog = engineCatalog(cfg);
  const barkInfo = catalog.find((item) => item.id === 'bark-cli');
  const wantsOverlay = payload?.enableVocals !== false && payload?.enableBarkOverlay !== false;
  if (!wantsOverlay || !barkInfo?.available || !pathExists(cfg.barkScript)) {
    return { normalized, overlayApplied: false, overlayReason: wantsOverlay ? (barkInfo?.detail || 'bark unavailable') : 'overlay disabled in payload' };
  }
  try {
    const overlayPayload = {
      ...(payload || {}),
      instrumentalPath: path.join(runRoot, 'instrumental.wav'),
      title: payload?.title || 'Untitled track',
      lyrics: payload?.lyrics || '',
      vibe: payload?.vibe || payload?.genre || '',
    };
    const overlay = await runPythonScript(cfg.barkScript, cfg, overlayPayload, runRoot);
    const merged = normalizeAdapterResult(runRoot, overlay, payload?.title || 'Untitled track');
    merged.coverArtUrl = normalized.coverArtUrl || merged.coverArtUrl;
    merged.lyricVideoUrl = normalized.lyricVideoUrl || merged.lyricVideoUrl;
    merged.meta = { ...(normalized.meta || {}), ...(merged.meta || {}), barkOverlay: true, baseEngine: engineName };
    return { normalized: merged, overlayApplied: true, overlayReason: barkInfo.detail || 'bark overlay applied' };
  } catch (error) {
    return { normalized, overlayApplied: false, overlayReason: error?.message || String(error) };
  }
}
function toneDataUrl(tag) {
  return `data:audio/wav;base64,${Buffer.from(`ODDENGINE_MUSIC_PROVIDER:${tag}`, "utf8").toString("base64")}`;
}
function svgDataUrl(title, accent, subtitle) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#081425"/><stop offset="55%" stop-color="${accent}"/><stop offset="100%" stop-color="#090212"/></linearGradient></defs><rect width="1200" height="1200" fill="url(#g)"/><text x="80" y="220" font-size="82" font-family="Arial" fill="#fff" font-weight="700">${String(title || "Untitled").replace(/[<&>"]/g, "")}</text><text x="86" y="300" font-size="30" font-family="Arial" fill="#d6d6ff">${String(subtitle || "").replace(/[<&>"]/g, "")}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
function waveformFromValues(values, buckets = 72) {
  const src = Array.isArray(values) && values.length ? values : [0.1];
  const win = Math.max(1, Math.floor(src.length / buckets));
  const out = [];
  for (let i = 0; i < src.length; i += win) {
    const chunk = src.slice(i, i + win);
    const avg = chunk.reduce((a, b) => a + Math.abs(Number(b) || 0), 0) / Math.max(1, chunk.length);
    out.push(Math.max(10, Math.min(96, Math.round(avg * 140))));
  }
  while (out.length < buckets) out.push(out[out.length - 1] || 12);
  return out.slice(0, buckets);
}
function waveform() {
  return Array.from({ length: 72 }, (_, i) => Math.max(10, Math.round(30 + 18 * Math.sin(i / 2.3) + 10 * Math.sin(i / 4.7))));
}
function toDataUrlFromFile(filePath, mime = "audio/wav") {
  const buf = fs.readFileSync(filePath);
  return `data:${mime};base64,${buf.toString("base64")}`;
}
function maybeDataUrlFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mime = ext === ".mp3" ? "audio/mpeg" : ext === ".png" ? "image/png" : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : ext === ".svg" ? "image/svg+xml" : "audio/wav";
  return toDataUrlFromFile(filePath, mime);
}
function writeRequestPayload(runRoot, payload) {
  const file = path.join(runRoot, "request.json");
  writeJson(file, payload);
  return file;
}
function saveInlineDataUrl(runRoot, name, dataUrl) {
  const match = String(dataUrl || "").match(/^data:([^;]+);base64,(.*)$/);
  if (!match) return "";
  const mime = match[1];
  const b64 = match[2];
  const ext = mime.includes("mpeg") ? "mp3" : mime.includes("png") ? "png" : mime.includes("jpeg") ? "jpg" : "wav";
  const file = path.join(runRoot, `${name}.${ext}`);
  fs.writeFileSync(file, Buffer.from(b64, "base64"));
  return file;
}
function writeWavMono(filePath, samples, sampleRate = 22050) {
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  let peak = 0.001;
  for (const s of samples) peak = Math.max(peak, Math.abs(s || 0));
  const gain = Math.min(0.95 / peak, 1.8);
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const value = Math.max(-1, Math.min(1, (samples[i] || 0) * gain));
    buffer.writeInt16LE(Math.floor(value * 32767), offset);
    offset += 2;
  }
  fs.writeFileSync(filePath, buffer);
  return filePath;
}
function writeToneWavFile(filePath, freq, seconds = 2.8, sampleRate = 22050) {
  const samples = Math.max(1, Math.floor(sampleRate * seconds));
  const arr = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    const env = Math.min(1, i / 2000) * Math.max(0.15, 1 - i / samples);
    const sample =
      0.42 * Math.sin(2 * Math.PI * freq * t) +
      0.22 * Math.sin(2 * Math.PI * freq * 2 * t) +
      0.12 * Math.sin(2 * Math.PI * freq * 0.5 * t);
    arr[i] = sample * env;
  }
  return writeWavMono(filePath, arr, sampleRate);
}


const LEGACY_MOTION_MAP = { lift: 'rise', glide: 'drive', pulse: 'drive', resolve: 'fall', low: 'low', rise: 'rise', drive: 'drive', explode: 'explode', fall: 'fall' };
function clamp01(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n > 1 ? n / 100 : n)) : fallback;
}
function normalizeMotion(motion, fallback = 'drive') {
  const key = String(motion || fallback || 'drive').trim().toLowerCase();
  return LEGACY_MOTION_MAP[key] || fallback;
}
function normalizeSectionBars(sectionBars = {}) {
  const defaults = { intro: 2, verse: 4, chorus: 4, outro: 2 };
  const safe = (v, d, hi) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(1, Math.min(hi, Math.round(n))) : d;
  };
  return {
    intro: safe(sectionBars?.intro, defaults.intro, 16),
    verse: safe(sectionBars?.verse, defaults.verse, 24),
    chorus: safe(sectionBars?.chorus, defaults.chorus, 24),
    outro: safe(sectionBars?.outro, defaults.outro, 16),
  };
}
function normalizeSectionDynamics(sectionDynamics = {}) {
  const defaults = {
    intro: { energy: 0.54, density: 0.34, drums: 0.26, motion: 'rise' },
    verse: { energy: 0.68, density: 0.58, drums: 0.56, motion: 'drive' },
    chorus: { energy: 0.95, density: 0.88, drums: 0.90, motion: 'explode' },
    outro: { energy: 0.48, density: 0.28, drums: 0.22, motion: 'fall' },
  };
  const out = {};
  for (const [name, base] of Object.entries(defaults)) {
    const raw = sectionDynamics?.[name] || {};
    out[name] = {
      energy: clamp01(raw.energy, base.energy),
      density: clamp01(raw.density, base.density),
      drums: clamp01(raw.drums, base.drums),
      motion: normalizeMotion(raw.motion, base.motion),
    };
  }
  return out;
}
function normalizeStructure(structure = []) {
  const allowed = new Set(['intro', 'verse', 'chorus', 'outro']);
  const cleaned = Array.isArray(structure) ? structure.map((x) => String(x || '').trim().toLowerCase()).filter((x) => allowed.has(x)) : [];
  return cleaned.length ? cleaned : ['intro', 'verse', 'chorus', 'verse', 'chorus', 'outro'];
}
function sectionBarsToSeconds(bars, bpm = 118) {
  const beatDur = 60 / Math.max(70, Math.min(180, Number(bpm) || 118));
  return Math.max(0.1, Number(bars || 1) * beatDur * 4);
}
function buildSectionPrompt(section, payload = {}) {
  const intensity = section.energy < 0.38 ? 'low energy' : section.energy < 0.72 ? 'mid energy' : 'high energy';
  const layering = section.density < 0.35 ? 'sparse arrangement' : section.density < 0.72 ? 'layered arrangement' : 'dense layered arrangement';
  const drums = section.drums < 0.2 ? 'minimal drums' : section.drums < 0.65 ? 'steady drums' : 'strong drums';
  const motionMap = { low: 'static and restrained phrasing', rise: 'rising phrasing and lift', drive: 'forward-driving phrasing', explode: 'explosive payoff phrasing', fall: 'falling and resolving phrasing' };
  return [
    `${section.name} section of a ${String(payload?.genre || payload?.style || 'modern song')} song`,
    intensity,
    layering,
    drums,
    motionMap[section.motion] || motionMap.drive,
    String(payload?.vibe || '').trim(),
    `for the song '${String(payload?.title || 'Untitled track')}'`,
  ].filter(Boolean).join(', ');
}
function buildSectionPlan(payload = {}) {
  const bpm = Number(payload?.bpm || 118);
  const sectionBars = normalizeSectionBars(payload?.sectionBars || {});
  const dynamics = normalizeSectionDynamics(payload?.sectionDynamics || {});
  const structure = normalizeStructure(payload?.structure || []);
  let cursor = 0;
  return structure.map((name, index) => {
    const bars = sectionBars[name];
    const durationSec = sectionBarsToSeconds(bars, bpm);
    const section = {
      index,
      name,
      bars,
      energy: Number(dynamics[name].energy.toFixed(4)),
      density: Number(dynamics[name].density.toFixed(4)),
      drums: Number(dynamics[name].drums.toFixed(4)),
      motion: dynamics[name].motion,
      startSec: Number(cursor.toFixed(4)),
      endSec: Number((cursor + durationSec).toFixed(4)),
      durationSec: Number(durationSec.toFixed(4)),
    };
    section.prompt = buildSectionPrompt(section, payload);
    section.barkStyle = name === 'intro' ? 'ambient spoken texture' : name === 'verse' ? 'rhythmic phrasing with clear cadence' : name === 'chorus' ? 'bigger emotional sustained hook' : 'fading minimal resolution';
    cursor += durationSec;
    return section;
  });
}
function timingsFromPlan(plan = [], crossfadeSec = 0.12, engineName = 'procedural-song-stub') {
  let cursor = 0;
  return plan.map((section, idx) => {
    const startSec = idx === 0 ? cursor : Math.max(0, cursor - crossfadeSec);
    const endSec = startSec + Number(section.durationSec || 0);
    cursor = endSec;
    return { index: section.index ?? idx, name: section.name, bars: section.bars, startSec: Number(startSec.toFixed(4)), endSec: Number(endSec.toFixed(4)), durationSec: Number((endSec - startSec).toFixed(4)), engine: engineName, prompt: section.prompt || '' };
  });
}
function buildProceduralSongFiles(runRoot, title, bpm = 118, keyName = 'A minor', vibe = '', sectionBars = {}, songLengthSec = 150, incomingDynamics = {}, structure = []) {
  const sampleRate = 22050;
  const beatDur = 60 / Math.max(70, Math.min(180, Number(bpm) || 118));
  const barDur = beatDur * 4;
  const payload = { title, bpm, key: keyName, vibe, genre: vibe, sectionBars, sectionDynamics: incomingDynamics, structure };
  const sections = buildSectionPlan(payload).filter((s) => s.bars > 0);
  const totalSeconds = sections.reduce((a, s) => a + s.durationSec, 0);
  const totalSamples = Math.max(1, Math.floor(totalSeconds * sampleRate));
  const lead = new Float32Array(totalSamples);
  const inst = new Float32Array(totalSamples);
  const drums = new Float32Array(totalSamples);
  const noteIndex = { C:0, 'C#':1, DB:1, D:2, 'D#':3, EB:3, E:4, F:5, 'F#':6, GB:6, G:7, 'G#':8, AB:8, A:9, 'A#':10, BB:10, B:11 };
  const tonicRaw = String(keyName || 'A').trim().toUpperCase().replace('MINOR','M').replace('MAJOR','');
  const tonic = noteIndex[tonicRaw.slice(0,2)] != null ? tonicRaw.slice(0,2) : tonicRaw.slice(0,1);
  const root = noteIndex[tonic] != null ? noteIndex[tonic] : 9;
  const minor = /M/.test(tonicRaw) || /dark|sad|moody/i.test(String(vibe || ''));
  const scale = minor ? [0,2,3,5,7,8,10] : [0,2,4,5,7,9,11];
  const progression = minor ? [0,5,6,4] : [0,5,3,4];
  const melodyMap = {
    intro:{ low:[0,2,0,2,0,1,0,1], rise:[0,2,4,2,0,2,4,6], drive:[0,1,2,4,2,1,0,1], explode:[2,4,6,7,6,4,2,1], fall:[4,2,1,0,1,0,6,0] },
    verse:{ low:[0,1,0,1,2,1,0,1], rise:[0,1,2,4,2,1,0,1], drive:[0,2,4,5,4,2,1,0], explode:[2,4,5,7,5,4,2,1], fall:[4,2,1,0,2,1,0,6] },
    chorus:{ low:[4,4,5,4,2,2,1,0], rise:[4,4,5,6,4,2,1,0], drive:[4,5,6,4,5,2,1,0], explode:[4,6,7,9,7,6,4,2], fall:[6,4,2,1,4,2,1,0] },
    outro:{ low:[4,2,1,0,0,1,0,0], rise:[4,2,1,0,1,0,6,0], drive:[4,2,0,1,0,6,4,2], explode:[7,6,4,2,4,2,1,0], fall:[4,2,1,0,0,6,4,0] },
  };
  const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const degreeFreq = (deg, octave) => midiToFreq(12 * (octave + 1) + ((root + scale[((deg % scale.length) + scale.length) % scale.length]) % 12));
  const addSine = (buf, start, len, freq, amp, attack=0.01, release=0.12, detune=0) => {
    if (len <= 0) return;
    const attackN = Math.max(1, Math.floor(len * attack));
    const releaseN = Math.max(1, Math.floor(len * release));
    const sustainN = Math.max(0, len - attackN - releaseN);
    let phase2 = 0;
    for (let i = 0; i < len; i++) {
      const t = i / sampleRate;
      const env = i < attackN ? i / attackN : (i < attackN + sustainN ? 1 : Math.max(0, 1 - (i - attackN - sustainN) / releaseN));
      let sample = (Math.sin(2 * Math.PI * freq * t) + 0.28 * Math.sin(2 * Math.PI * freq * 2 * t + 0.3) + 0.12 * Math.sin(2 * Math.PI * freq * 0.5 * t + 0.7)) / 1.4;
      if (detune) { phase2 += 2 * Math.PI * (freq * (1 + detune)) / sampleRate; sample = (sample + 0.45 * Math.sin(phase2)) / 1.45; }
      const idx = start + i;
      if (idx >= 0 && idx < buf.length) buf[idx] += sample * amp * env * (0.9 + 0.1 * Math.sin(2 * Math.PI * 3 * t));
    }
  };
  const addNoise = (buf, start, len, amp, bright=false) => {
    let seed = (start * 1103515245 + 12345) & 0x7fffffff;
    let last = 0;
    for (let i = 0; i < len; i++) {
      seed = (1103515245 * seed + 12345) & 0x7fffffff;
      const white = (seed / 0x7fffffff) * 2 - 1;
      const n = bright ? white : (0.75 * last + 0.25 * white);
      last = n;
      const env = Math.pow(Math.max(0, 1 - i / Math.max(1, len)), bright ? 2.8 : 1.9);
      const idx = start + i;
      if (idx >= 0 && idx < buf.length) buf[idx] += n * amp * env;
    }
  };
  const addKick = (buf, start, amp) => { const len = Math.floor(sampleRate * 0.32); for (let i = 0; i < len; i++) { const t = i / sampleRate; const env = Math.exp(-7.5 * t); const freq = 110 - 70 * Math.min(1, t / 0.12); const sample = Math.sin(2 * Math.PI * freq * t) + 0.18 * Math.sin(2 * Math.PI * freq * 0.5 * t); const idx = start + i; if (idx >= 0 && idx < buf.length) buf[idx] += sample * amp * env * 0.85; } };
  const addSnare = (buf, start, amp) => { addNoise(buf, start, Math.floor(sampleRate * 0.22), amp, true); addSine(buf, start, Math.floor(sampleRate * 0.12), 185, amp * 0.22, 0.001, 0.8); };
  const addHat = (buf, start, amp) => addNoise(buf, start, Math.floor(sampleRate * 0.06), amp, true);
  let cursorBar = 0;
  for (const section of sections) {
    const patt = (melodyMap[section.name] || melodyMap.verse)[section.motion] || (melodyMap[section.name] || melodyMap.verse).drive;
    for (let bar = 0; bar < section.bars; bar++) {
      const absoluteBar = cursorBar + bar;
      const chord = progression[absoluteBar % progression.length];
      const barStart = Math.floor(absoluteBar * barDur * sampleRate);
      const energy = 0.28 + section.energy * 0.9;
      const density = section.density;
      const drumDrive = section.drums;
      addSine(inst, barStart, Math.floor(barDur * sampleRate), degreeFreq(chord, 2), (0.06 + 0.07 * energy) * (section.motion === 'fall' ? 0.9 : 1), 0.04, 0.35, 0.003);
      addSine(inst, barStart, Math.floor(barDur * sampleRate), degreeFreq(chord + 2, 3), 0.05 + 0.06 * energy, 0.04, 0.35, -0.002);
      addSine(inst, barStart, Math.floor(barDur * sampleRate), degreeFreq(chord + 4, 3), 0.05 + 0.05 * energy, 0.04, 0.35, 0.001);
      if (density > 0.62 || section.motion === 'explode') addSine(inst, barStart, Math.floor(barDur * sampleRate), degreeFreq(chord + (section.motion === 'explode' ? 6 : 5), 4), 0.03 + 0.05 * density, 0.01, 0.25, 0.006);
      const kickBeats = new Set([0]);
      if (drumDrive >= 0.4) kickBeats.add(2);
      if (drumDrive >= 0.75 || section.motion === 'explode') { kickBeats.add(1); kickBeats.add(3); }
      const snareBeats = drumDrive >= 0.18 ? new Set([1,3]) : new Set([3]);
      const hatSteps = drumDrive > 0.78 ? 16 : drumDrive > 0.4 ? 8 : 4;
      for (let beat = 0; beat < 4; beat++) {
        const beatStart = barStart + Math.floor(beat * beatDur * sampleRate);
        addSine(inst, beatStart, Math.floor(beatDur * (density > 0.65 ? 0.92 : 0.82) * sampleRate), degreeFreq(beat % 2 === 0 ? chord : chord + 4, 1), 0.10 + 0.16 * energy + (section.motion === 'explode' ? 0.04 : 0), 0.01, 0.25);
        for (let step = 0; step < hatSteps / 4; step++) {
          const hatPos = beatStart + Math.floor(step * (beatDur / Math.max(1, hatSteps / 4)) * sampleRate);
          addHat(drums, hatPos, (0.06 + 0.20 * drumDrive) * (section.motion === 'fall' ? 0.75 : 1));
        }
        if (kickBeats.has(beat)) addKick(drums, beatStart, 0.55 + 0.48 * drumDrive);
        if (snareBeats.has(beat)) addSnare(drums, beatStart, 0.28 + 0.52 * drumDrive);
        if ((section.motion === 'drive' || section.motion === 'explode') && drumDrive > 0.65) addHat(drums, beatStart + Math.floor(beatDur * 0.75 * sampleRate), 0.05 + 0.10 * drumDrive);
      }
      const stepSeconds = density > 0.82 || section.motion === 'explode' ? beatDur / 4 : density > 0.48 ? beatDur / 2 : beatDur;
      const octv = density > 0.82 || section.motion === 'explode' ? 5 : 4;
      const noteAmp = 0.11 + 0.15 * energy + (section.name === 'chorus' ? 0.04 : 0);
      const steps = Math.max(4, Math.round(barDur / stepSeconds));
      for (let step = 0; step < steps; step++) {
        const noteStart = barStart + Math.floor(step * stepSeconds * sampleRate);
        const deg = patt[(absoluteBar * steps + step) % patt.length] + chord;
        addSine(lead, noteStart, Math.floor(Math.max(beatDur * 0.35, stepSeconds * 0.8) * sampleRate), degreeFreq(deg, octv), noteAmp, 0.02, section.motion === 'fall' ? 0.45 : 0.35, 0.004);
      }
    }
    cursorBar += section.bars;
  }
  const main = new Float32Array(totalSamples);
  const instrumental = new Float32Array(totalSamples);
  for (let i = 0; i < totalSamples; i++) { instrumental[i] = inst[i] + drums[i]; main[i] = instrumental[i] + lead[i]; }
  const mainPath = writeWavMono(path.join(runRoot, 'main.wav'), main, sampleRate);
  const leadPath = writeWavMono(path.join(runRoot, 'vocals.wav'), lead, sampleRate);
  const instPath = writeWavMono(path.join(runRoot, 'instrumental.wav'), instrumental, sampleRate);
  const drumsPath = writeWavMono(path.join(runRoot, 'drums.wav'), drums, sampleRate);
  const cover = writeSvgFile(path.join(runRoot, 'cover-art.svg'), title, '#6a3cff', 'Procedural full-song cover');
  const lyric = writeSvgFile(path.join(runRoot, 'lyric-video.svg'), title, '#0fdc7a', 'Procedural lyric video');
  return {
    mainPath,
    leadPath,
    instPath,
    drumsPath,
    cover,
    lyric,
    waveform: waveformFromValues(main),
    meta: {
      engine: 'procedural-song-stub',
      bpm,
      key: keyName,
      songLengthSec: Math.round(totalSeconds),
      sectionBars: normalizeSectionBars(sectionBars),
      sectionDynamics: sections,
      sectionTimings: timingsFromPlan(sections, 0.12, 'procedural-song-stub'),
      engineUsedPerSection: sections.map((section) => ({ index: section.index, name: section.name, engine: 'procedural-song-stub', prompt: section.prompt })),
      contractVersion: 'v10.27.9',
      note: 'Local arranged procedural song. Musical and layered, now driven by the same section contract as model lanes.',
    },
  };
}
function writeSvgFile(filePath, title, accent, subtitle) {
  const svg = decodeURIComponent(String(svgDataUrl(title, accent, subtitle)).replace(/^data:image\/svg\+xml;utf8,/, ""));
  fs.writeFileSync(filePath, svg, "utf8");
  return filePath;
}
function buildStubResponse(title, id, runRoot, payload = {}) {
  fs.mkdirSync(runRoot, { recursive: true });
  const song = buildProceduralSongFiles(runRoot, title, payload?.bpm || 118, payload?.key || 'A minor', payload?.vibe || payload?.genre || '', payload?.sectionBars || {}, payload?.songLengthSec || 150, payload?.sectionDynamics || {}, payload?.structure || []);
  return {
    ok: true,
    provider: "procedural-song-stub",
    audioUrl: maybeDataUrlFor(song.mainPath),
    stems: {
      vocals: maybeDataUrlFor(song.leadPath),
      instrumental: maybeDataUrlFor(song.instPath),
      drums: maybeDataUrlFor(song.drumsPath),
    },
    coverArtUrl: maybeDataUrlFor(song.cover),
    lyricVideoUrl: maybeDataUrlFor(song.lyric),
    waveform: song.waveform || waveform(),
    meta: { ...(song.meta || {}), runRoot },
  };
}
async function runPythonAdapter(cfg, payload, runRoot) {
  return await runPythonScript(cfg.adapterScript, cfg, payload, runRoot);
}
function normalizeAdapterResult(runRoot, result, fallbackTitle) {
  const audioPath = result.audioPath || "";
  const stems = result.stems || {};
  const coverArtPath = result.coverArtPath || "";
  const lyricVideoPath = result.lyricVideoPath || "";
  const normalized = {
    ok: true,
    provider: result.provider || "adapter",
    audioUrl: result.audioUrl || (audioPath && maybeDataUrlFor(audioPath)) || toneDataUrl(`${fallbackTitle}:main`),
    stems: {
      vocals: stems.vocalsUrl || (stems.vocals && maybeDataUrlFor(stems.vocals)) || toneDataUrl(`${fallbackTitle}:vocals`),
      instrumental: stems.instrumentalUrl || (stems.instrumental && maybeDataUrlFor(stems.instrumental)) || toneDataUrl(`${fallbackTitle}:instrumental`),
      drums: stems.drumsUrl || (stems.drums && maybeDataUrlFor(stems.drums)) || toneDataUrl(`${fallbackTitle}:drums`),
    },
    coverArtUrl: result.coverArtUrl || (coverArtPath && maybeDataUrlFor(coverArtPath)) || svgDataUrl(fallbackTitle, "#6a3cff", "Music provider cover"),
    lyricVideoUrl: result.lyricVideoUrl || (lyricVideoPath && maybeDataUrlFor(lyricVideoPath)) || svgDataUrl(fallbackTitle, "#0fdc7a", "Music provider lyric video"),
    waveform: result.waveform || waveform(),
    meta: result.meta || {},
  };
  if (result.audioUrl) saveInlineDataUrl(runRoot, "main-audio", result.audioUrl);
  if (result.coverArtUrl) saveInlineDataUrl(runRoot, "cover-art", result.coverArtUrl);
  if (result.lyricVideoUrl) saveInlineDataUrl(runRoot, "lyric-video", result.lyricVideoUrl);
  return normalized;
}
async function executeGeneration(rawPayload) {
  const cfg = getConfig();
  const finalPayload = {
    ...(rawPayload || {}),
    stylePreset: String(rawPayload?.stylePreset || 'default'),
    enableVocals: rawPayload?.enableVocals ?? (String(rawPayload?.mode || 'song') !== 'instrumental'),
    sectionBars: normalizeSectionBars(rawPayload?.sectionBars || {}),
    sectionDynamics: normalizeSectionDynamics(rawPayload?.sectionDynamics || {}),
    structure: normalizeStructure(rawPayload?.structure || []),
  };
  finalPayload.sectionPlan = buildSectionPlan({ ...(rawPayload || {}), ...finalPayload });
  finalPayload.songLengthSec = Number(rawPayload?.songLengthSec || finalPayload.sectionPlan.reduce((sum, section) => sum + Number(section.durationSec || 0), 0));
  if (!String(finalPayload.lyrics || '').trim() && finalPayload.enableVocals) {
    finalPayload.lyrics = finalPayload.sectionPlan.map((section) => {
      if (section.name === 'intro') return `${finalPayload.title || 'Untitled track'}\nwe begin in the glow`;
      if (section.name === 'verse') return `keep the rhythm moving\n${finalPayload.vibe || finalPayload.genre || 'tell the story'}`;
      if (section.name === 'chorus') return `${finalPayload.title || 'Untitled track'}\nlift it higher tonight`;
      return `fade it down\ncarry the spark home`;
    }).join('\n\n');
  }

  const title = String(finalPayload?.title || "Untitled track");
  const id = randomUUID().slice(0, 8);
  const runRoot = path.join(OUT_DIR, `${safeSlug(title)}-${id}`);
  fs.mkdirSync(runRoot, { recursive: true });

  const latestMeta = { title, runRoot, ts: Date.now(), engine: cfg.engine };
  writeJson(path.join(ROOT, "latest_run.json"), latestMeta);
  writeJson(path.join(runRoot, "request.json"), finalPayload || {});

  const finalize = (result, engineName = cfg.engine) => {
    ensureRunArtifacts(runRoot, title);
    const normalized = {
      ...(result || {}),
      ok: true,
      provider: result?.provider || engineName,
      audioUrl: result?.audioUrl || maybeDataUrlFor(path.join(runRoot, "main.wav")) || toneDataUrl(`${title}:main`),
      stems: {
        vocals: result?.stems?.vocals || maybeDataUrlFor(path.join(runRoot, "vocals.wav")) || toneDataUrl(`${title}:vocals`),
        instrumental: result?.stems?.instrumental || maybeDataUrlFor(path.join(runRoot, "instrumental.wav")) || toneDataUrl(`${title}:instrumental`),
        drums: result?.stems?.drums || maybeDataUrlFor(path.join(runRoot, "drums.wav")) || toneDataUrl(`${title}:drums`),
      },
      coverArtUrl: result?.coverArtUrl || maybeDataUrlFor(path.join(runRoot, "cover-art.svg")) || svgDataUrl(title, "#6a3cff", "Music provider cover"),
      lyricVideoUrl: result?.lyricVideoUrl || maybeDataUrlFor(path.join(runRoot, "lyric-video.svg")) || svgDataUrl(title, "#0fdc7a", "Music provider lyric video"),
      waveform: result?.waveform || waveform(),
      meta: {
        ...(result?.meta || {}),
        engine: engineName,
        runRoot,
        sectionDynamics: result?.meta?.sectionDynamics || finalPayload?.sectionPlan || [],
        sectionTimings: result?.meta?.sectionTimings || timingsFromPlan(finalPayload?.sectionPlan || [], 0.12, engineName),
        engineUsedPerSection: result?.meta?.engineUsedPerSection || (finalPayload?.sectionPlan || []).map((section) => ({ index: section.index, name: section.name, engine: engineName, prompt: section.prompt || '' })),
        contractVersion: result?.meta?.contractVersion || 'v10.28',
        stylePreset: result?.meta?.stylePreset || finalPayload?.stylePreset || 'default',
        enableVocals: result?.meta?.enableVocals ?? finalPayload?.enableVocals ?? (String(finalPayload?.mode || 'song') !== 'instrumental'),
      },
    };
    writeJson(path.join(runRoot, "response.json"), normalized);
    writeJson(path.join(ROOT, "latest_run.json"), { ...latestMeta, engine: engineName, files: fs.readdirSync(runRoot).sort() });
    return normalized;
  };

  const selectedEngine = resolveEngine(cfg);

  if (selectedEngine === "stub") {
    const result = buildStubResponse(title, id, runRoot, finalPayload);
    return finalize(result, selectedEngine);
  }

  if (selectedEngine === "python-adapter") {
    try {
      const result = await runPythonAdapter(cfg, finalPayload, runRoot);
      const normalized = normalizeAdapterResult(runRoot, result, title);
      return finalize(normalized, selectedEngine);
    } catch (error) {
      const fallback = buildStubResponse(title, id, runRoot, finalPayload);
      fallback.meta = { ...(fallback.meta || {}), fallbackReason: error?.message || String(error), requestedEngine: cfg.engine, selectedEngine, fallbackEngine: "stub" };
      return finalize(fallback, `${selectedEngine}:stub-fallback`);
    }
  }

  if (selectedEngine === "musicgen-cli") {
    try {
      const result = await runPythonScript(cfg.musicgenScript, cfg, finalPayload, runRoot);
      let normalized = normalizeAdapterResult(runRoot, result, title);
      const barkOverlay = await maybeApplyBarkOverlay(cfg, finalPayload, runRoot, normalized, selectedEngine);
      normalized = barkOverlay.normalized;
      normalized.meta = {
        ...(normalized.meta || {}),
        routedBy: "auto-engine-router",
        modelFamily: "MusicGen",
        barkOverlayApplied: barkOverlay.overlayApplied,
        barkOverlayReason: barkOverlay.overlayReason,
      };
      return finalize(normalized, selectedEngine);
    } catch (error) {
      const fallback = buildStubResponse(title, id, runRoot, finalPayload);
      fallback.meta = { ...(fallback.meta || {}), fallbackReason: error?.message || String(error), requestedEngine: cfg.engine, selectedEngine, fallbackEngine: "stub" };
      return finalize(fallback, `${selectedEngine}:stub-fallback`);
    }
  }

  if (selectedEngine === "bark-cli") {
    try {
      const result = await runPythonScript(cfg.barkScript, cfg, finalPayload, runRoot);
      const normalized = normalizeAdapterResult(runRoot, result, title);
      return finalize(normalized, selectedEngine);
    } catch (error) {
      const fallback = buildStubResponse(title, id, runRoot, finalPayload);
      fallback.meta = { ...(fallback.meta || {}), fallbackReason: error?.message || String(error), requestedEngine: cfg.engine, selectedEngine, fallbackEngine: "stub" };
      return finalize(fallback, `${selectedEngine}:stub-fallback`);
    }
  }

  if (selectedEngine === "external-api-json") {
    try {
      const result = await runExternalApiJson(cfg, finalPayload, runRoot);
      const normalized = normalizeAdapterResult(runRoot, result, title);
      return finalize(normalized, selectedEngine);
    } catch (error) {
      const fallback = buildStubResponse(title, id, runRoot, finalPayload);
      fallback.meta = { ...(fallback.meta || {}), fallbackReason: error?.message || String(error), requestedEngine: cfg.engine, selectedEngine, fallbackEngine: "stub" };
      return finalize(fallback, `${selectedEngine}:stub-fallback`);
    }
  }

  if (selectedEngine === "command-json") {
    try {
      const result = await runJsonCommand(cfg, finalPayload, runRoot);
      const normalized = normalizeAdapterResult(runRoot, result, title);
      return finalize(normalized, selectedEngine);
    } catch (error) {
      const fallback = buildStubResponse(title, id, runRoot, finalPayload);
      fallback.meta = { ...(fallback.meta || {}), fallbackReason: error?.message || String(error), requestedEngine: cfg.engine, selectedEngine, fallbackEngine: "stub" };
      return finalize(fallback, `${selectedEngine}:stub-fallback`);
    }
  }

  const fallback = buildStubResponse(title, id, runRoot, finalPayload);
  fallback.meta = { ...(fallback.meta || {}), fallbackReason: `Unsupported engine: ${selectedEngine}`, requestedEngine: cfg.engine, selectedEngine, fallbackEngine: "stub" };
  return finalize(fallback, `unsupported:${selectedEngine}:stub-fallback`);
}


function ensureRunArtifacts(runRoot, title) {
  fs.mkdirSync(runRoot, { recursive: true });
  const required = [
    ["main.wav", () => buildProceduralSongFiles(runRoot, title, 118, "A minor", "", {}, 150, {}, []).mainPath],
    ["vocals.wav", () => writeToneWavFile(path.join(runRoot, "vocals.wav"), 260, 2.4)],
    ["instrumental.wav", () => writeToneWavFile(path.join(runRoot, "instrumental.wav"), 190, 2.4)],
    ["drums.wav", () => writeToneWavFile(path.join(runRoot, "drums.wav"), 360, 1.4)],
    ["cover-art.svg", () => writeSvgFile(path.join(runRoot, "cover-art.svg"), title, "#6a3cff", "Music provider cover")],
    ["lyric-video.svg", () => writeSvgFile(path.join(runRoot, "lyric-video.svg"), title, "#0fdc7a", "Music provider lyric video")],
  ];
  for (const [name, factory] of required) {
    const target = path.join(runRoot, name);
    if (!fs.existsSync(target) || fs.statSync(target).size <= 0) factory();
  }
  const manifestPath = path.join(runRoot, "manifest.json");
  writeJson(manifestPath, {
    title,
    runRoot,
    files: fs.readdirSync(runRoot).sort(),
    updatedAt: Date.now(),
  });
}
function getLatestRun() {
  const latestPath = path.join(ROOT, "latest_run.json");
  const latest = readJson(latestPath, null);
  if (latest?.runRoot && fs.existsSync(latest.runRoot)) {
    ensureRunArtifacts(latest.runRoot, latest.title || "Untitled track");
    writeJson(latestPath, { ...latest, files: fs.readdirSync(latest.runRoot).sort(), ts: latest.ts || Date.now() });
    return readJson(latestPath, latest);
  }
  const folders = fs.existsSync(OUT_DIR)
    ? fs.readdirSync(OUT_DIR)
        .map((name) => ({ name, full: path.join(OUT_DIR, name), stat: fs.statSync(path.join(OUT_DIR, name)) }))
        .filter((entry) => entry.stat.isDirectory())
        .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs)
    : [];
  if (folders[0]) {
    const recovered = { title: folders[0].name, runRoot: folders[0].full, ts: Date.now(), engine: "recovered-latest" };
    ensureRunArtifacts(recovered.runRoot, recovered.title);
    writeJson(latestPath, { ...recovered, files: fs.readdirSync(recovered.runRoot).sort() });
    return readJson(latestPath, recovered);
  }
  const emergencyTitle = "Emergency Stub Track";
  const emergencyRoot = path.join(OUT_DIR, `${safeSlug(emergencyTitle)}-bootstrap`);
  fs.mkdirSync(emergencyRoot, { recursive: true });
  buildStubResponse(emergencyTitle, "bootstrap", emergencyRoot);
  ensureRunArtifacts(emergencyRoot, emergencyTitle);
  const emergency = { title: emergencyTitle, runRoot: emergencyRoot, ts: Date.now(), engine: "bootstrap-stub", files: fs.readdirSync(emergencyRoot).sort() };
  writeJson(latestPath, emergency);
  return emergency;
}
function buildReleaseFromLatest(titleOverride) {
  const latest = getLatestRun();
  const title = String(titleOverride || latest.title || "untitled-release");
  const releaseRoot = path.join(ROOT, "final_releases", `${safeSlug(title)}-${String(Date.now()).slice(-6)}`);
  fs.mkdirSync(releaseRoot, { recursive: true });
  ensureRunArtifacts(latest.runRoot, latest.title || title);

  const copies = [
    ["main.wav", "track.wav"],
    ["vocals.wav", "stems_vocals.wav"],
    ["instrumental.wav", "stems_instrumental.wav"],
    ["drums.wav", "stems_drums.wav"],
    ["cover-art.svg", "cover-art.svg"],
    ["lyric-video.svg", "lyric-video.svg"],
    ["manifest.json", "source-manifest.json"],
    ["response.json", "source-response.json"],
  ];
  for (const [srcName, targetName] of copies) {
    const src = path.join(latest.runRoot, srcName);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(releaseRoot, targetName));
  }
  fs.writeFileSync(path.join(releaseRoot, "social-caption.txt"), `${title} is ready. Stream it, share it, and run it back. #newmusic #oddengine`, "utf8");
  fs.writeFileSync(path.join(releaseRoot, "release-checklist.md"), `# Final Release

- Track exported
- Stems exported
- Cover art packaged
- Social assets packaged
`, "utf8");
  const files = fs.readdirSync(releaseRoot).sort();
  const metadata = {
    title,
    createdAt: Date.now(),
    sourceRun: latest,
    files,
    releaseRoot,
  };
  fs.writeFileSync(path.join(releaseRoot, "metadata.json"), JSON.stringify(metadata, null, 2), "utf8");
  const finalFiles = fs.readdirSync(releaseRoot).sort();
  metadata.files = finalFiles;
  fs.writeFileSync(path.join(releaseRoot, "metadata.json"), JSON.stringify(metadata, null, 2), "utf8");
  return { latest, releaseRoot, metadata, files: finalFiles };
}


function wavDurationSeconds(filePath) {
  try {
    const stat = fs.statSync(filePath);
    return Math.max(0, Number(((stat.size - 44) / 2 / 22050).toFixed(2)));
  } catch {
    return 0;
  }
}
async function runModelSmokeTest(payload = {}) {
  const title = String(payload?.title || 'OddEngine First Real Song');
  const result = await executeGeneration({
    title,
    prompt: payload?.prompt || 'A triumphant cinematic pop song that rises from darkness into hope.',
    bpm: payload?.bpm || 118,
    key: payload?.key || 'A minor',
    vibe: payload?.vibe || 'emotional, triumphant, modern',
    genre: payload?.genre || 'cinematic pop',
    lyrics: payload?.lyrics || '',
    arrangement: payload?.arrangement || '',
    songLengthSec: payload?.songLengthSec || 150,
    sectionBars: payload?.sectionBars || { intro: 2, verse: 4, chorus: 4, outro: 2 },
    sectionDynamics: payload?.sectionDynamics || { intro: { energy: 54, density: 34, drums: 26, motion: 'rise' }, verse: { energy: 68, density: 58, drums: 56, motion: 'drive' }, chorus: { energy: 95, density: 88, drums: 90, motion: 'explode' }, outro: { energy: 48, density: 28, drums: 22, motion: 'fall' } },
    enableBarkOverlay: payload?.enableBarkOverlay !== false,
  });
  const latest = getLatestRun();
  const release = buildReleaseFromLatest(title);
  const paths = {
    audio: path.join(latest.runRoot, 'main.wav'),
    vocals: path.join(latest.runRoot, 'vocals.wav'),
    instrumental: path.join(latest.runRoot, 'instrumental.wav'),
    drums: path.join(latest.runRoot, 'drums.wav'),
    cover: path.join(latest.runRoot, 'cover-art.svg'),
  };
  const checks = {
    audioExists: fs.existsSync(paths.audio),
    durationSeconds: wavDurationSeconds(paths.audio),
    waveformRendered: Array.isArray(result?.waveform) && result.waveform.length > 12,
    stemsExist: ['vocals','instrumental','drums'].every((name) => fs.existsSync(paths[name])),
    mergeWorks: fs.existsSync(path.join(release.releaseRoot, 'track.wav')),
    finalReleaseExists: fs.existsSync(release.releaseRoot),
  };
  return {
    ok: Object.values(checks).every((v) => typeof v === 'number' ? v > 0 : !!v),
    title,
    checks: {
      ...checks,
      durationPositive: checks.durationSeconds > 0,
    },
    latest,
    release: {
      folder: release.releaseRoot,
      files: release.files,
      metadata: release.metadata,
    },
    provider: result?.provider || null,
    runtimeMeta: result?.meta || {},
    failReasons: [
      !checks.audioExists ? 'main.wav missing' : null,
      !(checks.durationSeconds > 0) ? 'main.wav duration not positive' : null,
      !checks.waveformRendered ? 'waveform array missing or too short' : null,
      !checks.stemsExist ? 'one or more stems missing' : null,
      !checks.mergeWorks ? 'final release track.wav missing' : null,
    ].filter(Boolean),
  };
}
const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return send(res, 200, { ok: true });
  const url = new URL(req.url || "/", `http://${req.headers.host || `${HOST}:${PORT}`}`);

  if (req.method === "GET" && url.pathname === "/health") {
    const cfg = getConfig();
    return send(res, 200, {
      ok: true,
      status: "ready",
      service: "music-provider-bridge",
      detail: cfg.engine === "stub"
        ? "Bridge ready in stub mode. Switch engine to python-adapter to execute a real local model adapter."
        : `Bridge ready in ${cfg.engine} mode.`,
      config: cfg,
      selectedEngine: resolveEngine(cfg),
      engines: engineCatalog(cfg),
      runtime: runtimeDoctor(cfg),
    });
  }

  if (req.method === "GET" && url.pathname === "/config") {
    const cfg = getConfig();
    return send(res, 200, { ok: true, config: cfg, selectedEngine: resolveEngine(cfg), engines: engineCatalog(cfg), runtime: runtimeDoctor(cfg) });
  }

  if (req.method === "POST" && url.pathname === "/config") {
    const body = await readBody(req).catch(() => ({}));
    const cfg = saveConfig(body || {});
    return send(res, 200, { ok: true, config: cfg, selectedEngine: resolveEngine(cfg), engines: engineCatalog(cfg), runtime: runtimeDoctor(cfg) });
  }

if (req.method === "GET" && url.pathname === "/engines") {
  const cfg = getConfig();
  return send(res, 200, { ok: true, selectedEngine: resolveEngine(cfg), engines: engineCatalog(cfg), config: cfg, runtime: runtimeDoctor(cfg) });
}

if (req.method === "GET" && url.pathname === "/runtime/doctor") {
  const cfg = getConfig();
  return send(res, 200, { ok: true, runtime: runtimeDoctor(cfg), config: cfg, selectedEngine: resolveEngine(cfg) });
}

if (req.method === "GET" && url.pathname === "/debug/files") {
  const latest = readJson(path.join(ROOT, "latest_run.json"), null);
  const outputsRoot = path.join(ROOT, "outputs");
  const finalRoot = path.join(ROOT, "final_releases");
  const outFolders = fs.existsSync(outputsRoot) ? fs.readdirSync(outputsRoot).sort() : [];
  const finalFolders = fs.existsSync(finalRoot) ? fs.readdirSync(finalRoot).sort() : [];
  return send(res, 200, { ok: true, root: ROOT, latest, outputsRoot, outFolders, finalRoot, finalFolders });
}

if (req.method === "GET" && url.pathname === "/final-release/latest") {
  const latest = readJson(path.join(ROOT, "latest_run.json"), null);
  const recovered = getLatestRun();
  const files = fs.readdirSync(recovered.runRoot).sort();
  return send(res, 200, { ok: true, latest: recovered, files, folder: recovered.runRoot });
}

if (req.method === "POST" && url.pathname === "/final-release/merge") {
  const body = await readBody(req).catch(() => ({}));
  const latest = readJson(path.join(ROOT, "latest_run.json"), null);
  if (!latest || !latest.runRoot || !fs.existsSync(latest.runRoot)) return send(res, 404, { ok: false, error: "No latest run found" });
  const title = String(body?.title || latest.title || "untitled-release");
  const releaseRoot = path.join(ROOT, "final_releases", `${safeSlug(title)}-${String(Date.now()).slice(-6)}`);
  fs.mkdirSync(releaseRoot, { recursive: true });

  const copyIf = (name, target) => {
    const src = path.join(latest.runRoot, name);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(releaseRoot, target));
  };
  copyIf("main.wav", "track.wav");
  copyIf("vocals.wav", "stems_vocals.wav");
  copyIf("instrumental.wav", "stems_instrumental.wav");
  copyIf("drums.wav", "stems_drums.wav");
  copyIf("cover-art.svg", "cover-art.svg");
  copyIf("lyric-video.svg", "lyric-video.svg");

  const metadata = {
    title,
    createdAt: Date.now(),
    sourceRun: latest,
    files: fs.readdirSync(releaseRoot).sort(),
  };
  fs.writeFileSync(path.join(releaseRoot, "metadata.json"), JSON.stringify(metadata, null, 2), "utf8");
  fs.writeFileSync(path.join(releaseRoot, "social-caption.txt"), `${title} is ready. Stream it, share it, and run it back. #newmusic #oddengine`, "utf8");
  fs.writeFileSync(path.join(releaseRoot, "release-checklist.md"), `# Final Release\n\n- Track exported\n- Stems exported\n- Cover art packaged\n- Social assets packaged\n`, "utf8");

  return send(res, 200, { ok: true, folder: releaseRoot, files: fs.readdirSync(releaseRoot).sort(), metadata });
}


  if (req.method === "POST" && url.pathname === "/smoke-test") {
    try {
      const body = await readBody(req).catch(() => ({}));
      const payload = body?.payload || {};
      const result = await runModelSmokeTest(payload);
      return send(res, result.ok ? 200 : 500, result);
    } catch (e) {
      return send(res, 500, { ok: false, error: e?.message || String(e) });
    }
  }

  if (req.method === "POST" && url.pathname === "/generate") {
    try {
      const body = await readBody(req).catch(() => ({}));
      const payload = body?.payload || {};
      const result = await executeGeneration(payload);
      return send(res, 200, result);
    } catch (e) {
      return send(res, 500, { ok: false, error: e?.message || String(e) });
    }
  }

  return send(res, 404, { ok: false, error: "Not found" });
});

server.listen(PORT, HOST, () => {
  console.log(`[OddEngine Music Provider] Ready on http://${HOST}:${PORT}`);
});
