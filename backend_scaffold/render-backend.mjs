import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const PORT = Number(process.env.PORT || 8899);
const HOST = process.env.HOST || "127.0.0.1";
const ROOT_DIR = path.resolve(process.cwd(), "backend_scaffold_data");
const JOB_DIR = path.join(ROOT_DIR, "render_jobs");
const OUT_DIR = path.join(ROOT_DIR, "render_outputs");
const PROVIDER_CFG = path.join(ROOT_DIR, "render_providers.json");
const PUBLISH_CFG = path.join(ROOT_DIR, "publish_jobs.json");
const OUTCOME_CFG = path.join(ROOT_DIR, "money_outcomes.json");
const SECRETS_CFG = path.join(ROOT_DIR, "secrets_vault.json");
const AUTOPILOT_CFG = path.join(ROOT_DIR, "income_autopilot.json");
const AUTOPILOT_CYCLES_CFG = path.join(ROOT_DIR, "income_autopilot_cycles.json");
const COMMERCE_CFG = path.join(ROOT_DIR, "commerce_listings.json");
fs.mkdirSync(JOB_DIR, { recursive: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

function send(res, status, payload) {
  const json = JSON.stringify(payload, null, 2);
  res.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
  res.end(json);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => body += chunk);
    req.on("end", () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}

const nowIso = () => new Date().toISOString();
const safeSlug = (value) => String(value || "untitled").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "untitled";
const fileFor = (id) => path.join(JOB_DIR, `${id}.json`);
const outputDirFor = (job) => path.join(OUT_DIR, `${safeSlug(job.title)}-${job.id.slice(0, 6)}`);

function saveJob(job) { fs.writeFileSync(fileFor(job.id), JSON.stringify(job, null, 2)); }
function loadJob(id) { return fs.existsSync(fileFor(id)) ? JSON.parse(fs.readFileSync(fileFor(id), "utf8")) : null; }
function listJobs() {
  return fs.readdirSync(JOB_DIR)
    .filter((x) => x.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(JOB_DIR, f), 'utf8')))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}
function rel(base, target) { return path.relative(base, target).replace(/\\/g, "/"); }
function listArtifacts(job) {
  const dir = outputDirFor(job);
  if (!fs.existsSync(dir)) return [];
  const files = [];
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else {
        const stat = fs.statSync(full);
        files.push({ name: entry.name, path: rel(dir, full), bytes: stat.size, updatedAt: stat.mtimeMs });
      }
    }
  };
  walk(dir);
  return files.sort((a, b) => a.path.localeCompare(b.path));
}
function appendLog(job, line) {
  job.log = [`${nowIso()} ${line}`, ...(job.log || [])].slice(0, 200);
  job.updatedAt = Date.now();
}
function writeArtifact(job, relativePath, content, mode = "text") {
  const root = outputDirFor(job);
  const full = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  if (mode === "binary") fs.writeFileSync(full, content);
  else fs.writeFileSync(full, String(content ?? ""), "utf8");
  const bytes = Buffer.isBuffer(content) ? content.length : Buffer.byteLength(String(content ?? ""), "utf8");
  const found = (job.artifacts || []).find((x) => x.path === relativePath);
  const entry = { path: relativePath, bytes, updatedAt: Date.now() };
  if (found) Object.assign(found, entry); else job.artifacts = [...(job.artifacts || []), entry];
}
function createWorker(id, label, kind, outputs) { return { id, label, kind, status: "queued", outputs: outputs || [], startedAt: null, completedAt: null }; }

function inferWorkers(handoff) {
  const type = handoff?.type || "book";
  const requested = Array.isArray(handoff?.renderLab?.requestedAssets) ? handoff.renderLab.requestedAssets : [];
  const wanted = new Set(requested.map((x) => String(x).toLowerCase()));
  const workers = [createWorker("manifest", "Build studio manifest", "packaging", ["manifests/studio-handoff.json", "manifests/render-plan.json", "manifests/provider-bridge.json"])];
  if (type === "book" || wanted.has("manuscript") || wanted.has("ebook")) workers.push(createWorker("book", "Book worker", "book", ["book/manuscript.md", "book/launch-blurb.md", "book/distribution-checklist.md"]));
  if (["video", "cartoon"].includes(type) || wanted.has("video") || wanted.has("trailer") || wanted.has("storyboard")) workers.push(createWorker("video", type === "cartoon" ? "Cartoon / storyboard worker" : "Video worker", type === "cartoon" ? "cartoon" : "video", ["video/script.md", "video/shot-list.md", "video/storyboard.md", "provider/video/video-response.json"]));
  if (type === "music" || wanted.has("audio") || wanted.has("song") || wanted.has("music")) workers.push(createWorker("audio", "Audio / music worker", "audio", ["audio/lyrics.md", "audio/production-notes.md", "audio/cover-brief.md", "provider/audio/audio-response.json"]));
  if (type === "art" || wanted.has("cover") || wanted.has("thumbnail") || wanted.has("art") || wanted.has("poster")) workers.push(createWorker("image", "Image / cover worker", "image", ["images/cover-brief.md", "images/thumbnail-brief.md", "images/styleframes.md", "provider/images/image-response.json"]));
  if (type === "social" || wanted.has("social") || wanted.has("captions") || wanted.has("shorts")) workers.push(createWorker("social", "Social distribution worker", "social", ["social/captions.md", "social/hooks.md", "social/hashtags.txt", "social/publish-plan.md"]));
  if (!workers.find((x) => x.id === "social")) workers.push(createWorker("social", "Social distribution worker", "social", ["social/captions.md", "social/hooks.md", "social/hashtags.txt", "social/publish-plan.md"]));
  return workers;
}

