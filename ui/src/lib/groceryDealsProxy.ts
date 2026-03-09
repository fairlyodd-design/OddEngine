import { FeedItem, fetchUrlJson } from "./webData";

export type GroceryProxyPayload = {
  deals?: Array<{
    id?: string;
    title: string;
    link?: string;
    source?: string;
    publishedAt?: string;
    summary?: string;
    store?: string;
    score?: number;
  }>;
  stores?: string[];
  updatedAt?: string;
  provider?: string;
  providerLabel?: string;
};

export type GroceryProxyProvider = {
  id: string;
  label: string;
  kind?: string;
  stores?: string[];
  description?: string;
};

function uid(prefix = "deal") {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
}

export async function fetchGroceryProxyDeals(baseUrl: string, query: string, stores: string[] = [], provider = "seed"): Promise<FeedItem[]> {
  const root = String(baseUrl || "").trim().replace(/\/$/, "");
  if (!root) throw new Error("Set a proxy base URL first.");
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (stores.length) params.set("stores", stores.join(","));
  if (provider) params.set("provider", provider);
  const url = `${root}/grocery/deals?${params.toString()}`;
  const data = await fetchUrlJson<GroceryProxyPayload>(url, 15000);
  const rows = Array.isArray(data?.deals) ? data.deals : [];
  return rows.slice(0, 16).map((row) => ({
    id: row.id || uid("proxydeal"),
    title: row.title || "Untitled deal",
    link: row.link || root,
    source: row.source || row.store || data?.providerLabel || "Local grocery proxy",
    publishedAt: row.publishedAt || data?.updatedAt || "",
    summary: row.summary || (row.score != null ? `Proxy score ${row.score}` : `Pulled from ${data?.providerLabel || 'local grocery proxy'}.`),
  })).filter((row) => row.title && row.link);
}

export async function fetchGroceryProxyProviders(baseUrl: string): Promise<GroceryProxyProvider[]> {
  const root = String(baseUrl || "").trim().replace(/\/$/, "");
  if (!root) throw new Error("Set a proxy base URL first.");
  const data = await fetchUrlJson<{ providers?: GroceryProxyProvider[] }>(`${root}/providers`, 8000);
  return Array.isArray(data?.providers) ? data.providers : [];
}
