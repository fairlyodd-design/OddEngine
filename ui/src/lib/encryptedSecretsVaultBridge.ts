
export type SecretsVaultStatus = {
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

export async function probeEncryptedVault(baseUrl = getBase()): Promise<SecretsVaultStatus> {
  try {
    const res = await fetch(`${baseUrl}/secrets/health`);
    if (!res.ok) return { ok: false, status: `HTTP ${res.status}`, detail: "encrypted vault unavailable" };
    return await res.json();
  } catch (err: any) {
    return { ok: false, status: "unreachable", detail: String(err?.message || err) };
  }
}

export async function storeEncryptedSecret(provider: string, secretPayload: any, baseUrl = getBase()) {
  const res = await fetch(`${baseUrl}/secrets/store`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider, secretPayload }),
  });
  if (!res.ok) throw new Error(`Encrypted secret store failed: HTTP ${res.status}`);
  return await res.json();
}

export async function listEncryptedProviders(baseUrl = getBase()) {
  const res = await fetch(`${baseUrl}/secrets/providers`);
  if (!res.ok) throw new Error(`Encrypted providers failed: HTTP ${res.status}`);
  return await res.json();
}
