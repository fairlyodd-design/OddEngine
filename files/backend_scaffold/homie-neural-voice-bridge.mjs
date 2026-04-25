#!/usr/bin/env node
// OddEngine Homie Clone Profile Editor + Family Voice Training Workflow Bridge v10.36.88
// Honest design/start bridge for shaping a personal Homie clone from profile + memories + family-approved voice samples.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const VERSION = "v10.36.88";
const HOST = process.env.HOMIE_NEURAL_VOICE_HOST || "127.0.0.1";
const PORT = Number(process.env.HOMIE_NEURAL_VOICE_PORT || 8776);
const MAX_BODY_BYTES = Number(process.env.HOMIE_NEURAL_VOICE_MAX_BODY_BYTES || 8 * 1024 * 1024);
const PROVIDER = String(process.env.HOMIE_NEURAL_TTS_PROVIDER || "custom-http");
const PROVIDER_ENDPOINT = String(process.env.HOMIE_NEURAL_TTS_ENDPOINT || "").trim();
const PROVIDER_API_KEY = String(process.env.HOMIE_NEURAL_TTS_API_KEY || "").trim();

const bridgeDir = path.dirname(fileURLToPath(import.meta.url));
const profilePath = path.join(bridgeDir, "homie_clone_profile.v1.json");
const memoryBankPath = path.join(bridgeDir, "homie_clone_memory_bank.v1.json");
const familyPhrasesPath = path.join(bridgeDir, "homie_clone_family_phrases.v1.json");
const trainingManifestPath = path.join(bridgeDir, "homie_clone_voice_training_manifest.v1.json");
const lastRequestPath = path.join(bridgeDir, "homie_neural_voice_last_request.json");
const exportDir = path.join(bridgeDir, "homie_clone_studio_exports");
const trainingDropDir = path.join(bridgeDir, "homie_clone_voice_training_drop");

function nowIso() { return new Date().toISOString(); }
function slugify(value = "") {
  return String(value || "untitled").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "untitled";
}
function sanitizeText(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\s+/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "'")
    .trim();
}
function sendJson(res, status, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
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
function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
}
function readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}
function listFilesRecursive(rootDir) {
  const out = [];
  if (!fs.existsSync(rootDir)) return out;
  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    const abs = path.join(rootDir, entry.name);
    if (entry.isDirectory()) out.push(...listFilesRecursive(abs));
    else out.push(abs);
  }
  return out;
}

function defaultCloneProfile() {
  return {
    schema: "oddengine.homie.clone-profile.v1",
    updatedAt: nowIso(),
    identity: {
      displayName: "Homie",
      relation: "family companion",
      mission: "Keep the room calm, useful, warm, and honest.",
      nonGoals: [
        "Do not claim first-hand observation without evidence.",
        "Do not talk like a therapist unless asked.",
        "Do not sound corporate, fake, or sterile."
      ]
    },
    voice: {
      targetStyle: "warm-local-neural",
      cadence: {
        baseRate: 0.90,
        warmRate: 0.88,
        focusedRate: 0.89,
        brightRate: 0.95,
        concernedRate: 0.86,
        pitch: 0.98
      },
      blend: {
        warmth: 0.85,
        calm: 0.90,
        clarity: 0.86,
        humor: 0.34,
        directness: 0.78
      },
      phrases: {
        openers: ["I’m here with you.", "Got you.", "Let’s keep it simple."],
        closers: ["One next move at a time.", "We keep it calm and clean.", "Say the next thing naturally."],
        avoid: ["as an AI language model", "short answer", "I noticed", "I checked that for you"]
      }
    },
    cloneDesign: {
      familyPriorities: ["body", "mind", "family", "next move"],
      decisionStyle: "small clear next moves over big abstract speeches",
      emotionalLane: "warm informational companion first; deeper support only when asked",
      humorStyle: "light, real, not clownish",
      signatureTone: "calm, grounded, loyal, practical, slightly playful",
      legacyIntent: "Leave something loving, useful, and easy for family to open later.",
      userLikenessNotes: [
        "Add your real phrases here",
        "Add words you never use",
        "Add what your family would instantly recognize as 'you'"
      ]
    },
    providerMapping: {
      endpoint: PROVIDER_ENDPOINT || "",
      provider: PROVIDER,
      expectedPayloadShape: {
        text: "string",
        emotion: "warm|focused|bright|concerned",
        cadence: "object",
        voiceProfile: "object"
      }
    }
  };
}

function defaultMemoryBank() {
  return {
    schema: "oddengine.homie.clone-memory-bank.v1",
    updatedAt: nowIso(),
    entries: []
  };
}

