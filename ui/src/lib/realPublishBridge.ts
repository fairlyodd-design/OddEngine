
export type RealPublishTarget = "youtube" | "gumroad" | "kdp" | "tiktok";

export type RealPublishPayload = {
  title: string;
  description: string;
  target: RealPublishTarget;
  artifactPath?: string;
  thumbnailPath?: string;
  tags?: string[];
};

export type RealPublishResult = {
  ok: boolean;
  target: RealPublishTarget;
  status: string;
  url?: string;
  detail?: string;
};

const DEFAULT_BASE = "http://127.0.0.1:8899";

function getBase() {
  try {
    return window.localStorage.getItem("fairlyodd.creativeBackendBase") || DEFAULT_BASE;
  } catch {
    return DEFAULT_BASE;
  }
}

export async function probePublishBridge(baseUrl = getBase()) {
  try {
    const res = await fetch(`${baseUrl}/publish/health`);
    if (!res.ok) return { ok: false, status: `HTTP ${res.status}`, detail: "publish bridge unavailable" };
    const data = await res.json().catch(() => ({}));
    return { ok: true, status: data.status || "ok", detail: data.detail || "" };
  } catch (err: any) {
    return { ok: false, status: "unreachable", detail: String(err?.message || err) };
  }
}

export async function publishRealWorld(payload: RealPublishPayload, baseUrl = getBase()): Promise<RealPublishResult> {
  const res = await fetch(`${baseUrl}/publish/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    return { ok: false, target: payload.target, status: `HTTP ${res.status}`, detail: "submit failed" };
  }
  const data = await res.json().catch(() => ({}));
  return {
    ok: true,
    target: payload.target,
    status: data.status || "submitted",
    url: data.url,
    detail: data.detail,
  };
}
