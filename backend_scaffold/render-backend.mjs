import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 8899);
const HOST = process.env.HOST || "127.0.0.1";
const DATA_DIR = path.join(__dirname, "data");
const JOBS_DIR = path.join(__dirname, "jobs");
const OUTPUTS_DIR = path.join(__dirname, "outputs");
const SEED_PATH = path.join(DATA_DIR, "render-job.seed.json");

for (const dir of [DATA_DIR, JOBS_DIR, OUTPUTS_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

function send(res, status, payload) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
  });
  res.end(JSON.stringify(payload, null, 2));
}

function notFound(res) {
  send(res, 404, { ok: false, error: "Not found" });
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 2_000_000) {
        reject(new Error("Body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function uid() {
  return `rj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function sanitizeName(value = "render") {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "render";
}

function jobPath(id) {
  return path.join(JOBS_DIR, `${id}.json`);
}

function writeJob(job) {
  job.updatedAt = Date.now();
  fs.writeFileSync(jobPath(job.id), JSON.stringify(job, null, 2));
  return job;
}

function readJob(id) {
  const p = jobPath(id);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function listJobs() {
  const files = fs.readdirSync(JOBS_DIR).filter((f) => f.endsWith(".json"));
  return files
    .map((f) => JSON.parse(fs.readFileSync(path.join(JOBS_DIR, f), "utf8")))
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
}

function placeholderExt(kind = "video") {
  if (kind === "audio") return ".mp3";
  if (kind === "image") return ".png";
  return ".mp4";
}

function buildPlaceholderOutput(job) {
  const ext = placeholderExt(job.kind);
  const filename = `${sanitizeName(job.title || job.id)}-${job.id}${ext}`;
  const outputPath = path.join(OUTPUTS_DIR, filename);
  const lines = [
    `OddEngine placeholder output`,
    `jobId=${job.id}`,
    `title=${job.title || "Untitled render"}`,
    `kind=${job.kind || "video"}`,
    `provider=${job.provider || "odd-local-placeholder"}`,
    `status=${job.status}`,
    `createdAt=${job.createdAt}`,
    `completedAt=${job.updatedAt}`,
    `prompt=${job.prompt || ""}`,
  ];
  fs.writeFileSync(outputPath, lines.join("\n"), "utf8");
  return outputPath;
}

function scheduleLifecycle(job) {
  setTimeout(() => {
    const current = readJob(job.id);
    if (!current || current.status !== "queued") return;
    current.status = "processing";
    current.progress = 0.5;
    current.worker = current.worker || { id: "local-placeholder-worker", name: "Local Placeholder Worker" };
    writeJob(current);
  }, 1200);

  setTimeout(() => {
    const current = readJob(job.id);
    if (!current || (current.status !== "queued" && current.status !== "processing")) return;
    current.status = "completed";
    current.progress = 1;
    current.outputPath = buildPlaceholderOutput(current);
    current.outputUrl = current.outputPath;
    writeJob(current);
  }, 2800);
}

function ensureSeed() {
  if (fs.existsSync(SEED_PATH)) return;
  const seed = {
    title: "FairlyOdd render seed",
    kind: "video",
    provider: "odd-local-placeholder",
    prompt: "Stylized teaser trailer placeholder output.",
    payload: {
      aspectRatio: "16:9",
      durationSec: 30,
      fps: 24,
      quality: "draft",
    },
  };
  fs.writeFileSync(SEED_PATH, JSON.stringify(seed, null, 2));
}

ensureSeed();

const providers = [
  {
    id: "odd-local-placeholder",
    name: "Odd Local Placeholder",
    status: "ready",
    capabilities: ["video", "audio", "image", "job-queue", "placeholder-output"],
  },
  {
    id: "external-worker-bridge",
    name: "External Worker Bridge",
    status: "stub",
    capabilities: ["future-worker-handoff", "provider-routing"],
  },
];

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || `${HOST}:${PORT}`}`);

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type",
    });
    res.end();
    return;
  }

  if (req.method === "GET" && url.pathname === "/health") {
    send(res, 200, {
      ok: true,
      service: "oddengine-render-backend",
      host: HOST,
      port: PORT,
      jobsDir: JOBS_DIR,
      outputsDir: OUTPUTS_DIR,
      providerCount: providers.length,
      jobCount: listJobs().length,
      time: new Date().toISOString(),
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/render/providers") {
    send(res, 200, { ok: true, providers });
    return;
  }

  if (req.method === "GET" && url.pathname === "/render/jobs") {
    send(res, 200, { ok: true, jobs: listJobs() });
    return;
  }

  if (req.method === "POST" && url.pathname === "/render/jobs") {
    try {
      const body = await readJson(req);
      const now = Date.now();
      const job = {
        id: uid(),
        title: body.title || "Untitled render",
        kind: body.kind || "video",
        provider: body.provider || "odd-local-placeholder",
        prompt: body.prompt || "",
        payload: body.payload || {},
        status: "queued",
        progress: 0,
        createdAt: now,
        updatedAt: now,
      };
      writeJob(job);
      scheduleLifecycle(job);
      send(res, 201, { ok: true, job });
    } catch (err) {
      send(res, 400, { ok: false, error: err.message || String(err) });
    }
    return;
  }

  if (req.method === "GET" && url.pathname.startsWith("/render/jobs/")) {
    const id = decodeURIComponent(url.pathname.split("/").pop() || "");
    const job = readJob(id);
    if (!job) return notFound(res);
    send(res, 200, { ok: true, job });
    return;
  }

  notFound(res);
});

server.listen(PORT, HOST, () => {
  console.log(`[oddengine-render-backend] listening on http://${HOST}:${PORT}`);
  console.log(`[oddengine-render-backend] jobs=${JOBS_DIR}`);
  console.log(`[oddengine-render-backend] outputs=${OUTPUTS_DIR}`);
});