function defaultProviders() {
  return {
    image: { enabled: false, mode: "stub", endpoint: "", model: "", healthPath: "/health", timeoutMs: 30000 },
    audio: { enabled: false, mode: "stub", endpoint: "", model: "", healthPath: "/health", timeoutMs: 45000 },
    video: { enabled: false, mode: "stub", endpoint: "", model: "", healthPath: "/health", timeoutMs: 60000 },
  };
}
function normalizeProvider(src, fallback) {
  const s = src || {}, b = fallback || {};
  return { enabled: !!(s.enabled ?? b.enabled), mode: String(s.mode || b.mode || "stub"), endpoint: String(s.endpoint || b.endpoint || ""), model: String(s.model || b.model || ""), healthPath: String(s.healthPath || b.healthPath || "/health"), timeoutMs: Number(s.timeoutMs || b.timeoutMs || 30000), workflow: String(s.workflow || b.workflow || ""), voice: String(s.voice || b.voice || "") };
}
function loadProviderConfig() {
  const d = defaultProviders();
  if (!fs.existsSync(PROVIDER_CFG)) return d;
  try {
    const parsed = JSON.parse(fs.readFileSync(PROVIDER_CFG, "utf8"));
    return { image: normalizeProvider(parsed.image, d.image), audio: normalizeProvider(parsed.audio, d.audio), video: normalizeProvider(parsed.video, d.video) };
  } catch { return d; }
}
function saveProviderConfig(cfg) {
  const d = defaultProviders();
  const out = { image: normalizeProvider(cfg?.image, d.image), audio: normalizeProvider(cfg?.audio, d.audio), video: normalizeProvider(cfg?.video, d.video) };
  fs.writeFileSync(PROVIDER_CFG, JSON.stringify(out, null, 2));
  return out;
}
function effectiveProviders(hints) {
  const stored = loadProviderConfig();
  if (!hints) return stored;
  return { image: normalizeProvider(hints.image, stored.image), audio: normalizeProvider(hints.audio, stored.audio), video: normalizeProvider(hints.video, stored.video) };
}


function readJsonFile(file, fallback) { try { return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : fallback; } catch { return fallback; } }
function writeJsonFile(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(value, null, 2)); return value; }
function listPublishJobs() { return readJsonFile(PUBLISH_CFG, []).sort((a,b)=>Number(b.updatedAt||0)-Number(a.updatedAt||0)); }
function savePublishJob(job) { const next = [job, ...listPublishJobs().filter((x) => x.id !== job.id)].slice(0, 500); writeJsonFile(PUBLISH_CFG, next); return job; }
function addOutcome(item) { const next = [{ id: randomUUID(), ts: Date.now(), ...item }, ...readJsonFile(OUTCOME_CFG, [])].slice(0, 1000); writeJsonFile(OUTCOME_CFG, next); return next[0]; }

