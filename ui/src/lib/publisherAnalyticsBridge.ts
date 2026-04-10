
export type RevenueRecord = {
  id: string;
  provider: string;
  title?: string;
  views?: number;
  clicks?: number;
  conversions?: number;
  revenue?: number;
  currency?: string;
  timestamp?: string;
};

const DEFAULT_BASE = "http://127.0.0.1:8899";

function getBase() {
  try {
    return window.localStorage.getItem("fairlyodd.creativeBackendBase") || DEFAULT_BASE;
  } catch {
    return DEFAULT_BASE;
  }
}

export async function probeAnalytics(baseUrl = getBase()) {
  try {
    const res = await fetch(`${baseUrl}/analytics/health`);
    if (!res.ok) return { ok:false, status:`HTTP ${res.status}` };
    return await res.json();
  } catch (e:any) {
    return { ok:false, status:"unreachable", detail:String(e?.message||e) };
  }
}

export async function fetchRevenue(baseUrl = getBase()): Promise<RevenueRecord[]> {
  const res = await fetch(`${baseUrl}/analytics/revenue`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : (data.records || []);
}
