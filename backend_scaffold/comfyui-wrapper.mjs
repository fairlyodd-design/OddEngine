import http from "http";
import { randomUUID } from "crypto";

const HOST = process.env.COMFYUI_WRAPPER_HOST || "127.0.0.1";
const PORT = Number(process.env.COMFYUI_WRAPPER_PORT || 8188);

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
  return String(v || "video")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "video";
}

function fakePngBase64(text) {
  const marker = `ODDENGINE_COMFYUI_WRAPPER:${text || "image"}`;
  return Buffer.from(marker, "utf8").toString("base64");
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return send(res, 200, { ok: true });
  const url = new URL(req.url || "/", `http://${req.headers.host || `${HOST}:${PORT}`}`);

  if (req.method === "GET" && url.pathname === "/health") {
    return send(res, 200, {
      ok: true,
      status: "ready",
      service: "comfyui-wrapper",
      provider: "comfyui",
      detail: "Wrapper ready. Can be replaced with a real ComfyUI bridge that posts prompts/workflows to a local ComfyUI server.",
    });
  }

  if (req.method === "GET" && url.pathname === "/system_stats") {
    return send(res, 200, {
      ok: true,
      system: { wrapper: true, provider: "comfyui", status: "ready" },
    });
  }

  if (req.method === "POST" && url.pathname === "/generate") {
    const body = await readBody(req).catch(() => ({}));
    const workflow = String(body?.workflow || body?.job?.workflow || "basic_txt2img_video");
    const prompt = String(body?.job?.visualBrief || body?.job?.prompt || body?.job?.title || "Generated frame");
    const id = randomUUID();
    return send(res, 200, {
      ok: true,
      provider: "comfyui",
      status: "generated",
      artifacts: [
        {
          name: `${slug(prompt)}-${id.slice(0, 6)}-frame`,
          mime: "image/png",
          ext: "png",
          base64: fakePngBase64(prompt),
          note: "Stub ComfyUI wrapper frame. Replace this wrapper with a real ComfyUI queue/prompt bridge for actual renders.",
        }
      ],
      meta: {
        workflow,
        promptLength: prompt.length,
      },
    });
  }

  return send(res, 404, { ok: false, error: "Not found" });
});

server.listen(PORT, HOST, () => {
  console.log(`[ComfyUI Wrapper] Ready on http://${HOST}:${PORT}`);
});