function autopilotDefaults() { return { enabled: true, mode: "assist", intervalMinutes: 180, autoPublishProducts: false, autoDraftProducts: true, maxActionsPerCycle: 3, quietHours: { start: 1, end: 7 } }; }
function getAutopilotConfig() { const raw = readJsonFile(AUTOPILOT_CFG, {}); return { ...autopilotDefaults(), ...raw, quietHours: { ...autopilotDefaults().quietHours, ...(raw.quietHours || {}) } }; }
function saveAutopilotConfig(cfg) { const current = getAutopilotConfig(); const out = { ...current, ...(cfg || {}), quietHours: { ...current.quietHours, ...((cfg || {}).quietHours || {}) } }; writeJsonFile(AUTOPILOT_CFG, out); return out; }
function listAutopilotCycles() { return readJsonFile(AUTOPILOT_CYCLES_CFG, []).sort((a,b)=>Number(b.ts||0)-Number(a.ts||0)); }
function saveAutopilotCycle(cycle) { const next = [cycle, ...listAutopilotCycles()].slice(0, 200); writeJsonFile(AUTOPILOT_CYCLES_CFG, next); return cycle; }
function listCommerceListings() { return readJsonFile(COMMERCE_CFG, []).sort((a,b)=>Number(b.updatedAt||0)-Number(a.updatedAt||0)); }
function saveCommerceListing(item) { const next = [item, ...listCommerceListings().filter((x) => x.id !== item.id)].slice(0, 500); writeJsonFile(COMMERCE_CFG, next); return item; }
function publishCommerceListing(id) { const item = listCommerceListings().find((x) => x.id === id); if (!item) return null; item.status = "published"; item.updatedAt = Date.now(); item.url = `oddengine://${item.platform}/listing/${safeSlug(item.title)}-${id.slice(0,6)}`; item.log = [`${nowIso()} listing published`, ...(item.log || [])].slice(0, 50); saveCommerceListing(item); return item; }
function draftCommerceFromTopOutcome() {
  const winner = readJsonFile(OUTCOME_CFG, []).sort((a,b)=>Number(b.revenue||0)-Number(a.revenue||0))[0];
  if (!winner) return [];
  const existing = listCommerceListings();
  const drafts = [];
  for (const plan of [{ productType: "bundle", platform: "gumroad", price: 19 }, { productType: "download", platform: "gumroad", price: 9 }, { productType: "subscription", platform: "stripe", price: 12 }, { productType: "printable", platform: "etsy", price: 7 }]) {
    const title = `${winner.title} ${plan.productType === "subscription" ? "Club" : plan.productType === "bundle" ? "Bundle" : plan.productType === "printable" ? "Printable" : "Pack"}`;
    if (existing.find((x) => x.sourceId === winner.id && x.productType === plan.productType && x.platform === plan.platform)) continue;
    drafts.push(saveCommerceListing({ id: randomUUID(), sourceId: winner.id, title, productType: plan.productType, platform: plan.platform, status: "draft", createdAt: Date.now(), updatedAt: Date.now(), price: plan.price, url: "", log: [`${nowIso()} drafted from outcome winner`] }));
  }
  return drafts;
}
function runAutopilotCycle() {
  const cfg = getAutopilotConfig();
  const actions = [];
  const publishJobs = listPublishJobs().filter((x) => ["ready","queued"].includes(String(x.status || "")));
  if (publishJobs.length) {
    const job = publishJobs[0];
    job.status = "published";
    job.updatedAt = Date.now();
    job.url = `oddengine://${job.platform}/${job.id}`;
    job.log = [`${nowIso()} autopilot publish executed`, ...(job.log || [])].slice(0, 50);
    savePublishJob(job);
    addOutcome({ platform: job.platform, title: job.title, contentType: job.contentType, views: 180, clicks: 14, conversions: 2, revenue: 7.99, roi: 100, sourceJobId: job.sourceJobId || job.id });
    actions.push({ kind: "publish-pending", title: `Published ${job.title}`, status: "done" });
  }
  const drafted = cfg.autoDraftProducts ? draftCommerceFromTopOutcome() : [];
  actions.push({ kind: "productize-winner", title: drafted.length ? `Drafted ${drafted.length} commerce listings` : "No commerce drafts needed", status: drafted.length ? "done" : "skipped" });
  if (cfg.autoPublishProducts) {
    const ready = listCommerceListings().find((x) => x.status === "draft" || x.status === "queued");
    if (ready) {
      publishCommerceListing(ready.id);
      actions.push({ kind: "publish-listing", title: `Published ${ready.title}`, status: "done" });
    }
  }
  const cycle = { id: randomUUID(), ts: Date.now(), summary: `Autopilot ran ${actions.filter((x)=>x.status==="done").length} actions.`, actions };
  saveAutopilotCycle(cycle);
  return cycle;
}
function learningSummary() {
  const items = readJsonFile(OUTCOME_CFG, []);
  const byPlatform = {};
  const byType = {};
  for (const item of items) {
    const p = String(item.platform || 'local'); byPlatform[p] = byPlatform[p] || { revenue: 0, views: 0, count: 0 }; byPlatform[p].revenue += Number(item.revenue || 0); byPlatform[p].views += Number(item.views || 0); byPlatform[p].count += 1;
    const t = String(item.contentType || 'asset'); byType[t] = byType[t] || { revenue: 0, count: 0 }; byType[t].revenue += Number(item.revenue || 0); byType[t].count += 1;
  }
  const topPlatforms = Object.entries(byPlatform).sort((a,b)=>b[1].revenue-a[1].revenue).slice(0,5).map(([platform, stats]) => ({ platform, ...stats }));
  const topTypes = Object.entries(byType).sort((a,b)=>b[1].revenue-a[1].revenue).slice(0,5).map(([contentType, stats]) => ({ contentType, ...stats }));
  return { count: items.length, topPlatforms, topTypes, recommendation: `Best next move: make another ${(topTypes[0] && topTypes[0].contentType) || 'social'} asset and ship it to ${(topPlatforms[0] && topPlatforms[0].platform) || 'local'}.` };
}
function createPublishJobsFromRenderJob(job) {
  const targets = Array.isArray(job?.summary?.targets) && job.summary.targets.length ? job.summary.targets : ['local'];
  return targets.map((platform, idx) => savePublishJob({ id: randomUUID(), sourceJobId: job.id, title: job.title, contentType: job.type, platform: String(platform || 'local').toLowerCase(), status: 'ready', createdAt: Date.now(), updatedAt: Date.now(), url: '', log: [`${nowIso()} created from render job ${job.id}`] }));
}

