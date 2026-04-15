export type PublicApiMode = "website" | "api";

export type PublicApiSettings = {
  mode: PublicApiMode;
  secretKey: string;
  accessToken: string;
  accountId: string;
  chartSymbol: string;
  chartInterval: string;
  optionType: "all" | "call" | "put";
  expiration: string;
};

export type PublicApiAccount = {
  accountId: string;
  accountType?: string;
  optionsLevel?: string;
  tradePermissions?: string;
};

export type PublicApiGreeks = {
  delta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
  rho: number | null;
  impliedVolatility: number | null;
};

export type PublicApiQuoteRow = {
  instrument?: { symbol?: string; type?: string };
  outcome?: string;
  last?: string | number | null;
  lastTimestamp?: string | null;
  bid?: string | number | null;
  bidSize?: number | null;
  bidTimestamp?: string | null;
  ask?: string | number | null;
  askSize?: number | null;
  askTimestamp?: string | null;
  volume?: number | null;
  openInterest?: number | null;
};

export type PublicApiChainResponse = {
  baseSymbol: string;
  calls: PublicApiQuoteRow[];
  puts: PublicApiQuoteRow[];
};

export function emptyGreeks(): PublicApiGreeks {
  return { delta: null, gamma: null, theta: null, vega: null, rho: null, impliedVolatility: null };
}

export function asNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function normalizePublicChartSymbol(symbol: string): string {
  const s = String(symbol || "").trim().toUpperCase();
  if (!s) return "AMEX:SPY";
  if (s.includes(":")) return s;
  const amex = new Set(["SPY", "IWM", "DIA", "XLF", "XLK", "XLE", "XBI", "ARKK", "SLV", "GLD", "USO", "XOP", "SMH", "UVXY", "SOXL", "SOXS", "TNA", "TZA"]);
  const cboeIndex = new Set(["VIX", "SPX", "NDX", "RUT"]);
  if (cboeIndex.has(s)) return `CBOE:${s}`;
  if (amex.has(s)) return `AMEX:${s}`;
  return `NASDAQ:${s}`;
}

export function optionSideFromOsiSymbol(osiSymbol: string): "call" | "put" {
  const side = String(osiSymbol || "").slice(-9, -8).toUpperCase();
  return side === "P" ? "put" : "call";
}

export function parseOsiSymbol(osiSymbol: string): { root: string; expiration: string; strike: number; side: "call" | "put" } | null {
  const s = String(osiSymbol || "").trim().toUpperCase();
  const m = s.match(/^([A-Z]{1,6})(\d{6})([CP])(\d{8})$/);
  if (!m) return null;
  const [, root, yymmdd, cp, strikeRaw] = m;
  const yy = Number(yymmdd.slice(0, 2));
  const mm = yymmdd.slice(2, 4);
  const dd = yymmdd.slice(4, 6);
  return {
    root,
    expiration: `20${yy.toString().padStart(2, "0")}-${mm}-${dd}`,
    strike: Number(strikeRaw) / 1000,
    side: cp === "P" ? "put" : "call",
  };
}

export function breakevenFromStrike(side: "call" | "put", strike: number, ask: number | null): number | null {
  if (ask === null || !Number.isFinite(strike)) return null;
  return side === "call" ? strike + ask : strike - ask;
}

export function toBreakevenPct(spot: number | null, breakeven: number | null): number | null {
  if (spot === null || breakeven === null || !Number.isFinite(spot) || spot <= 0) return null;
  return ((breakeven - spot) / spot) * 100;
}

export function parseGreeksResponse(json: any): Record<string, PublicApiGreeks> {
  const out: Record<string, PublicApiGreeks> = {};
  for (const row of Array.isArray(json?.greeks) ? json.greeks : []) {
    const symbol = String(row?.symbol || "").toUpperCase();
    if (!symbol) continue;
    const g = row?.greeks || {};
    out[symbol] = {
      delta: asNumber(g.delta),
      gamma: asNumber(g.gamma),
      theta: asNumber(g.theta),
      vega: asNumber(g.vega),
      rho: asNumber(g.rho),
      impliedVolatility: asNumber(g.impliedVolatility),
    };
  }
  return out;
}
