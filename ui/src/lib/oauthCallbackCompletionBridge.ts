
export type OAuthCallbackStatus = {
  ok: boolean;
  status: string;
  detail?: string;
  providers?: string[];
};

const DEFAULT_BASE = "http://127.0.0.1:8899";

function getBase() {
  try {
    return window.localStorage.getItem("fairlyodd.creativeBackendBase") || DEFAULT_BASE;
  } catch {
    return DEFAULT_BASE;
  }
}

export async function probeOAuthCallbackCompletion(baseUrl = getBase()): Promise<OAuthCallbackStatus> {
  try {
    const res = await fetch(`${baseUrl}/oauth/callback/health`);
    if (!res.ok) return { ok: false, status: `HTTP ${res.status}`, detail: "oauth callback completion unavailable" };
    return await res.json();
  } catch (err: any) {
    return { ok: false, status: "unreachable", detail: String(err?.message || err) };
  }
}

export async function completeOAuthCallback(provider: string, code: string, state: string, baseUrl = getBase()) {
  const res = await fetch(`${baseUrl}/oauth/callback/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider, code, state }),
  });
  if (!res.ok) throw new Error(`OAuth callback completion failed: HTTP ${res.status}`);
  return await res.json();
}
