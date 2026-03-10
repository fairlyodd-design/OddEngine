import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seedPath = path.join(__dirname, "data", "cannabisDeals.seed.json");
const PORT = Number(process.env.CANNABIS_PROXY_PORT || 8797);
const HOST = process.env.CANNABIS_PROXY_HOST || "127.0.0.1";

function json(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS"
  });
  res.end(JSON.stringify(data));
}

function loadSeed() {
  try {
    return JSON.parse(fs.readFileSync(seedPath, "utf8"));
  } catch {
    return { updatedAt: new Date().toISOString(), providers: [], deals: [] };
  }
}

function matchQuery(row, q) {
  if (!q) return true;
  const hay = [row.title, row.summary, row.store, row.source].join(" ").toLowerCase();
  return hay.includes(q.toLowerCase());
}

const server = http.createServer((req, res) => {
  if (!req.url) return json(res, 404, { error: "missing url" });
  if (req.method === "OPTIONS") return json(res, 200, { ok: true });
  const url = new URL(req.url, `http://${req.headers.host}`);
  const seed = loadSeed();

  if (url.pathname === "/health") return json(res, 200, { ok: true, service: "cannabis-proxy", updatedAt: seed.updatedAt });
  if (url.pathname === "/cannabis/providers") return json(res, 200, { providers: seed.providers || [] });
  if (url.pathname === "/cannabis/deals") {
    const provider = url.searchParams.get("provider") || "seed-las-vegas";
    const q = url.searchParams.get("q") || "";
    let deals = Array.isArray(seed.deals) ? seed.deals.slice() : [];
    if (provider === "mock-events") deals = deals.filter((d) => d.event);
    deals = deals.filter((row) => matchQuery(row, q)).sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
    const p = (seed.providers || []).find((x) => x.id === provider);
    return json(res, 200, { updatedAt: seed.updatedAt, provider, providerLabel: p?.label || provider, deals });
  }
  return json(res, 404, { error: "not found" });
});

server.listen(PORT, HOST, () => console.log(`[Cannabis Proxy] listening on http://${HOST}:${PORT}`));
