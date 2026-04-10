
export type PublisherProvider = "youtube" | "gumroad" | "kdp" | "tiktok";

export type ConnectorHealth = {
  ok: boolean;
  status: string;
  detail?: string;
  providers?: string[];
};

export type ConnectorFlowResult = {
  ok: boolean;
  provider: PublisherProvider;
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

export async function probePublisherConnectors(baseUrl = getBase()): Promise<ConnectorHealth> {
  try {
    const res = await fetch(`${baseUrl}/connectors/health`);
    if (!res.ok) return { ok: false, status: `HTTP ${res.status}`, detail: "connector bridge unavailable" };
    return await res.json();
  } catch (err: any) {
    return { ok: false, status: "unreachable", detail: String(err?.message || err) };
  }
}

export async function listPublisherConnectors(baseUrl = getBase()) {
  const res = await fetch(`${baseUrl}/connectors/providers`);
  if (!res.ok) throw new Error(`Connector providers failed: HTTP ${res.status}`);
  return await res.json();
}

export async function startPublisherConnectorFlow(provider: PublisherProvider, artifactPath: string, meta: any = {}, baseUrl = getBase()): Promise<ConnectorFlowResult> {
  const res = await fetch(`${baseUrl}/connectors/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider, artifactPath, meta }),
  });
  if (!res.ok) return { ok: false, provider, status: `HTTP ${res.status}`, detail: "connector start failed" };
  return await res.json();
}

export async function finalizePublisherConnectorFlow(provider: PublisherProvider, flowId: string, baseUrl = getBase()): Promise<ConnectorFlowResult> {
  const res = await fetch(`${baseUrl}/connectors/finalize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider, flowId }),
  });
  if (!res.ok) return { ok: false, provider, status: `HTTP ${res.status}`, detail: "connector finalize failed" };
  return await res.json();
}
