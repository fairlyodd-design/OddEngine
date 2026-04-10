import http from "http";
import { randomUUID } from "crypto";

const HOST = process.env.BARK_HOST || "127.0.0.1";
const PORT = Number(process.env.BARK_PORT || 7000);

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

function slug(v) {
  return String(v || "audio")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "audio";
}

function fakeWavBase64(text) {
  const marker = `ODDENGINE_BARK_WRAPPER:${text || "audio"}`;
  return Buffer.from(marker, "utf8").toString("base64");
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return send(res, 200, { ok: true });
  const url = new URL(req.url || "/", `http://${req.headers.host || `${HOST}:${PORT}`}`);

  if (req.method === "GET" && url.pathname === "/health") {
    return send(res, 200, {
      ok: true,
      status: "ready",
      service: "bark-wrapper",
      provider: "bark",
      mode: process.env.BARK_MODE || "stub-wrapper",
      detail: "Wrapper ready. Replace stub generation with real Bark integration when local Bark runtime is available.",
    });
  }

  if (req.method === "POST" && url.pathname === "/generate") {
    const body = await readBody(req).catch(() => ({}));
    const text = String(body?.text || body?.job?.script || body?.job?.finalOutput || body?.job?.prompt || "Generated Bark audio");
    const voice = String(body?.voice || "v2/en_speaker_6");
    const id = randomUUID();
    return send(res, 200, {
      ok: true,
      provider: "bark",
      status: "generated",
      outputs: [
        {
          name: `${slug(text)}-${id.slice(0, 6)}`,
          mime: "audio/wav",
          ext: "wav",
          base64: fakeWavBase64(text),
          note: "Stub Bark wrapper output. Wire a real Bark runtime here for true audio synthesis.",
        }
      ],
      meta: {
        voice,
        textLength: text.length,
      },
    });
  }

  return send(res, 404, { ok: false, error: "Not found" });
});

server.listen(PORT, HOST, () => {
  console.log(`[Bark Wrapper] Ready on http://${HOST}:${PORT}`);
});
