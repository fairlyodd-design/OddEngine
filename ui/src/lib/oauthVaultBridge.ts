
export type OAuthVaultStatus = {
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

export async function probeOAuthVault(baseUrl = getBase()): Promise<OAuthVaultStatus> {
  try {
    const res = await fetch(`${baseUrl}/oauth/health`);
    if (!res.ok) return { ok: false, status: `HTTP ${res.status}`, detail: "oauth vault unavailable" };
    return await res.json();
  } catch (err: any) {
    return { ok: false, status: "unreachable", detail: String(err?.message || err) };
  }
}

export async function saveOAuthToken(provider: string, tokenPayload: any, baseUrl = getBase()) {
  const res = await fetch(`${baseUrl}/oauth/store`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider, tokenPayload }),
  });
  if (!res.ok) throw new Error(`OAuth store failed: HTTP ${res.status}`);
  return await res.json();
}

export async function listOAuthProviders(baseUrl = getBase()) {
  const res = await fetch(`${baseUrl}/oauth/providers`);
  if (!res.ok) throw new Error(`OAuth providers failed: HTTP ${res.status}`);
  return await res.json();
}