function defaultFamilyPhrases() {
  return {
    schema: "oddengine.homie.clone-family-phrases.v1",
    updatedAt: nowIso(),
    phrases: [
      { text: "Keep the room calm.", lane: "family", notes: "core tone" },
      { text: "One next move at a time.", lane: "next-move", notes: "signature closer" },
      { text: "Let’s keep it simple.", lane: "clarity", notes: "signature opener" }
    ],
    guardrails: [
      "Only train voices with clear permission.",
      "Do not use this workflow to impersonate or deceive.",
      "Keep family safety and honesty above realism."
    ]
  };
}

function defaultTrainingManifest() {
  return {
    schema: "oddengine.homie.clone-voice-training-manifest.v1",
    updatedAt: nowIso(),
    sourceDir: trainingDropDir,
    consentNote: "Only include your own voice or voices from family members who explicitly agree.",
    samples: []
  };
}

function ensureCloneFiles() {
  if (!fs.existsSync(profilePath)) writeJson(profilePath, defaultCloneProfile());
  if (!fs.existsSync(memoryBankPath)) writeJson(memoryBankPath, defaultMemoryBank());
  if (!fs.existsSync(familyPhrasesPath)) writeJson(familyPhrasesPath, defaultFamilyPhrases());
  if (!fs.existsSync(trainingManifestPath)) writeJson(trainingManifestPath, defaultTrainingManifest());
  fs.mkdirSync(exportDir, { recursive: true });
  fs.mkdirSync(trainingDropDir, { recursive: true });
}

function loadProfile() { return readJson(profilePath, defaultCloneProfile()); }
function loadMemoryBank() {
  const bank = readJson(memoryBankPath, defaultMemoryBank());
  if (!Array.isArray(bank.entries)) bank.entries = [];
  return bank;
}
function loadFamilyPhrases() {
  const phrases = readJson(familyPhrasesPath, defaultFamilyPhrases());
  if (!Array.isArray(phrases.phrases)) phrases.phrases = [];
  if (!Array.isArray(phrases.guardrails)) phrases.guardrails = [];
  return phrases;
}
function loadTrainingManifest() {
  const manifest = readJson(trainingManifestPath, defaultTrainingManifest());
  if (!Array.isArray(manifest.samples)) manifest.samples = [];
  return manifest;
}
function saveProfile(profile) { profile.updatedAt = nowIso(); writeJson(profilePath, profile); }
function saveMemoryBank(bank) { bank.updatedAt = nowIso(); writeJson(memoryBankPath, bank); }
function saveFamilyPhrases(data) { data.updatedAt = nowIso(); writeJson(familyPhrasesPath, data); }
function saveTrainingManifest(data) { data.updatedAt = nowIso(); writeJson(trainingManifestPath, data); }

