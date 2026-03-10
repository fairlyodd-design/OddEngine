import { fetchUrlJson } from "./webData";

export type CannabisProxyPayload = {
  deals?: Array<{
    id?: string;
    title: string;
    link?: string;
    source?: string;
    publishedAt?: string;
    summary?: string;
    store?: string;
    score?: number;
    event?: boolean;
  }>;
  providers?: CannabisProxyProvider[];
  updatedAt?: string;
  provider?: string;
  providerLabel?: string;
};

export type CannabisProxyProvider = {
  id: string;
  label: string;
  kind?: string;
  stores?: string[];
  description?: string;
};

export async function fetchCannabisProxyDeals(baseUrl: string, query: string, zip = "89121", provider = "seed-las-vegas") {
  const root = String(baseUrl || "").trim().replace(/\/$/, "");
  if (!root) throw new Error("Set a cannabis proxy base URL first.");
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (zip) params.set("zip", zip);
  if (provider) params.set("provider", provider);
  return await fetchUrlJson<CannabisProxyPayload>(`${root}/cannabis/deals?${params.toString()}`, 15000);
}

export async function fetchCannabisProxyProviders(baseUrl: string): Promise<CannabisProxyProvider[]> {
  const root = String(baseUrl || "").trim().replace(/\/$/, "");
  if (!root) throw new Error("Set a cannabis proxy base URL first.");
  const data = await fetchUrlJson<{ providers?: CannabisProxyProvider[] }>(`${root}/cannabis/providers`, 8000);
  return Array.isArray(data?.providers) ? data.providers : [];
}

export function proxyRowsToDeals(payload: CannabisProxyPayload) {
  const rows = Array.isArray(payload?.deals) ? payload.deals : [];
  return rows.map((row) => ({
    id: row.id || `proxy_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`,
    text: row.summary || row.title || "Vegas proxy lane",
    sourceUrl: row.link || "",
    store: row.store || row.source || payload?.providerLabel || "Cannabis proxy",
    category: row.event ? "Event" : "Live proxy lane",
    priceTier: row.score != null && row.score >= 88 ? "Value" : row.score != null && row.score >= 75 ? "Mid" : "Premium",
    tags: [payload?.providerLabel || payload?.provider || "proxy", row.event ? "event" : "deal", "vegas"],
    score: Number(row.score || 76),
    breakdown: { value: Number(row.score || 76), clarity: 82, restrictions: 70, timeframe: 78 },
    signals: { value: ["Proxy ranked"], restrictions: ["Verify on source"], timeframe: [payload?.updatedAt || "Fresh pull"], clarity: [row.title || "Proxy row"] },
    createdAt: Date.now(),
  }));
}
