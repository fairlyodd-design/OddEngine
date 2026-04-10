
export type AuthTarget = "youtube" | "gumroad";

const DEFAULT_BASE = "http://127.0.0.1:8899";

function getBase() {
  try {
    return window.localStorage.getItem("fairlyodd.creativeBackendBase") || DEFAULT_BASE;
  } catch {
    return DEFAULT_BASE;
  }
}

export async function probeAuthBridge(baseUrl = getBase()) {
  try {
    const res = await fetch(`${baseUrl}/publish/auth/health`);
    if (!res.ok) return { ok: false, status: `HTTP ${res.status}` };
    return await res.json();
  } catch (err: any) {
    return { ok: false, status: "unreachable", detail: String(err?.message || err) };
  }
}

export async function startAuthFlow(target: AuthTarget, baseUrl = getBase()) {
  const res = await fetch(`${baseUrl}/publish/auth/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target }),
  });
  if (!res.ok) throw new Error(`Auth start failed: HTTP ${res.status}`);
  return await res.json();
}