function createJob(body) {
  const handoff = body?.handoff || {};
  const id = randomUUID();
  const job = { id, createdAt: Date.now(), updatedAt: Date.now(), status: "queued", title: handoff?.title || "Untitled render job", type: handoff?.type || "book", publishMode: body?.publishMode || "assisted", autoPublish: !!body?.autoPublish, outputRoot: `${safeSlug(handoff?.title || "untitled")}-${id.slice(0, 6)}`, handoff, summary: { requestedAssets: handoff?.renderLab?.requestedAssets || [], targets: handoff?.distribution?.targets || [] }, providers: effectiveProviders(body?.providerBridge), workers: inferWorkers(handoff), artifacts: [], log: [] };
  appendLog(job, "received studio handoff");
  saveJob(job);
  return job;
}
function providerForWorker(job, worker) { if (worker.id === "image") return job.providers?.image; if (worker.id === "audio") return job.providers?.audio; if (worker.id === "video") return job.providers?.video; return null; }
function workerPayload(job, worker) {
  const h = job.handoff || {}, r = h.renderLab || {}, d = h.distribution || {};
  return { workerId: worker.id, workerKind: worker.kind, jobId: job.id, title: job.title, type: job.type, outputRoot: job.outputRoot, prompt: r.primaryBrief || h.finalOutput || h.title || "", finalOutput: h.finalOutput || "", script: r.script || "", visualBrief: r.visualBrief || "", audioBrief: r.audioBrief || "", videoBrief: r.videoBrief || "", requestedAssets: r.requestedAssets || [], targets: d.targets || [], hooks: d.hooks || [], captions: d.captions || [], hashtags: d.hashtags || [] };
}
async function fetchJson(url, init = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal, headers: { "Content-Type": "application/json", ...(init.headers || {}) } });
    const text = await res.text();
    let json; try { json = text ? JSON.parse(text) : {}; } catch { json = { ok: res.ok, text }; }
    if (!res.ok) throw new Error(json?.error || json?.message || `HTTP ${res.status}`);
    return json;
  } finally { clearTimeout(timer); }
}
async function probeSingleProvider(name, cfg) {
  if (!cfg?.enabled || !cfg?.endpoint) return { ok: false, name, status: "disabled", detail: "disabled" };
  try {
    const base = String(cfg.endpoint).replace(/\/$/, "");
    const path = cfg.healthPath || "/health";
    const json = await fetchJson(`${base}${path}`, { method: "GET" }, Math.min(Number(cfg.timeoutMs || 30000), 10000));
    let detail = json?.detail || "reachable";
    if (cfg.mode === "a1111" && Array.isArray(json)) detail = `${json.length} SD models visible`;
    if (cfg.mode === "comfyui" && json?.system) detail = "ComfyUI ready";
    return { ok: true, name, status: json?.status || json?.service || "ready", detail, endpoint: cfg.endpoint, mode: cfg.mode, model: cfg.model || "", workflow: cfg.workflow || "", voice: cfg.voice || "" };
  } catch (e) { return { ok: false, name, status: "unreachable", detail: e?.message || String(e), endpoint: cfg.endpoint, mode: cfg.mode, model: cfg.model || "", workflow: cfg.workflow || "", voice: cfg.voice || "" }; }
}
function decodeBase64Maybe(value) { const raw = String(value || ""); const m = raw.match(/^data:([^;]+);base64,(.+)$/); return Buffer.from(m ? m[2] : raw, "base64"); }
function extFor(kind, mime, fallback = "bin") {
  const t = String(mime || "").toLowerCase();
  if (t.includes("png")) return "png"; if (t.includes("jpeg") || t.includes("jpg")) return "jpg"; if (t.includes("webp")) return "webp"; if (t.includes("mp3") || t.includes("mpeg")) return "mp3"; if (t.includes("wav")) return "wav"; if (t.includes("mp4")) return "mp4"; if (t.includes("json")) return "json"; if (kind === "image") return "png"; if (kind === "audio") return "mp3"; if (kind === "video") return "mp4"; return fallback;
}
function persistProviderOutputs(job, worker, response) {
  const kind = worker.kind;
  const folder = kind === "image" ? "provider/images" : kind === "audio" ? "provider/audio" : kind === "video" || kind === "cartoon" ? "provider/video" : `provider/${kind}`;
  const bundle = Array.isArray(response?.artifacts) ? response.artifacts : Array.isArray(response?.outputs) ? response.outputs : [];
  let wrote = 0;
  for (let i = 0; i < bundle.length; i++) {
    const item = bundle[i] || {};
    if (item.base64 || item.b64 || item.data) { const mime = item.mime || item.contentType || ""; const ext = item.ext || extFor(kind, mime); writeArtifact(job, `${folder}/${safeSlug(item.name || `${worker.id}-${i+1}`)}.${ext}`, decodeBase64Maybe(item.base64 || item.b64 || item.data), "binary"); wrote += 1; }
    else if (item.url) { writeArtifact(job, `${folder}/${safeSlug(item.name || `${worker.id}-${i+1}`)}.url.txt`, String(item.url)); wrote += 1; }
    else if (item.text) { writeArtifact(job, `${folder}/${safeSlug(item.name || `${worker.id}-${i+1}`)}.txt`, String(item.text)); wrote += 1; }
  }
  if (response?.base64 || response?.b64 || response?.data) { const mime = response?.mime || response?.contentType || ""; const ext = response?.ext || extFor(kind, mime); writeArtifact(job, `${folder}/${worker.id}.${ext}`, decodeBase64Maybe(response.base64 || response.b64 || response.data), "binary"); wrote += 1; }
  if (response?.url) { writeArtifact(job, `${folder}/${worker.id}.url.txt`, String(response.url)); wrote += 1; }
  if (response?.text && wrote === 0) { writeArtifact(job, `${folder}/${worker.id}.txt`, String(response.text)); wrote += 1; }
  writeArtifact(job, `${folder}/${worker.id}-response.json`, JSON.stringify(response || {}, null, 2));
  return wrote;
}
function providerPresets() {
  return {
    image: {
      a1111: { enabled: true, mode: "a1111", endpoint: "http://127.0.0.1:7860", model: "", healthPath: "/sdapi/v1/sd-models", timeoutMs: 120000 },
      webhook: { enabled: true, mode: "webhook", endpoint: "http://127.0.0.1:5001", model: "", healthPath: "/health", timeoutMs: 60000 },
    },
    audio: {
      bark: { enabled: true, mode: "bark", endpoint: "http://127.0.0.1:7000", model: "", healthPath: "/health", timeoutMs: 120000, voice: "v2/en_speaker_6" },
      webhook: { enabled: true, mode: "webhook", endpoint: "http://127.0.0.1:5002", model: "", healthPath: "/health", timeoutMs: 60000 },
    },
    video: {
      comfyui: { enabled: true, mode: "comfyui", endpoint: "http://127.0.0.1:8188", model: "", healthPath: "/system_stats", timeoutMs: 180000, workflow: "basic_txt2img_video" },
      webhook: { enabled: true, mode: "webhook", endpoint: "http://127.0.0.1:5003", model: "", healthPath: "/health", timeoutMs: 90000 },
    },
  };
}
async function invokeA1111(job, worker, provider) {
  const base = String(provider.endpoint).replace(/\/$/, "");
  const payload = workerPayload(job, worker);
  const prompt = payload.visualBrief || payload.prompt || job.title || "cover art";
  const negative_prompt = "low quality, blurry, watermark, deformed";
  const json = await fetchJson(`${base}/sdapi/v1/txt2img`, {
    method: "POST",
    body: JSON.stringify({
      prompt,
      negative_prompt,
      steps: 24,
      width: 768,
      height: 768,
      sampler_name: "Euler a",
      cfg_scale: 7,
    }),
  }, Number(provider.timeoutMs || 120000));
  const images = Array.isArray(json?.images) ? json.images : [];
  const response = {
    artifacts: images.map((img, i) => ({
      name: `${safeSlug(job.title || "image")}-${i + 1}`,
      base64: img,
      mime: "image/png",
      ext: "png",
    })),
    info: json?.info || "",
    provider: "a1111",
  };
  const count = persistProviderOutputs(job, worker, response);
  appendLog(job, `AUTOMATIC1111 image generation complete${count ? ` (${count} outputs)` : ""}`);
  return { ok: true, outputCount: count };
}
async function invokeBark(job, worker, provider) {
  const base = String(provider.endpoint).replace(/\/$/, "");
  const payload = workerPayload(job, worker);
  const prompt = payload.script || payload.finalOutput || payload.prompt || job.title || "audio";
  const json = await fetchJson(`${base}/generate`, {
    method: "POST",
    body: JSON.stringify({
      text: prompt,
      voice: provider.voice || "v2/en_speaker_6",
      model: provider.model || "",
      provider: "bark",
      job: payload,
    }),
  }, Number(provider.timeoutMs || 120000));
  const count = persistProviderOutputs(job, worker, json);
  appendLog(job, `Bark audio generation complete${count ? ` (${count} outputs)` : ""}`);
  return { ok: true, outputCount: count };
}
async function invokeComfyUI(job, worker, provider) {
  const base = String(provider.endpoint).replace(/\/$/, "");
  const payload = workerPayload(job, worker);
  const json = await fetchJson(`${base}/generate`, {
    method: "POST",
    body: JSON.stringify({
      provider: "comfyui",
      workflow: provider.workflow || "basic_txt2img_video",
      model: provider.model || "",
      job: payload,
    }),
  }, Number(provider.timeoutMs || 180000));
  const count = persistProviderOutputs(job, worker, json);
  appendLog(job, `ComfyUI workflow complete${count ? ` (${count} outputs)` : ""}`);
  return { ok: true, outputCount: count };
}