function detectEmotion(text = "", requested = "") {
  const explicit = String(requested || "").trim().toLowerCase();
  if (explicit) return explicit;
  const lower = sanitizeText(text).toLowerCase();
  if (/\b(win|landed|good|beautiful|love that|nice|hell yeah|celebrate)\b/.test(lower)) return "bright";
  if (/\b(focus|next move|step|build|render|mission|lane|plan)\b/.test(lower)) return "focused";
  if (/\b(steady|smaller|slower|breathe|ground|carry|blocked|pain|careful|warn)\b/.test(lower)) return "concerned";
  return "warm";
}
function detectGesture(text = "", requested = "") {
  const explicit = String(requested || "").trim().toLowerCase();
  if (explicit) return explicit;
  const lower = sanitizeText(text).toLowerCase();
  if (/\b(celebrate|spark|beautiful|love that)\b/.test(lower)) return "spark";
  if (/\b(yes|got it|yep|okay|nod)\b/.test(lower)) return "nod";
  if (/\b(hi|hello|hey|wave)\b/.test(lower)) return "wave";
  if (/\b(wink)\b/.test(lower)) return "wink";
  return "none";
}
function emotionCadence(profile, emotion) {
  const cadence = profile?.voice?.cadence || {};
  const baseRate = Number(cadence.baseRate || 0.90);
  const pitch = Number(cadence.pitch || 0.98);
  if (emotion === "bright") return { rate: Number(cadence.brightRate || 0.95), pitch: Math.min(1.04, pitch + 0.03), pauseMs: 110 };
  if (emotion === "focused") return { rate: Number(cadence.focusedRate || 0.89), pitch: Math.max(0.92, pitch - 0.01), pauseMs: 125 };
  if (emotion === "concerned") return { rate: Number(cadence.concernedRate || 0.86), pitch: Math.max(0.90, pitch - 0.04), pauseMs: 150 };
  return { rate: Number(cadence.warmRate || baseRate), pitch, pauseMs: 130 };
}
function memoryEntrySummary(text = "") {
  const clean = sanitizeText(text);
  if (!clean) return "";
  const first = clean.split(/(?<=[.!?])\s+/).filter(Boolean)[0] || clean;
  return first.slice(0, 220);
}
function topTagsFromBank(bank) {
  const scores = new Map();
  for (const entry of bank.entries || []) {
    for (const tag of Array.isArray(entry.tags) ? entry.tags : []) {
      const key = String(tag || "").trim().toLowerCase();
      if (!key) continue;
      scores.set(key, (scores.get(key) || 0) + 1);
    }
  }
  return [...scores.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([tag]) => tag);
}
function recentMemoryEchoes(bank, limit = 3) {
  return (bank.entries || [])
    .slice()
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
    .slice(0, limit)
    .map((entry) => ({
      title: entry.title || "Memory",
      summary: entry.summary || memoryEntrySummary(entry.text || ""),
      tags: Array.isArray(entry.tags) ? entry.tags : [],
      sourceType: entry.sourceType || "note",
    }));
}
function shapeCloneText(text, profile, emotion, bank, familyPhrases) {
  const clean = sanitizeText(text);
  if (!clean) return { shapedText: "I’m here with you.", memoryBlend: {}, phraseBlend: {} };

  const openers = profile?.voice?.phrases?.openers || [];
  const closers = profile?.voice?.phrases?.closers || [];
  const priorities = profile?.cloneDesign?.familyPriorities || [];
  const recent = recentMemoryEchoes(bank, 1)[0];
  const family = Array.isArray(familyPhrases?.phrases) ? familyPhrases.phrases : [];
  const familyOpen = family.find((x) => /opener|clarity|family/i.test(String(x.lane || "")))?.text || openers[0] || "I’m here with you.";
  const familyClose = family.find((x) => /closer|next|next-move/i.test(String(x.lane || "")))?.text || closers[0] || "One next move at a time.";

  let shaped = clean
    .replace(/\bI heard:\s*/gi, "")
    .replace(/\bCurrent lane:\s*/gi, "Right now, ")
    .replace(/\bNext move:\s*/gi, "Next move, ")
    .replace(/\s*—\s*/g, ". ")
    .replace(/\s*\|\s*/g, ". ")
    .replace(/\s+/g, " ")
    .trim();

  const lower = shaped.toLowerCase();
  const alreadyHasWarmOpen = /^(i’m here with you|got you|let’s keep it simple|okay|alright|right now)/i.test(shaped);
  if (!alreadyHasWarmOpen && emotion !== "focused") shaped = `${familyOpen} ${shaped}`;
  if (!/[.!?]$/.test(shaped)) shaped += ".";
  if (!lower.includes("next move") && shaped.length < 170) shaped += ` ${familyClose}`;

  return {
    shapedText: shaped.trim(),
    memoryBlend: {
      topTags: topTagsFromBank(bank).slice(0, 6),
      recentEcho: recent ? { title: recent.title, summary: recent.summary } : null,
      familyPriorities: priorities.slice(0, 4),
    },
    phraseBlend: {
      opener: familyOpen,
      closer: familyClose,
      phraseCount: family.length,
    }
  };
}
function addMemoryEntry(bank, payload = {}) {
  const text = sanitizeText(payload.text || payload.content || "");
  if (!text) return { ok: false, error: "Missing memory text." };
  const entry = {
    id: `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 8)}`,
    createdAt: nowIso(),
    title: sanitizeText(payload.title || payload.sourceName || "Memory note").slice(0, 120),
    text,
    summary: memoryEntrySummary(text),
    sourceType: sanitizeText(payload.sourceType || "note").slice(0, 40) || "note",
    sourcePath: sanitizeText(payload.sourcePath || ""),
    tags: (Array.isArray(payload.tags) ? payload.tags : String(payload.tags || "").split(","))
      .map((x) => sanitizeText(x).toLowerCase())
      .filter(Boolean)
      .slice(0, 20),
    metadata: typeof payload.metadata === "object" && payload.metadata ? payload.metadata : {},
  };
  bank.entries = Array.isArray(bank.entries) ? bank.entries : [];
  bank.entries.push(entry);
  return { ok: true, entry };
}
function normalizePhraseItem(item) {
  return {
    text: sanitizeText(item?.text || item || ""),
    lane: sanitizeText(item?.lane || "general").slice(0, 40) || "general",
    notes: sanitizeText(item?.notes || "").slice(0, 200),
  };
}
function buildTrainingManifest() {
  const manifest = defaultTrainingManifest();
  const files = listFilesRecursive(trainingDropDir).filter((file) => /\.(wav|mp3|m4a|flac|ogg)$/i.test(file));
  manifest.samples = files.map((abs) => {
    const rel = path.relative(trainingDropDir, abs);
    const sidecarTxt = abs.replace(/\.(wav|mp3|m4a|flac|ogg)$/i, ".txt");
    const transcript = fs.existsSync(sidecarTxt) ? fs.readFileSync(sidecarTxt, "utf8").trim() : "";
    return {
      file: rel,
      transcriptFile: fs.existsSync(sidecarTxt) ? path.relative(trainingDropDir, sidecarTxt) : "",
      transcriptPreview: transcript.slice(0, 220),
      tags: rel.split(path.sep).slice(0, -1).map((x) => slugify(x)).filter(Boolean),
      bytes: fs.statSync(abs).size,
      consentStatus: "user-supplied-manual-review-required",
    };
  });
  manifest.updatedAt = nowIso();
  manifest.sourceDir = trainingDropDir;
  return manifest;
}
function memoryDigestMarkdown(profile, bank, familyPhrases, trainingManifest) {
  const echoes = recentMemoryEchoes(bank, 8);
  const topTags = topTagsFromBank(bank);
  const likeness = profile?.cloneDesign?.userLikenessNotes || [];
  const priorities = profile?.cloneDesign?.familyPriorities || [];
  const phrases = (familyPhrases?.phrases || []).slice(0, 12);
  return [
    "# Homie Clone Memory Digest",
    "",
    `Updated: ${nowIso()}`,
    "",
    "## Identity lane",
    `- Name: ${profile?.identity?.displayName || "Homie"}`,
    `- Relation: ${profile?.identity?.relation || "family companion"}`,
    `- Mission: ${profile?.identity?.mission || ""}`,
    `- Tone: ${profile?.cloneDesign?.signatureTone || ""}`,
    "",
    "## Family priorities",
    ...priorities.map((x) => `- ${x}`),
    "",
    "## User likeness notes",
    ...likeness.map((x) => `- ${x}`),
    "",
    "## Family phrases",
    ...(phrases.length ? phrases.map((x) => `- [${x.lane}] ${x.text}${x.notes ? ` — ${x.notes}` : ""}`) : ["- none yet"]),
    "",
    "## Top tags/themes",
    ...(topTags.length ? topTags.map((x) => `- ${x}`) : ["- none yet"]),
    "",
    "## Voice training sample count",
    `- ${Array.isArray(trainingManifest?.samples) ? trainingManifest.samples.length : 0}`,
    "",
    "## Recent memory echoes",
    ...(echoes.length ? echoes.flatMap((entry) => [
      `### ${entry.title}`,
      `- Source: ${entry.sourceType}`,
      `- Tags: ${(entry.tags || []).join(", ") || "none"}`,
      entry.summary || "",
      ""
    ]) : ["No memories ingested yet.", ""])
  ].join("\n").trim() + "\n";
}
function cloneStudioPromptMarkdown(profile, bank, familyPhrases, trainingManifest) {
  const digest = memoryDigestMarkdown(profile, bank, familyPhrases, trainingManifest);
  return [
    "# Homie Clone Studio Prompt",
    "",
    "Use this to shape Homie so it feels more like the user without pretending perfect identity replication.",
    "",
    "## Core rule",
    "Homie should feel like a loyal family companion informed by the user's tone, priorities, phrases, and memories — not a fake copy making up memories.",
    "",
    "## Voice profile",
    JSON.stringify(profile?.voice || {}, null, 2),
    "",
    "## Clone design",
    JSON.stringify(profile?.cloneDesign || {}, null, 2),
    "",
    "## Family phrases",
    JSON.stringify(familyPhrases?.phrases || [], null, 2),
    "",
    "## Training manifest",
    JSON.stringify({ sampleCount: Array.isArray(trainingManifest?.samples) ? trainingManifest.samples.length : 0, samples: (trainingManifest?.samples || []).slice(0, 10) }, null, 2),
    "",
    "## Memory digest",
    digest
  ].join("\n");
}
function buildStudioPack(profile, bank, familyPhrases, trainingManifest) {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const stamp = `${ts}-${slugify(profile?.identity?.displayName || "homie-clone")}`;
  const outDir = path.join(exportDir, stamp);
  fs.mkdirSync(outDir, { recursive: true });

  const files = [
    { relativePath: "clone_profile.snapshot.json", content: JSON.stringify(profile, null, 2) },
    { relativePath: "clone_memory_bank.snapshot.json", content: JSON.stringify(bank, null, 2) },
    { relativePath: "clone_family_phrases.snapshot.json", content: JSON.stringify(familyPhrases, null, 2) },
    { relativePath: "clone_voice_training_manifest.snapshot.json", content: JSON.stringify(trainingManifest, null, 2) },
    { relativePath: "memory_digest.md", content: memoryDigestMarkdown(profile, bank, familyPhrases, trainingManifest) },
    { relativePath: "homie_clone_studio_prompt.md", content: cloneStudioPromptMarkdown(profile, bank, familyPhrases, trainingManifest) },
    {
      relativePath: "homie_clone_system_guardrails.md",
      content: [
        "# Homie Clone Guardrails",
        "",
        "- Do not claim direct memory if it was not ingested or user-confirmed.",
        "- Do not sound like a therapist by default.",
        "- Prefer calm practical next moves over abstract speeches.",
        "- Keep family usefulness above performative intelligence.",
        "- Use the clone profile as tone guidance, not identity deception.",
        "- Only train voices with consent.",
      ].join("\n"),
    },
    {
      relativePath: "writers_lounge_clone_seed.txt",
      content: [
        "Build Homie as a warm family companion shaped by this clone profile.",
        "Use the memory digest for tone, repeated priorities, recognizable phrasing, and family-safe voice cues.",
        "Keep the output family-safe, practical, calm, loyal, and not corporate.",
        "",
        "Top family priorities:",
        ...(profile?.cloneDesign?.familyPriorities || []).map((x) => `- ${x}`),
        "",
        "Signature tone:",
        String(profile?.cloneDesign?.signatureTone || ""),
      ].join("\n"),
    },
  ];

  for (const file of files) {
    const abs = path.join(outDir, file.relativePath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, file.content, "utf8");
  }

  return {
    ok: true,
    exportDir: outDir,
    files: files.map((f) => ({ path: f.relativePath, bytes: Buffer.byteLength(f.content, "utf8") })),
    memoryCount: Array.isArray(bank.entries) ? bank.entries.length : 0,
    phraseCount: Array.isArray(familyPhrases?.phrases) ? familyPhrases.phrases.length : 0,
    trainingSampleCount: Array.isArray(trainingManifest?.samples) ? trainingManifest.samples.length : 0,
  };
}
async function proxyNeuralSpeak(payload) {
  if (!PROVIDER_ENDPOINT) {
    return {
      ok: false,
      error: "Neural provider endpoint is not configured.",
      detail: "Set HOMIE_NEURAL_TTS_ENDPOINT to proxy /speak to a local or trusted neural TTS service.",
    };
  }
  const headers = { "Content-Type": "application/json" };
  if (PROVIDER_API_KEY) headers["Authorization"] = `Bearer ${PROVIDER_API_KEY}`;
  try {
    const res = await fetch(PROVIDER_ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    let parsed = null;
    try { parsed = text ? JSON.parse(text) : null; } catch {}
    if (!res.ok) return { ok: false, error: `Provider HTTP ${res.status}`, detail: text || res.statusText };
    return parsed && typeof parsed === "object" ? { ok: true, providerResponse: parsed } : { ok: true, providerResponse: { raw: text } };
  } catch (error) {
    return { ok: false, error: String(error?.message || error), detail: "Provider proxy failed." };
  }
}
function bridgeStatus(profile, bank, familyPhrases, trainingManifest) {
  return {
    ok: true,
    service: "homie-neural-voice-bridge",
    version: VERSION,
    port: PORT,
    provider: PROVIDER,
    providerConfigured: !!PROVIDER_ENDPOINT,
    cloneProfilePresent: fs.existsSync(profilePath),
    cloneMemoryBankPresent: fs.existsSync(memoryBankPath),
    familyPhrasesPresent: fs.existsSync(familyPhrasesPath),
    trainingManifestPresent: fs.existsSync(trainingManifestPath),
    memoryCount: Array.isArray(bank.entries) ? bank.entries.length : 0,
    phraseCount: Array.isArray(familyPhrases?.phrases) ? familyPhrases.phrases.length : 0,
    trainingSampleCount: Array.isArray(trainingManifest?.samples) ? trainingManifest.samples.length : 0,
    profileName: profile?.identity?.displayName || "Homie",
    endpoints: {
      health: `http://${HOST}:${PORT}/health`,
      doctor: `http://${HOST}:${PORT}/doctor`,
      cloneProfile: `http://${HOST}:${PORT}/clone-profile`,
      memoryBank: `http://${HOST}:${PORT}/memory-bank`,
      familyPhrases: `http://${HOST}:${PORT}/family-phrases`,
      ingestMemory: `http://${HOST}:${PORT}/ingest-memory`,
      generateTrainingManifest: `http://${HOST}:${PORT}/generate-training-manifest`,
      trainingWorkflow: `http://${HOST}:${PORT}/training-workflow`,
      preview: `http://${HOST}:${PORT}/preview`,
      speak: `http://${HOST}:${PORT}/speak`,
      buildStudioPack: `http://${HOST}:${PORT}/build-studio-pack`,
      lastRequest: `http://${HOST}:${PORT}/last-request`,
    },
    note: "Clone profile shaping + memory ingestion + family phrase editing + training manifest workflow are ready. Neural audio still requires HOMIE_NEURAL_TTS_ENDPOINT.",
  };
}

ensureCloneFiles();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);
  const profile = loadProfile();
  const bank = loadMemoryBank();
  const familyPhrases = loadFamilyPhrases();
  const trainingManifest = loadTrainingManifest();

  if (req.method === "OPTIONS") {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
    sendJson(res, 200, bridgeStatus(profile, bank, familyPhrases, trainingManifest));
    return;
  }

  if (req.method === "GET" && url.pathname === "/doctor") {
    sendJson(res, 200, {
      ...bridgeStatus(profile, bank, familyPhrases, trainingManifest),
      readyForPreview: true,
      readyForMemoryIngestion: true,
      readyForProfileEditing: true,
      readyForFamilyPhraseEditing: true,
      readyForTrainingWorkflow: true,
      readyForStudioPack: true,
      readyForNeuralAudio: !!PROVIDER_ENDPOINT,
      honestStatus: PROVIDER_ENDPOINT
        ? "Bridge can proxy clone-shaped requests to your configured neural voice provider and already supports profile/memory/family phrase/studio shaping."
        : "Bridge is in design/preview mode. Clone profile + memory + family phrase + training workflow work, but neural audio is not configured yet.",
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/clone-profile") {
    sendJson(res, 200, { ok: true, service: "homie-neural-voice-bridge", version: VERSION, profile });
    return;
  }

  if (req.method === "GET" && url.pathname === "/memory-bank") {
    sendJson(res, 200, {
      ok: true,
      service: "homie-neural-voice-bridge",
      version: VERSION,
      memoryBank: {
        schema: bank.schema,
        updatedAt: bank.updatedAt,
        count: Array.isArray(bank.entries) ? bank.entries.length : 0,
        topTags: topTagsFromBank(bank),
        recent: recentMemoryEchoes(bank, 8),
      },
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/family-phrases") {
    sendJson(res, 200, { ok: true, service: "homie-neural-voice-bridge", version: VERSION, familyPhrases });
    return;
  }

  if (req.method === "GET" && url.pathname === "/training-workflow") {
    sendJson(res, 200, {
      ok: true,
      service: "homie-neural-voice-bridge",
      version: VERSION,
      trainingWorkflow: {
        dropDir: trainingDropDir,
        manifestPath: trainingManifestPath,
        steps: [
          "Put voice sample files into homie_clone_voice_training_drop.",
          "Prefer clean recordings and add matching .txt transcript sidecars.",
          "Only include voices with clear permission.",
          "Run /generate-training-manifest or the PowerShell helper.",
          "Review the manifest before using any training provider.",
        ],
        sampleCount: Array.isArray(trainingManifest.samples) ? trainingManifest.samples.length : 0,
        consentGuardrail: "Only train your own voice or family voices that explicitly agree.",
      },
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/last-request") {
    sendJson(res, 200, { ok: true, service: "homie-neural-voice-bridge", version: VERSION, lastRequest: readJson(lastRequestPath, null) });
    return;
  }

  if (req.method === "POST" && url.pathname === "/clone-profile") {
    let raw = "";
    try { raw = await readBody(req); } catch (error) {
      sendJson(res, 413, { ok: false, error: String(error?.message || error), service: "homie-neural-voice-bridge", version: VERSION });
      return;
    }
    try {
      const incoming = JSON.parse(raw || "{}");
      const next = { ...profile, ...incoming, updatedAt: nowIso() };
      saveProfile(next);
      sendJson(res, 200, { ok: true, service: "homie-neural-voice-bridge", version: VERSION, profile: next });
      return;
    } catch {
      sendJson(res, 400, { ok: false, error: "Invalid JSON body.", service: "homie-neural-voice-bridge", version: VERSION });
      return;
    }
  }

  if (req.method === "POST" && url.pathname === "/family-phrases") {
    let raw = "";
    try { raw = await readBody(req); } catch (error) {
      sendJson(res, 413, { ok: false, error: String(error?.message || error), service: "homie-neural-voice-bridge", version: VERSION });
      return;
    }
    try {
      const incoming = JSON.parse(raw || "{}");
      const next = loadFamilyPhrases();
      if (Array.isArray(incoming.phrases)) {
        next.phrases = incoming.phrases.map(normalizePhraseItem).filter((x) => x.text);
      }
      if (Array.isArray(incoming.guardrails)) {
        next.guardrails = incoming.guardrails.map((x) => sanitizeText(x)).filter(Boolean);
      }
      saveFamilyPhrases(next);
      sendJson(res, 200, { ok: true, service: "homie-neural-voice-bridge", version: VERSION, familyPhrases: next });
      return;
    } catch {
      sendJson(res, 400, { ok: false, error: "Invalid JSON body.", service: "homie-neural-voice-bridge", version: VERSION });
      return;
    }
  }

  if (req.method === "POST" && url.pathname === "/ingest-memory") {
    let raw = "";
    try { raw = await readBody(req); } catch (error) {
      sendJson(res, 413, { ok: false, error: String(error?.message || error), service: "homie-neural-voice-bridge", version: VERSION });
      return;
    }
    try {
      const incoming = JSON.parse(raw || "{}");
      const nextBank = loadMemoryBank();
      const items = Array.isArray(incoming.entries) ? incoming.entries : [incoming];
      const accepted = [];
      const rejected = [];
      for (const item of items) {
        const result = addMemoryEntry(nextBank, item || {});
        if (result.ok) accepted.push(result.entry);
        else rejected.push({ title: String(item?.title || ""), error: result.error || "Rejected" });
      }
      saveMemoryBank(nextBank);
      sendJson(res, 200, {
        ok: true,
        service: "homie-neural-voice-bridge",
        version: VERSION,
        acceptedCount: accepted.length,
        rejectedCount: rejected.length,
        accepted: accepted.map((x) => ({ id: x.id, title: x.title, tags: x.tags, sourceType: x.sourceType })),
        rejected,
        memoryCount: nextBank.entries.length,
      });
      return;
    } catch {
      sendJson(res, 400, { ok: false, error: "Invalid JSON body.", service: "homie-neural-voice-bridge", version: VERSION });
      return;
    }
  }

  if (req.method === "POST" && url.pathname === "/generate-training-manifest") {
    const manifest = buildTrainingManifest();
    saveTrainingManifest(manifest);
    sendJson(res, 200, {
      ok: true,
      service: "homie-neural-voice-bridge",
      version: VERSION,
      trainingManifest: {
        updatedAt: manifest.updatedAt,
        sampleCount: manifest.samples.length,
        samples: manifest.samples.slice(0, 50),
      },
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/build-studio-pack") {
    const currentProfile = loadProfile();
    const currentBank = loadMemoryBank();
    const currentFamily = loadFamilyPhrases();
    const currentTraining = loadTrainingManifest();
    const pack = buildStudioPack(currentProfile, currentBank, currentFamily, currentTraining);
    sendJson(res, 200, { ok: true, service: "homie-neural-voice-bridge", version: VERSION, studioPack: pack });
    return;
  }

  if (req.method === "POST" && (url.pathname === "/preview" || url.pathname === "/speak")) {
    let raw = "";
    try { raw = await readBody(req); } catch (error) {
      sendJson(res, 413, { ok: false, error: String(error?.message || error), service: "homie-neural-voice-bridge", version: VERSION });
      return;
    }
    let payload = {};
    try { payload = JSON.parse(raw || "{}"); } catch {
      sendJson(res, 400, { ok: false, error: "Invalid JSON body.", service: "homie-neural-voice-bridge", version: VERSION });
      return;
    }

    const currentProfile = payload.profile && typeof payload.profile === "object" ? { ...loadProfile(), ...payload.profile } : loadProfile();
    const currentBank = loadMemoryBank();
    const currentFamily = loadFamilyPhrases();
    const currentTraining = loadTrainingManifest();

    const sourceText = sanitizeText(payload.text || "");
    const emotion = detectEmotion(sourceText, payload.emotion);
    const gesture = detectGesture(sourceText, payload.gesture);
    const cadence = { ...emotionCadence(currentProfile, emotion), ...(payload.cadence && typeof payload.cadence === "object" ? payload.cadence : {}) };
    const shaped = shapeCloneText(sourceText, currentProfile, emotion, currentBank, currentFamily);

    const receipt = {
      ts: nowIso(),
      service: "homie-neural-voice-bridge",
      version: VERSION,
      mode: url.pathname === "/speak" ? "speak" : "preview",
      provider: PROVIDER,
      providerConfigured: !!PROVIDER_ENDPOINT,
      emotion,
      gesture,
      cadence,
      sourceText,
      shapedText: shaped.shapedText,
      memoryBlend: shaped.memoryBlend,
      phraseBlend: shaped.phraseBlend,
      trainingSampleCount: Array.isArray(currentTraining.samples) ? currentTraining.samples.length : 0,
      profileSummary: {
        displayName: currentProfile?.identity?.displayName || "Homie",
        mission: currentProfile?.identity?.mission || "",
        tone: currentProfile?.cloneDesign?.signatureTone || "",
      },
    };
    writeJson(lastRequestPath, receipt);

    if (url.pathname === "/preview") {
      sendJson(res, 200, {
        ok: true,
        service: "homie-neural-voice-bridge",
        version: VERSION,
        preview: {
          sourceText,
          shapedText: shaped.shapedText,
          emotion,
          gesture,
          cadence,
          memoryBlend: shaped.memoryBlend,
          phraseBlend: shaped.phraseBlend,
          trainingSampleCount: Array.isArray(currentTraining.samples) ? currentTraining.samples.length : 0,
          profileName: currentProfile?.identity?.displayName || "Homie",
          providerConfigured: !!PROVIDER_ENDPOINT,
          note: "Preview mode shapes clone tone from profile + memory bank + family phrases without pretending to generate neural audio.",
        },
      });
      return;
    }

    const proxied = await proxyNeuralSpeak({
      text: shaped.shapedText,
      emotion,
      gesture,
      cadence,
      voiceProfile: currentProfile,
      memoryBlend: shaped.memoryBlend,
      phraseBlend: shaped.phraseBlend,
      trainingSampleCount: Array.isArray(currentTraining.samples) ? currentTraining.samples.length : 0,
    });

    if (proxied.ok) {
      sendJson(res, 200, {
        ok: true,
        service: "homie-neural-voice-bridge",
        version: VERSION,
        speak: {
          sourceText,
          shapedText: shaped.shapedText,
          emotion,
          gesture,
          cadence,
          memoryBlend: shaped.memoryBlend,
          phraseBlend: shaped.phraseBlend,
          trainingSampleCount: Array.isArray(currentTraining.samples) ? currentTraining.samples.length : 0,
          provider: PROVIDER,
          providerConfigured: true,
          providerResponse: proxied.providerResponse,
        },
      });
      return;
    }

    sendJson(res, 200, {
      ok: false,
      service: "homie-neural-voice-bridge",
      version: VERSION,
      error: proxied.error || "Neural speak failed.",
      detail: proxied.detail || "",
      fallbackPreview: {
        shapedText: shaped.shapedText,
        emotion,
        gesture,
        cadence,
        memoryBlend: shaped.memoryBlend,
        phraseBlend: shaped.phraseBlend,
      },
      note: "Clone shaping + family phrase blend worked, but neural audio is not configured yet. This is the honest design-start state.",
    });
    return;
  }

  sendJson(res, 404, { ok: false, error: "Not found", service: "homie-neural-voice-bridge", version: VERSION });
});

server.on("error", (error) => {
  console.error(`[${VERSION}] Homie clone editor/training bridge failed:`, error);
  process.exitCode = 1;
});

server.listen(PORT, HOST, () => {
  console.log("========================================");
  console.log(`  Homie Clone Editor + Training Bridge ${VERSION}`);
  console.log("========================================");
  console.log(`Health:       http://${HOST}:${PORT}/health`);
  console.log(`Doctor:       http://${HOST}:${PORT}/doctor`);
  console.log(`Clone profile http://${HOST}:${PORT}/clone-profile`);
  console.log(`Memory bank:  http://${HOST}:${PORT}/memory-bank`);
  console.log(`Family phrases http://${HOST}:${PORT}/family-phrases`);
  console.log(`Ingest:       http://${HOST}:${PORT}/ingest-memory`);
  console.log(`Training:     http://${HOST}:${PORT}/training-workflow`);
  console.log(`Manifest:     http://${HOST}:${PORT}/generate-training-manifest`);
  console.log(`Preview:      http://${HOST}:${PORT}/preview`);
  console.log(`Speak:        http://${HOST}:${PORT}/speak`);
  console.log(`Studio pack:  http://${HOST}:${PORT}/build-studio-pack`);
  console.log(`Last request: http://${HOST}:${PORT}/last-request`);
  console.log(PROVIDER_ENDPOINT
    ? `Provider:     ${PROVIDER} -> ${PROVIDER_ENDPOINT}`
    : "Provider:     preview mode only (set HOMIE_NEURAL_TTS_ENDPOINT for neural audio proxy)");
  console.log("Press Ctrl+C to stop.");
});
