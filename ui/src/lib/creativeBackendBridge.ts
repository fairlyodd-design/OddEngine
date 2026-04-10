
export type CreativeBackendHealth = {
  ok: boolean;
  status: string;
  baseUrl: string;
  detail?: string;
};

export type CreativeBackendJobPayload = {
  prompt: string;
  type: "book" | "video" | "song" | "cartoon" | "script";
  title?: string;
};

const DEFAULT_BASE = "http://127.0.0.1:8899";

export function getCreativeBackendBase() {
  try {
    return window.localStorage.getItem("fairlyodd.creativeBackendBase") || DEFAULT_BASE;
  } catch {
    return DEFAULT_BASE;
  }
}

export function setCreativeBackendBase(url: string) {
  try {
    window.localStorage.setItem("fairlyodd.creativeBackendBase", url);
  } catch {}
}

export async function probeCreativeBackend(baseUrl = getCreativeBackendBase()): Promise<CreativeBackendHealth> {
  try {
    const res = await fetch(`${baseUrl}/health`);
    if (!res.ok) {
      return { ok: false, status: `HTTP ${res.status}`, baseUrl };
    }
    const data = await res.json().catch(() => ({}));
    return { ok: true, status: data.status || "ok", baseUrl, detail: data.engine || data.detail || "" };
  } catch (err: any) {
    return { ok: false, status: "unreachable", baseUrl, detail: String(err?.message || err) };
  }
}

export async function submitCreativeJob(payload: CreativeBackendJobPayload, baseUrl = getCreativeBackendBase()) {
  const res = await fetch(`${baseUrl}/render/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Creative backend job submit failed: HTTP ${res.status}`);
  }
  return await res.json();
}

export async function listCreativeJobs(baseUrl = getCreativeBackendBase()) {
  const res = await fetch(`${baseUrl}/render/jobs`);
  if (!res.ok) throw new Error(`Creative backend job list failed: HTTP ${res.status}`);
  return await res.json();
}