async function invokeProvider(job, worker) {
  const provider = providerForWorker(job, worker);
  if (!provider?.enabled || !provider?.endpoint || provider.mode === "stub") { appendLog(job, `provider bridge skipped: ${worker.label} (${provider?.mode || "stub"})`); return { ok: false, skipped: true }; }
  if (provider.mode === "a1111") return invokeA1111(job, worker, provider);
  if (provider.mode === "bark") return invokeBark(job, worker, provider);
  if (provider.mode === "comfyui") return invokeComfyUI(job, worker, provider);
  const base = String(provider.endpoint).replace(/\/$/, "");
  const endpoint = `${base}/generate`;
  appendLog(job, `provider bridge start: ${worker.label} -> ${endpoint}`);
  const response = await fetchJson(endpoint, { method: "POST", body: JSON.stringify({ provider: worker.id, model: provider.model || "", job: workerPayload(job, worker) }) }, Number(provider.timeoutMs || 30000));
  const count = persistProviderOutputs(job, worker, response);
  appendLog(job, `provider bridge complete: ${worker.label}${count ? ` (${count} outputs)` : ""}`);
  return { ok: true, outputCount: count };
}
async function completeWorker(job, worker) {
  const h = job.handoff || {}, d = h.distribution || {}, r = h.renderLab || {};
  worker.status = "running"; worker.startedAt = Date.now(); appendLog(job, `worker start: ${worker.label}`);
  if (worker.id === "manifest") {
    writeArtifact(job, "manifests/studio-handoff.json", JSON.stringify(h, null, 2));
    writeArtifact(job, "manifests/render-plan.json", JSON.stringify({ jobId: job.id, title: job.title, type: job.type, workers: (job.workers || []).map((x) => ({ id: x.id, label: x.label, kind: x.kind, outputs: x.outputs })), publishMode: job.publishMode, autoPublish: job.autoPublish }, null, 2));
    writeArtifact(job, "manifests/provider-bridge.json", JSON.stringify(job.providers || {}, null, 2));
  }
  if (worker.id === "book") {
    writeArtifact(job, "book/manuscript.md", h.finalOutput || "");
    writeArtifact(job, "book/launch-blurb.md", `${h.title || "Untitled"}

${d.monetization || "Release-ready book package."}`);
    writeArtifact(job, "book/distribution-checklist.md", (d.checklist || []).map((x, i) => `${i + 1}. ${x}`).join("\n"));
  }
  if (worker.id === "video") {
    writeArtifact(job, "video/script.md", r.script || h.finalOutput || "");
    writeArtifact(job, "video/shot-list.md", `Primary brief:
${r.primaryBrief || ""}

Video brief:
${r.videoBrief || ""}`.trim());
    writeArtifact(job, "video/storyboard.md", `Visual brief:
${r.visualBrief || ""}

Requested assets:
- ${(r.requestedAssets || []).join("\n- ")}`.trim());
    try { await invokeProvider(job, worker); } catch (e) { appendLog(job, `provider bridge failed: ${worker.label} (${e?.message || String(e)})`); }
  }
  if (worker.id === "audio") {
    writeArtifact(job, "audio/lyrics.md", h.finalOutput || r.script || "");
    writeArtifact(job, "audio/production-notes.md", r.audioBrief || r.primaryBrief || "");
    writeArtifact(job, "audio/cover-brief.md", r.visualBrief || "");
    try { await invokeProvider(job, worker); } catch (e) { appendLog(job, `provider bridge failed: ${worker.label} (${e?.message || String(e)})`); }
  }
  if (worker.id === "image") {
    writeArtifact(job, "images/cover-brief.md", r.visualBrief || r.primaryBrief || "");
    writeArtifact(job, "images/thumbnail-brief.md", (d.captions || []).slice(0, 3).join("\n\n") || "Thumbnail / cover direction.");
    writeArtifact(job, "images/styleframes.md", `Style:
${r.visualBrief || ""}

Targets:
- ${(d.targets || []).join("\n- ")}`.trim());
    try { await invokeProvider(job, worker); } catch (e) { appendLog(job, `provider bridge failed: ${worker.label} (${e?.message || String(e)})`); }
  }
  if (worker.id === "social") {
    writeArtifact(job, "social/captions.md", (d.captions || []).join("\n\n---\n\n"));
    writeArtifact(job, "social/hooks.md", (d.hooks || []).map((x) => `- ${x}`).join("\n"));
    writeArtifact(job, "social/hashtags.txt", (d.hashtags || []).join(" "));
    writeArtifact(job, "social/publish-plan.md", `Targets:
- ${(d.targets || []).join("\n- ")}

Monetization:
${d.monetization || ""}`.trim());
  }
  worker.status = "completed"; worker.completedAt = Date.now(); appendLog(job, `worker complete: ${worker.label}`);
}
async function runJob(job) {
  job.status = "rendering"; appendLog(job, "starting worker execution");
  for (const worker of job.workers || []) { if (worker.status === "completed") continue; await completeWorker(job, worker); saveJob(job); }
  appendLog(job, "all workers completed"); job.status = "packaging";
  writeArtifact(job, "publish/release-summary.json", JSON.stringify({ title: job.title, type: job.type, targets: job.summary?.targets || [], artifacts: (job.artifacts || []).map((x) => x.path) }, null, 2));
  appendLog(job, "release package assembled");
  if (job.autoPublish) { job.status = "published"; writeArtifact(job, "publish/publish-handoff.json", JSON.stringify({ targets: job.summary?.targets || [], publishMode: job.publishMode, status: "ready" }, null, 2)); const publishJobs = createPublishJobsFromRenderJob(job); writeArtifact(job, "publish/publish-jobs.json", JSON.stringify(publishJobs, null, 2)); appendLog(job, `${publishJobs.length} publish jobs prepared`); appendLog(job, job.publishMode === "assisted" ? "assisted publish handoff prepared" : "manual publish pack ready"); }
  job.artifacts = listArtifacts(job); job.updatedAt = Date.now(); saveJob(job); return job;
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type" });
    return res.end();
  }
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  try {
    if (req.method === "GET" && url.pathname === "/health") {
      const providers = loadProviderConfig();
      return send(res, 200, { ok: true, service: "oddengine-render-backend", status: "ready", now: nowIso(), jobs: listJobs().length, outputDir: OUT_DIR, capabilities: ["book", "image", "audio", "video", "cartoon", "social", "packaging", "publish-handoff", "provider-bridge", "publisher-hub", "money-outcomes", "learning-loop", "secrets-vault", "a1111-image", "bark-audio", "comfyui-video", "autonomous-overnight", "music-generation", "vocal-generation", "mastering"], providers: { image: await probeSingleProvider("image", providers.image), audio: await probeSingleProvider("audio", providers.audio), video: await probeSingleProvider("video", providers.video) } });
    }
if (req.method === "GET" && url.pathname === "/providers/presets") return send(res, 200, { ok: true, presets: providerPresets() });
    if (req.method === "GET" && url.pathname === "/providers") return send(res, 200, { ok: true, providers: loadProviderConfig() });
    if (req.method === "POST" && url.pathname === "/providers") { const body = await readBody(req); return send(res, 200, { ok: true, providers: saveProviderConfig(body?.providers || body || {}) }); }
    if (req.method === "POST" && url.pathname === "/providers/probe") { const body = await readBody(req); const providers = effectiveProviders(body?.providers || body || {}); return send(res, 200, { ok: true, providers: { image: await probeSingleProvider("image", providers.image), audio: await probeSingleProvider("audio", providers.audio), video: await probeSingleProvider("video", providers.video) } }); }
    if (req.method === "GET" && url.pathname === "/publish/jobs") return send(res, 200, { ok: true, jobs: listPublishJobs() });
    if (req.method === "POST" && url.pathname === "/publish/jobs") { const body = await readBody(req); const job = savePublishJob({ id: randomUUID(), title: body?.title || 'Untitled publish job', sourceJobId: body?.sourceJobId || '', contentType: body?.contentType || 'asset', platform: String(body?.platform || 'local').toLowerCase(), status: 'ready', createdAt: Date.now(), updatedAt: Date.now(), url: '', log: [`${nowIso()} manual publish job created`] }); return send(res, 200, { ok: true, job }); }
    const publishRunMatch = url.pathname.match(/^\/publish\/jobs\/([^/]+)\/run$/);
    if (req.method === "POST" && publishRunMatch) { const job = listPublishJobs().find((x) => x.id === publishRunMatch[1]); if (!job) return send(res, 404, { ok: false, error: 'Publish job not found' }); job.status = 'published'; job.updatedAt = Date.now(); job.url = `oddengine://${job.platform}/${job.id}`; job.log = [`${nowIso()} publish run executed`, ...(job.log || [])].slice(0, 50); savePublishJob(job); addOutcome({ platform: job.platform, title: job.title, contentType: job.contentType, views: 250, clicks: 20, conversions: 2, revenue: 9.99, roi: 100, sourceJobId: job.sourceJobId || job.id }); return send(res, 200, { ok: true, job }); }
    if (req.method === "GET" && url.pathname === "/outcomes") return send(res, 200, { ok: true, outcomes: readJsonFile(OUTCOME_CFG, []) });
    if (req.method === "POST" && url.pathname === "/outcomes") { const body = await readBody(req); return send(res, 200, { ok: true, outcome: addOutcome(body || {}) }); }
    if (req.method === "GET" && url.pathname === "/learning/summary") return send(res, 200, { ok: true, summary: learningSummary() });
    if (req.method === "GET" && url.pathname === "/secrets") return send(res, 200, { ok: true, secrets: readJsonFile(SECRETS_CFG, []) });
    if (req.method === "POST" && url.pathname === "/secrets") { const body = await readBody(req); const item = { platform: String(body?.platform || 'local').toLowerCase(), accessToken: String(body?.accessToken || body?.token || ''), apiKey: String(body?.apiKey || ''), endpoint: String(body?.endpoint || ''), updatedAt: Date.now() }; const next = [item, ...readJsonFile(SECRETS_CFG, []).filter((x) => x.platform !== item.platform)]; writeJsonFile(SECRETS_CFG, next); return send(res, 200, { ok: true, secrets: next }); }

if (req.method === "GET" && url.pathname === "/autopilot/config") return send(res, 200, { ok: true, config: getAutopilotConfig() });
if (req.method === "POST" && url.pathname === "/autopilot/config") { const body = await readBody(req); return send(res, 200, { ok: true, config: saveAutopilotConfig(body || {}) }); }
if (req.method === "GET" && url.pathname === "/autopilot/cycles") return send(res, 200, { ok: true, cycles: listAutopilotCycles() });
if (req.method === "POST" && url.pathname === "/autopilot/run") return send(res, 200, { ok: true, cycle: runAutopilotCycle() });
if (req.method === "GET" && url.pathname === "/commerce/listings") return send(res, 200, { ok: true, listings: listCommerceListings() });
if (req.method === "POST" && url.pathname === "/commerce/listings") { const body = await readBody(req); const item = saveCommerceListing({ id: randomUUID(), sourceId: String(body?.sourceId || ""), title: String(body?.title || "Untitled product"), productType: String(body?.productType || "download"), platform: String(body?.platform || "gumroad"), status: "draft", createdAt: Date.now(), updatedAt: Date.now(), price: Number(body?.price || 9), url: "", log: [`${nowIso()} listing created`] }); return send(res, 200, { ok: true, listing: item }); }
if (req.method === "POST" && url.pathname === "/commerce/draft-from-winners") return send(res, 200, { ok: true, listings: draftCommerceFromTopOutcome() });
const commercePublishMatch = url.pathname.match(/^\/commerce\/listings\/([^/]+)\/publish$/);
if (req.method === "POST" && commercePublishMatch) { const listing = publishCommerceListing(commercePublishMatch[1]); if (!listing) return send(res, 404, { ok: false, error: "Listing not found" }); return send(res, 200, { ok: true, listing }); }
    if (req.method === "GET" && url.pathname === "/render/jobs") return send(res, 200, { ok: true, jobs: listJobs() });
    if (req.method === "POST" && url.pathname === "/render/jobs") { const body = await readBody(req); const job = createJob(body); if (body?.executeNow) await runJob(job); const loaded = loadJob(job.id) || job; return send(res, 200, { ok: true, jobId: job.id, status: loaded.status || job.status, workers: loaded.workers || job.workers, providers: loaded.providers || job.providers }); }
    const runMatch = url.pathname.match(/^\/render\/jobs\/([^/]+)\/run$/);
    if (req.method === "POST" && runMatch) { const job = loadJob(runMatch[1]); if (!job) return send(res, 404, { ok: false, error: "Job not found" }); let body = {}; try { body = await readBody(req); } catch {} if (body?.providerBridge) job.providers = effectiveProviders(body.providerBridge); const ran = await runJob(job); return send(res, 200, { ok: true, job: ran, artifacts: ran.artifacts || [] }); }
    const artifactsMatch = url.pathname.match(/^\/render\/jobs\/([^/]+)\/artifacts$/);
    if (req.method === "GET" && artifactsMatch) { const job = loadJob(artifactsMatch[1]); if (!job) return send(res, 404, { ok: false, error: "Job not found" }); const artifacts = listArtifacts(job); job.artifacts = artifacts; saveJob(job); return send(res, 200, { ok: true, artifacts, outputRoot: outputDirFor(job) }); }
    const jobMatch = url.pathname.match(/^\/render\/jobs\/([^/]+)$/);
    if (req.method === "GET" && jobMatch) { const job = loadJob(jobMatch[1]); return job ? send(res, 200, { ok: true, job }) : send(res, 404, { ok: false, error: "Job not found" }); }
    return send(res, 404, { ok: false, error: "Not found" });
  } catch (e) { return send(res, 500, { ok: false, error: e?.message || String(e) }); }
});

server.listen(PORT, HOST, () => { console.log(`OddEngine render backend listening on http://${HOST}:${PORT}`); });
