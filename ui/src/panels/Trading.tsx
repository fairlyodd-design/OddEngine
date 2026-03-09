import React, { useEffect, useMemo, useRef, useState } from "react";
import { downloadTextFile } from "../lib/files";
import { isDesktop, oddApi } from "../lib/odd";
import { pushNotif } from "../lib/notifs";
import { acknowledgePanelAction, getPanelActions, PANEL_ACTION_EVENT, rememberActionOutcome, type PanelActionEnvelope } from "../lib/brain";

function persistTradingSnapshot(chain: any){
  try{
    if(!chain){
      localStorage.removeItem("odd.trading.chainSnapshot");
      return;
    }
    const snap = {
      v: 1,
      at: Date.now(),
      symbol: chain.symbol,
      expiration: chain.expirationLabel,
      spot: chain.spot,
      companyName: chain.companyName,
      sourceUrl: chain.sourceUrl,
      contracts: chain.contracts,
    };
    localStorage.setItem("odd.trading.chainSnapshot", JSON.stringify(snap));
  }catch{}
}

function hydrateChainFromSnapshot(snapshot: any): PublicChainData | null {
  if (!snapshot?.contracts?.length) return null;
  const contracts = Array.isArray(snapshot.contracts) ? snapshot.contracts : [];
  return {
    symbol: snapshot.symbol || "",
    companyName: snapshot.companyName || null,
    sourceUrl: snapshot.sourceUrl || "",
    sourceMode: "snapshot",
    expirationLabel: snapshot.expiration || "",
    expirations: snapshot.expiration ? [{ label: snapshot.expiration, text: snapshot.expiration }] : [],
    feedUpdated: snapshot.at ? new Date(snapshot.at).toISOString() : null,
    spot: typeof snapshot.spot === "number" ? snapshot.spot : null,
    calls: contracts.filter((c: any) => c?.side === "call"),
    puts: contracts.filter((c: any) => c?.side === "put"),
    contracts,
  } as any;
}

async function undockTrading(kind: string, title: string){
  try{
    const api = oddApi();
    if(!api?.openWindow) return;
    await api.openWindow({
      title,
      width: 1280,
      height: 820,
      query: { panel: "trading", undock: kind },
    });
  }catch{}
}
import {
  asNumber,
  breakevenFromStrike,
  emptyGreeks,
  normalizePublicChartSymbol,
  optionSideFromOsiSymbol,
  parseGreeksResponse,
  parseOsiSymbol,
  toBreakevenPct,
  type PublicApiAccount,
  type PublicApiChainResponse,
  type PublicApiGreeks,
  type PublicApiQuoteRow,
} from "../lib/publicApi";
import {
  buildPublicChainUrl,
  formatMoney,
  formatPct,
  parsePublicOptionsHtml,
  scanContractScore,
  type PublicChainData,
  type PublicContract,
} from "../lib/publicScanner";
import { loadJSON, saveJSON } from "../lib/storage";

function formatPublicContractLabel(osi: string): string {
  const p = parseOsiSymbol(osi);
  if (!p) return String(osi || "");
  const d = new Date(`${p.expiration}T00:00:00`);
  const mm = d.getMonth() + 1;
  const dd = d.getDate();
  const yy = String(d.getFullYear()).slice(-2);
  const strike = Number.isFinite(p.strike) ? Math.round(p.strike * 1000) / 1000 : p.strike;
  const strikeTxt = String(strike).replace(/\.0+$/, "");
  const cp = p.side === "put" ? "P" : "C";
  return `${p.root} ${mm}/${dd}/${yy} ${strikeTxt}${cp}`;
}

function buildPublicShortTicket(opts: {
  action: "BUY" | "SELL";
  qty: number;
  osi: string;
  orderType: "MARKET" | "LIMIT" | "STOP" | "STOP_LIMIT";
  limitPx: number | null;
  stopPx: number | null;
  exitStopPx: number | null;
  tp: Array<{ p: number; px: number }>;
  riskTxt: string;
  slPct: number;
}): string {
  const label = formatPublicContractLabel(opts.osi);
  const q = Math.max(1, Number(opts.qty || 1));

  const entry = (() => {
    if (opts.orderType === "MARKET") return `${opts.action} ${q} ${label} MKT`;
    if (opts.orderType === "LIMIT") return `${opts.action} ${q} ${label} LMT ${opts.limitPx ? opts.limitPx.toFixed(2) : "—"}`;
    if (opts.orderType === "STOP") return `${opts.action} ${q} ${label} STP ${opts.stopPx ? opts.stopPx.toFixed(2) : "—"}`;
    return `${opts.action} ${q} ${label} STP ${opts.stopPx ? opts.stopPx.toFixed(2) : "—"} / LMT ${opts.limitPx ? opts.limitPx.toFixed(2) : "—"}`;
  })();

  const lines: string[] = [entry];

  if (opts.action === "BUY") {
    const ocoBits: string[] = [];
    if (opts.exitStopPx && opts.exitStopPx > 0) ocoBits.push(`STOP ${opts.exitStopPx.toFixed(2)}`);
    if (opts.tp?.length) ocoBits.push(`TP ${opts.tp.map((x) => `${x.p}%=${x.px.toFixed(2)}`).join(",")}`);
    if (ocoBits.length) lines.push(`OCO: ${ocoBits.join(" | ")}`);
  }

  lines.push(`RISK ${opts.riskTxt || "—"} | SL ${opts.slPct}%`);
  return lines.join("\n");
}

type Input = {
  symbol: string;
  chartSymbol: string;
  chartInterval: string;
  bias: "bull" | "bear" | "neutral";
  timeframe: "0dte" | "weeklies";
  setup: "break_retest" | "vwap_flip" | "range_reject";
  env: number;
  heat: number;
  traps: { chop: boolean; news: boolean; wideSpreads: boolean; fakeBreaks: boolean };
  levels: string;
  notes: string;
  watchlist: string;
  maxAsk: number;
  minOi: number;
  targetSide: "all" | "call" | "put";
  sortBy: "score" | "oi" | "ask" | "dayChange" | "strike" | "delta";
  dataMode: "website" | "api";
  publicSecretKey: string;
  publicAccessToken: string;
  publicAccountId: string;
  selectedExpiration: string;
  contractSearch: string;
  strikeGrouping: "raw" | "1" | "2.5" | "5" | "10";
};

type DrawerTab = "calls" | "puts" | "detail" | "greeks";

type WatchlistRow = {
  symbol: string;
  companyName: string | null;
  sourceUrl: string;
  spot: number | null;
  expiration: string | null;
  feedUpdated: string | null;
  bestCall: PublicContract | null;
  bestPut: PublicContract | null;
  error?: string;
};

type ChainLoadResult = {
  chain: PublicChainData;
  expirations: string[];
};

type StrikeGroupSummary = {
  bucket: number;
  label: string;
  count: number;
  callCount: number;
  putCount: number;
  maxOi: number;
  bestContract: PublicContract | null;
  avgAsk: number | null;
};

const KEY = "oddengine:trading:sniper:v4";
const UI_KEY = "oddengine:trading:ui:v1";
const DEFAULTS: Input = {
  symbol: "SPY",
  chartSymbol: "AMEX:SPY",
  chartInterval: "15",
  bias: "bull",
  timeframe: "0dte",
  setup: "vwap_flip",
  env: 70,
  heat: 70,
  traps: { chop: false, news: false, wideSpreads: false, fakeBreaks: false },
  levels: "",
  notes: "",
  watchlist: "SPY, QQQ, IWM, NVDA, TSLA, AAPL",
  maxAsk: 5,
  minOi: 100,
  targetSide: "all",
  sortBy: "score",
  dataMode: "website",
  publicSecretKey: "",
  publicAccessToken: "",
  publicAccountId: "",
  selectedExpiration: "",
  contractSearch: "",
  strikeGrouping: "raw",
};

function clamp(n: number) {
  return Math.max(0, Math.min(100, n));
}

function sinceMs(ts: number | null): string {
  if (!ts) return "—";
  const ms = Date.now() - ts;
  if (ms < 15_000) return "just now";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function uniqSymbols(raw: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of raw.split(/[\s,\n]+/)) {
    const s = part.trim().toUpperCase();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out.slice(0, 18);
}

function pickBest(contracts: PublicContract[], cfg: { maxAsk: number; minOi: number; targetSide: "call" | "put" | "all" }): PublicContract | null {
  const ranked = contracts.map((c) => ({ contract: c, total: scanContractScore(c, cfg) })).sort((a, b) => b.total - a.total);
  return ranked[0]?.contract ?? null;
}

function sortContracts(contracts: PublicContract[], sortBy: Input["sortBy"], cfg: { maxAsk: number; minOi: number; targetSide: "call" | "put" | "all" }): PublicContract[] {
  const arr = [...contracts];
  arr.sort((a, b) => {
    if (sortBy === "oi") return (b.openInterest ?? -1) - (a.openInterest ?? -1);
    if (sortBy === "ask") return (a.ask ?? Number.POSITIVE_INFINITY) - (b.ask ?? Number.POSITIVE_INFINITY);
    if (sortBy === "dayChange") return (b.dayChangePct ?? -999) - (a.dayChangePct ?? -999);
    if (sortBy === "delta") return Math.abs((b.greeks?.delta ?? -99)) - Math.abs((a.greeks?.delta ?? -99));
    if (sortBy === "strike") return a.strike - b.strike;
    return scanContractScore(b, cfg) - scanContractScore(a, cfg);
  });
  return arr;
}

async function requestText(opts: { url: string; method?: string; headers?: Record<string, string>; body?: string; timeoutMs?: number; maxBytes?: number }): Promise<string> {
  if (isDesktop()) {
    const res = await oddApi().fetchText({
      url: opts.url,
      method: opts.method,
      headers: opts.headers,
      body: opts.body,
      timeoutMs: opts.timeoutMs ?? 18000,
      maxBytes: opts.maxBytes ?? 3_500_000,
    });
    if (!res.ok || !res.text) throw new Error(res.error || `Request failed (${res.status ?? "unknown"})`);
    return res.text;
  }
  const res = await fetch(opts.url, {
    method: opts.method || "GET",
    headers: opts.headers,
    body: opts.body,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

async function requestJson<T = any>(opts: { url: string; method?: string; headers?: Record<string, string>; body?: any; timeoutMs?: number; maxBytes?: number }): Promise<T> {
  const headers = { ...(opts.headers || {}) };
  let body: string | undefined;
  if (opts.body !== undefined) {
    body = typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body);
    if (!headers["Content-Type"]) headers["Content-Type"] = "application/json";
  }
  const text = await requestText({ ...opts, headers, body, maxBytes: opts.maxBytes ?? 4_500_000 });
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("Response was not valid JSON.");
  }
}

async function openExternal(url: string): Promise<void> {
  if (isDesktop() && oddApi().openExternal) {
    const res = await oddApi().openExternal(url);
    if (!res?.ok) window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

function publicAuthHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function createPublicAccessToken(secretKey: string): Promise<string> {
  const json = await requestJson<{ accessToken?: string }>({
    url: "https://api.public.com/userapiauthservice/personal/access-tokens",
    method: "POST",
    body: { validityInMinutes: 720, secret: secretKey },
    headers: { "Content-Type": "application/json" },
  });
  if (!json?.accessToken) throw new Error("Public did not return an access token.");
  return json.accessToken;
}

async function fetchPublicAccounts(accessToken: string): Promise<PublicApiAccount[]> {
  const json = await requestJson<{ accounts?: PublicApiAccount[] }>({
    url: "https://api.public.com/userapigateway/trading/account",
    method: "GET",
    headers: publicAuthHeaders(accessToken),
  });
  return Array.isArray(json?.accounts) ? json.accounts : [];
}

async function fetchPublicExpirations(accessToken: string, accountId: string, symbol: string): Promise<string[]> {
  const json = await requestJson<{ expirations?: string[] }>({
    url: `https://api.public.com/userapigateway/marketdata/${encodeURIComponent(accountId)}/option-expirations`,
    method: "POST",
    headers: publicAuthHeaders(accessToken),
    body: { instrument: { symbol, type: "EQUITY" } },
  });
  return Array.isArray(json?.expirations) ? json.expirations : [];
}

async function fetchPublicOptionChain(accessToken: string, accountId: string, symbol: string, expirationDate: string): Promise<PublicApiChainResponse> {
  return await requestJson<PublicApiChainResponse>({
    url: `https://api.public.com/userapigateway/marketdata/${encodeURIComponent(accountId)}/option-chain`,
    method: "POST",
    headers: publicAuthHeaders(accessToken),
    body: { instrument: { symbol, type: "EQUITY" }, expirationDate },
    maxBytes: 8_000_000,
  });
}

async function fetchPublicGreeks(accessToken: string, accountId: string, osiSymbols: string[]): Promise<Record<string, PublicApiGreeks>> {
  if (!osiSymbols.length) return {};
  const repeated = osiSymbols.map((s) => `osiSymbols=${encodeURIComponent(s)}`).join("&");
  const baseUrl = `https://api.public.com/userapigateway/option-details/${encodeURIComponent(accountId)}/greeks`;
  try {
    const json = await requestJson<any>({
      url: `${baseUrl}?${repeated}`,
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
      maxBytes: 2_500_000,
    });
    return parseGreeksResponse(json);
  } catch {
    const json = await requestJson<any>({
      url: `${baseUrl}?osiSymbols=${encodeURIComponent(osiSymbols.join(","))}`,
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
      maxBytes: 2_500_000,
    });
    return parseGreeksResponse(json);
  }
}

function normalizeContract(row: PublicApiQuoteRow, side: "call" | "put", spot: number | null, expirationDate: string, sourceUrl: string): PublicContract | null {
  const osiSymbol = String(row?.instrument?.symbol || "").toUpperCase();
  const parsed = parseOsiSymbol(osiSymbol);
  if (!parsed) return null;
  const ask = asNumber(row?.ask);
  const bid = asNumber(row?.bid);
  const last = asNumber(row?.last);
  const strike = parsed.strike;
  const breakeven = breakevenFromStrike(side, strike, ask);
  const dayChangePct = ask !== null && last !== null && ask > 0 ? ((last - ask) / ask) * 100 : null;
  return {
    key: osiSymbol || `${parsed.root}:${side}:${strike}:${expirationDate}`,
    symbol: parsed.root,
    side,
    strike,
    ask,
    bid,
    last,
    volume: row?.volume ?? null,
    expiration: expirationDate,
    osiSymbol,
    breakeven,
    toBreakevenPct: toBreakevenPct(spot, breakeven),
    dayChangePct,
    openInterest: row?.openInterest ?? null,
    score: 0,
    sourceUrl,
    greeks: emptyGreeks(),
  };
}

function scoreContracts(contracts: PublicContract[]): PublicContract[] {
  return contracts.map((c) => ({
    ...c,
    score: scanContractScore({ ...c, score: 0 }, { maxAsk: 999, minOi: 0, targetSide: "all" }),
  }));
}

function mergeGreeksIntoChain(chain: PublicChainData | null, greeksMap: Record<string, PublicApiGreeks>) {
  if (!chain) return chain;
  const decorate = (rows: PublicContract[]) => rows.map((row) => {
    const greek = row.osiSymbol ? greeksMap[row.osiSymbol] : undefined;
    return greek ? { ...row, greeks: greek } : row;
  });
  return {
    ...chain,
    calls: decorate(chain.calls),
    puts: decorate(chain.puts),
  } satisfies PublicChainData;
}

function buildApiChainData(params: {
  symbol: string;
  expirationDate: string;
  api: PublicApiChainResponse;
  expirations: string[];
  spot: number | null;
  companyName: string | null;
  sourceUrl: string;
  feedUpdated: string | null;
}): PublicChainData {
  const calls = scoreContracts((params.api.calls || []).map((row) => normalizeContract(row, optionSideFromOsiSymbol(String(row?.instrument?.symbol || "")), params.spot, params.expirationDate, params.sourceUrl)).filter(Boolean) as PublicContract[]);
  const puts = scoreContracts((params.api.puts || []).map((row) => normalizeContract(row, optionSideFromOsiSymbol(String(row?.instrument?.symbol || "")), params.spot, params.expirationDate, params.sourceUrl)).filter(Boolean) as PublicContract[]);
  const expirationLinks = params.expirations.map((date) => ({ label: date, href: `${params.sourceUrl}#${date}` }));
  return {
    symbol: params.symbol,
    sourceUrl: params.sourceUrl,
    sourceMode: "public_api",
    companyName: params.companyName,
    title: `${params.symbol} Options Chain`,
    spot: params.spot,
    feedUpdated: params.feedUpdated,
    expirationLabel: params.expirationDate,
    expirations: expirationLinks,
    calls,
    puts,
  };
}

function formatGreek(v: number | null | undefined, digits = 3) {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return Number(v).toFixed(digits);
}

function formatTimestamp(v: string | null | undefined) {
  if (!v) return "—";
  return v.replace("T", " ").replace("Z", " UTC");
}

function formatExpirationChip(raw: string, index: number) {
  if (!raw) return index === 0 ? "Today" : "Expiry";
  if (/^today$/i.test(raw)) return "Today";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  if (sameDay) return "Today";
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function contractMatchesSearch(c: PublicContract, q: string) {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  const haystack = [
    c.symbol,
    c.side,
    c.osiSymbol || "",
    c.expiration || "",
    String(c.strike),
    c.strike.toFixed(2),
    c.greeks?.delta != null ? `delta ${c.greeks.delta}` : "",
  ].join(" ").toLowerCase();
  return haystack.includes(s);
}

function groupContractsByStrike(contracts: PublicContract[], grouping: Input["strikeGrouping"]): StrikeGroupSummary[] {
  if (grouping === "raw") return [];
  const size = Number(grouping);
  if (!Number.isFinite(size) || size <= 0) return [];
  const map = new Map<number, PublicContract[]>();
  for (const c of contracts) {
    const bucket = Math.round(c.strike / size) * size;
    if (!map.has(bucket)) map.set(bucket, []);
    map.get(bucket)!.push(c);
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([bucket, rows]) => {
      const callCount = rows.filter((r) => r.side === "call").length;
      const putCount = rows.length - callCount;
      const maxOi = Math.max(...rows.map((r) => r.openInterest ?? 0), 0);
      const avgAskNums = rows.map((r) => r.ask).filter((v): v is number => v !== null && Number.isFinite(v));
      const avgAsk = avgAskNums.length ? avgAskNums.reduce((a, b) => a + b, 0) / avgAskNums.length : null;
      const bestContract = [...rows].sort((a, b) => scanContractScore(b, { maxAsk: 999, minOi: 0, targetSide: "all" }) - scanContractScore(a, { maxAsk: 999, minOi: 0, targetSide: "all" }))[0] ?? null;
      return {
        bucket,
        label: size >= 1 ? bucket.toFixed(0) : bucket.toFixed(2),
        count: rows.length,
        callCount,
        putCount,
        maxOi,
        bestContract,
        avgAsk,
      };
    });
}

function TradingViewChart({ symbol, interval }: { symbol: string; interval: string }) {
  // NOTE: TradingView's script-based embed can throw noisy console errors in Electron/React
  // (contentWindow not available) due to lifecycle/unmount timing. Using the iframe-based
  // embed avoids those errors and is more CSP-friendly.

  const frameId = useMemo(
    () => `tv_${String(symbol || "").replace(/[^a-zA-Z0-9_-]/g, "_")}_${interval}`,
    [symbol, interval]
  );
  const src = useMemo(() => {
    const params = new URLSearchParams({
      frameElementId: frameId,
      symbol,
      interval,
      timezone: "America/Los_Angeles",
      theme: "dark",
      style: "1",
      locale: "en",
      withdateranges: "1",
      hide_side_toolbar: "0",
      hide_top_toolbar: "0",
      allow_symbol_change: "1",
      details: "1",
      hotlist: "0",
      calendar: "0",
      studies: "STD;VWAP",
    });
    return `https://s.tradingview.com/widgetembed/?${params.toString()}`;
  }, [frameId, symbol, interval]);

  return (
    <iframe
      id={frameId}
      title={`TradingView ${symbol}`}
      src={src}
      style={{ width: "100%", height: 430, border: 0, borderRadius: 14, overflow: "hidden" }}
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
      allow="clipboard-write; fullscreen"
    />
  );
}

function OptionCurveChart({ chain, selectedKey }: { chain: PublicChainData | null; selectedKey: string | null }) {
  const all = useMemo(() => {
    if (!chain) return [] as PublicContract[];
    return [...chain.calls, ...chain.puts].filter((c) => c.ask !== null);
  }, [chain]);

  if (!chain || all.length === 0) return <div className="small">Load a chain to render strike / premium curves.</div>;

  const width = 700;
  const height = 250;
  const pad = 24;
  const calls = [...chain.calls].filter((c) => c.ask !== null).sort((a, b) => a.strike - b.strike);
  const puts = [...chain.puts].filter((c) => c.ask !== null).sort((a, b) => a.strike - b.strike);
  const minStrike = Math.min(...all.map((c) => c.strike));
  const maxStrike = Math.max(...all.map((c) => c.strike));
  const maxAsk = Math.max(...all.map((c) => c.ask ?? 0), 1);
  const x = (strike: number) => maxStrike === minStrike ? width / 2 : pad + ((strike - minStrike) / (maxStrike - minStrike)) * (width - pad * 2);
  const y = (ask: number) => height - pad - (ask / maxAsk) * (height - pad * 2);
  const pathFor = (rows: PublicContract[]) => rows.map((c, idx) => `${idx === 0 ? "M" : "L"}${x(c.strike)},${y(c.ask ?? 0)}`).join(" ");
  const selected = all.find((c) => c.key === selectedKey) ?? null;

  function focusBestContractHUD(){
    const best = pickBest(filteredContracts.length ? filteredContracts : allContracts, { maxAsk: inp.maxAsk, minOi: inp.minOi, targetSide: inp.targetSide }) || selectedContract;
    if(best?.key){
      setSelectedContractKey(best.key);
      setDrawerTab("detail");
      if(best.expiration && best.expiration !== inp.selectedExpiration) patch({ selectedExpiration: best.expiration });
      // scroll contracts into view
      setTimeout(() => document.getElementById("trading_contracts")?.scrollIntoView({ behavior:"smooth", block:"start" }), 120);
      pushNotif({ title: "Trading", body: `Focused ${best.symbol} ${best.side.toUpperCase()} ${best.strike}.`, tags: ["Trading"], level: "success" });
      return true;
    }
    pushNotif({ title: "Trading", body: "No contracts loaded yet — scan a symbol first.", tags: ["Trading"], level: "warn" });
    return false
  }

  async function copyPlanToClipboard(){
    try{
      await navigator.clipboard.writeText(plan);
      setLastPlanBuiltAt(Date.now());
      pushNotif({ title: "Trading", body: "Plan copied to clipboard.", tags: ["Trading"], level: "success" });
      return true;
    }catch{
      try{
        const api:any = oddApi();
        if(api?.copyText){
          await api.copyText(plan);
          setLastPlanBuiltAt(Date.now());
          pushNotif({ title: "Trading", body: "Plan copied to clipboard.", tags: ["Trading"], level: "success" });
          return true;
        }
      }catch{}
      pushNotif({ title: "Trading", body: "Could not copy plan (clipboard blocked). Use Export .md instead.", tags: ["Trading"], level: "warn" });
      return false;
    }
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: 250, display: "block" }}>
      <rect x="0" y="0" width={width} height={height} fill="rgba(8,12,18,0.35)" rx="14" />
      <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="rgba(147,164,183,0.35)" />
      <line x1={pad} y1={pad} x2={pad} y2={height - pad} stroke="rgba(147,164,183,0.35)" />
      <path d={pathFor(calls)} fill="none" stroke="rgba(52,211,153,0.95)" strokeWidth="3" />
      <path d={pathFor(puts)} fill="none" stroke="rgba(251,113,133,0.95)" strokeWidth="3" />
      {selected && selected.ask !== null && (
        <g>
          <circle cx={x(selected.strike)} cy={y(selected.ask)} r="5" fill="rgba(96,165,250,0.95)" />
          <text x={x(selected.strike) + 8} y={y(selected.ask) - 8} fill="#e7eef7" fontSize="12">
            {selected.symbol} {selected.side.toUpperCase()} {selected.strike}
          </text>
        </g>
      )}
      <text x={pad} y="16" fill="#93a4b7" fontSize="12">Ask premium by strike</text>
      <text x={width - 110} y="16" fill="rgba(52,211,153,0.95)" fontSize="12">Calls</text>
      <text x={width - 52} y="16" fill="rgba(251,113,133,0.95)" fontSize="12">Puts</text>
      <text x={pad} y={height - 4} fill="#93a4b7" fontSize="11">{minStrike.toFixed(0)}</text>
      <text x={width - pad - 32} y={height - 4} fill="#93a4b7" fontSize="11">{maxStrike.toFixed(0)}</text>
      <text x={pad + 4} y={pad + 10} fill="#93a4b7" fontSize="11">{formatMoney(maxAsk)}</text>
    </svg>
  );
}

function OiBarChart({ contracts, selectedKey }: { contracts: PublicContract[]; selectedKey: string | null }) {
  const rows = useMemo(() => contracts.filter((c) => c.openInterest !== null).slice(0, 16), [contracts]);
  if (rows.length === 0) return <div className="small">No open-interest rows matched your current filters.</div>;
  const width = 700;
  const height = 250;
  const pad = 20;
  const maxOi = Math.max(...rows.map((c) => c.openInterest ?? 0), 1);
  const slot = (width - pad * 2) / rows.length;
  function focusBestContractHUD(){
    const best = pickBest(filteredContracts.length ? filteredContracts : allContracts, { maxAsk: inp.maxAsk, minOi: inp.minOi, targetSide: inp.targetSide }) || selectedContract;
    if(best?.key){
      setSelectedContractKey(best.key);
      setDrawerTab("detail");
      if(best.expiration && best.expiration !== inp.selectedExpiration) patch({ selectedExpiration: best.expiration });
      // scroll contracts into view
      setTimeout(() => document.getElementById("trading_contracts")?.scrollIntoView({ behavior:"smooth", block:"start" }), 120);
      pushNotif({ title: "Trading", body: `Focused ${best.symbol} ${best.side.toUpperCase()} ${best.strike}.`, tags: ["Trading"], level: "success" });
      return true;
    }
    pushNotif({ title: "Trading", body: "No contracts loaded yet — scan a symbol first.", tags: ["Trading"], level: "warn" });
    return false
  }

  async function copyPlanToClipboard(){
    try{
      await navigator.clipboard.writeText(plan);
      setLastPlanBuiltAt(Date.now());
      pushNotif({ title: "Trading", body: "Plan copied to clipboard.", tags: ["Trading"], level: "success" });
      return true;
    }catch{
      try{
        const api:any = oddApi();
        if(api?.copyText){
          await api.copyText(plan);
          setLastPlanBuiltAt(Date.now());
          pushNotif({ title: "Trading", body: "Plan copied to clipboard.", tags: ["Trading"], level: "success" });
          return true;
        }
      }catch{}
      pushNotif({ title: "Trading", body: "Could not copy plan (clipboard blocked). Use Export .md instead.", tags: ["Trading"], level: "warn" });
      return false;
    }
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: 250, display: "block" }}>
      <rect x="0" y="0" width={width} height={height} fill="rgba(8,12,18,0.35)" rx="14" />
      <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="rgba(147,164,183,0.35)" />
      {rows.map((c, idx) => {
        const h = ((c.openInterest ?? 0) / maxOi) * (height - pad * 2 - 12);
        const x = pad + idx * slot + slot * 0.14;
        const w = slot * 0.72;
        const y = height - pad - h;
        const selected = c.key === selectedKey;
        function focusBestContractHUD(){
    const best = pickBest(filteredContracts.length ? filteredContracts : allContracts, { maxAsk: inp.maxAsk, minOi: inp.minOi, targetSide: inp.targetSide }) || selectedContract;
    if(best?.key){
      setSelectedContractKey(best.key);
      setDrawerTab("detail");
      if(best.expiration && best.expiration !== inp.selectedExpiration) patch({ selectedExpiration: best.expiration });
      // scroll contracts into view
      setTimeout(() => document.getElementById("trading_contracts")?.scrollIntoView({ behavior:"smooth", block:"start" }), 120);
      pushNotif({ title: "Trading", body: `Focused ${best.symbol} ${best.side.toUpperCase()} ${best.strike}.`, tags: ["Trading"], level: "success" });
      return true;
    }
    pushNotif({ title: "Trading", body: "No contracts loaded yet — scan a symbol first.", tags: ["Trading"], level: "warn" });
    return false
  }

  async function copyPlanToClipboard(){
    try{
      await navigator.clipboard.writeText(plan);
      setLastPlanBuiltAt(Date.now());
      pushNotif({ title: "Trading", body: "Plan copied to clipboard.", tags: ["Trading"], level: "success" });
      return true;
    }catch{
      try{
        const api:any = oddApi();
        if(api?.copyText){
          await api.copyText(plan);
          setLastPlanBuiltAt(Date.now());
          pushNotif({ title: "Trading", body: "Plan copied to clipboard.", tags: ["Trading"], level: "success" });
          return true;
        }
      }catch{}
      pushNotif({ title: "Trading", body: "Could not copy plan (clipboard blocked). Use Export .md instead.", tags: ["Trading"], level: "warn" });
      return false;
    }
  }

  return (
          <g key={c.key}>
            <rect x={x} y={y} width={w} height={h} rx="6" fill={selected ? "rgba(96,165,250,0.95)" : c.side === "call" ? "rgba(52,211,153,0.80)" : "rgba(251,113,133,0.80)"} />
            <text x={x + w / 2} y={height - 6} textAnchor="middle" fill="#93a4b7" fontSize="10">{c.strike.toFixed(0)}</text>
          </g>
        );
      })}
      <text x={pad} y="16" fill="#93a4b7" fontSize="12">Filtered contracts by open interest</text>
      <text x={width - 86} y="16" fill="#93a4b7" fontSize="11">max OI {maxOi}</text>
    </svg>
  );
}

function DrawerList({ rows, selectedKey, onPick }: { rows: PublicContract[]; selectedKey: string | null; onPick: (key: string) => void }) {
  if (!rows.length) return <div className="small mt-4">No contracts in this tab yet.</div>;
  function focusBestContractHUD(){
    const best = pickBest(filteredContracts.length ? filteredContracts : allContracts, { maxAsk: inp.maxAsk, minOi: inp.minOi, targetSide: inp.targetSide }) || selectedContract;
    if(best?.key){
      setSelectedContractKey(best.key);
      setDrawerTab("detail");
      if(best.expiration && best.expiration !== inp.selectedExpiration) patch({ selectedExpiration: best.expiration });
      // scroll contracts into view
      setTimeout(() => document.getElementById("trading_contracts")?.scrollIntoView({ behavior:"smooth", block:"start" }), 120);
      pushNotif({ title: "Trading", body: `Focused ${best.symbol} ${best.side.toUpperCase()} ${best.strike}.`, tags: ["Trading"], level: "success" });
      return true;
    }
    pushNotif({ title: "Trading", body: "No contracts loaded yet — scan a symbol first.", tags: ["Trading"], level: "warn" });
    return false
  }

  async function copyPlanToClipboard(){
    try{
      await navigator.clipboard.writeText(plan);
      setLastPlanBuiltAt(Date.now());
      pushNotif({ title: "Trading", body: "Plan copied to clipboard.", tags: ["Trading"], level: "success" });
      return true;
    }catch{
      try{
        const api:any = oddApi();
        if(api?.copyText){
          await api.copyText(plan);
          setLastPlanBuiltAt(Date.now());
          pushNotif({ title: "Trading", body: "Plan copied to clipboard.", tags: ["Trading"], level: "success" });
          return true;
        }
      }catch{}
      pushNotif({ title: "Trading", body: "Could not copy plan (clipboard blocked). Use Export .md instead.", tags: ["Trading"], level: "warn" });
      return false;
    }
  }

  return (
    <div className="grid mt-4" style={{ maxHeight: 430, overflow: "auto" }}>
      {rows.slice(0, 24).map((row) => {
        const selected = row.key === selectedKey;
        function focusBestContractHUD(){
    const best = pickBest(filteredContracts.length ? filteredContracts : allContracts, { maxAsk: inp.maxAsk, minOi: inp.minOi, targetSide: inp.targetSide }) || selectedContract;
    if(best?.key){
      setSelectedContractKey(best.key);
      setDrawerTab("detail");
      if(best.expiration && best.expiration !== inp.selectedExpiration) patch({ selectedExpiration: best.expiration });
      // scroll contracts into view
      setTimeout(() => document.getElementById("trading_contracts")?.scrollIntoView({ behavior:"smooth", block:"start" }), 120);
      pushNotif({ title: "Trading", body: `Focused ${best.symbol} ${best.side.toUpperCase()} ${best.strike}.`, tags: ["Trading"], level: "success" });
      return true;
    }
    pushNotif({ title: "Trading", body: "No contracts loaded yet — scan a symbol first.", tags: ["Trading"], level: "warn" });
    return false
  }

  async function copyPlanToClipboard(){
    try{
      await navigator.clipboard.writeText(plan);
      setLastPlanBuiltAt(Date.now());
      pushNotif({ title: "Trading", body: "Plan copied to clipboard.", tags: ["Trading"], level: "success" });
      return true;
    }catch{
      try{
        const api:any = oddApi();
        if(api?.copyText){
          await api.copyText(plan);
          setLastPlanBuiltAt(Date.now());
          pushNotif({ title: "Trading", body: "Plan copied to clipboard.", tags: ["Trading"], level: "success" });
          return true;
        }
      }catch{}
      pushNotif({ title: "Trading", body: "Could not copy plan (clipboard blocked). Use Export .md instead.", tags: ["Trading"], level: "warn" });
      return false;
    }
  }

  return (
          <button
            key={row.key}
            onClick={() => onPick(row.key)}
            style={{
              textAlign: "left",
              borderColor: selected ? "rgba(96,165,250,0.35)" : "var(--line)",
              background: selected ? "rgba(96,165,250,0.12)" : "rgba(15,22,34,0.35)",
            }}
          >
            <div className="cluster spread">
              <b>{row.side.toUpperCase()} {row.strike.toFixed(2)}</b>
              <span className={`badge ${row.side === "call" ? "good" : "bad"}`}>{formatMoney(row.ask)}</span>
            </div>
            <div className="small">To BE {formatPct(row.toBreakevenPct)} • OI {row.openInterest ?? "—"} • Δ {formatGreek(row.greeks?.delta)}</div>
          </button>
        );
      })}
    </div>
  );
}

function ContractDrawer({
  contract,
  chain,
  drawerTab,
  setDrawerTab,
  callRows,
  putRows,
  onPickContract,
  onOpenPublic,
  onFetchGreeks,
}: {
  contract: PublicContract | null;
  chain: PublicChainData | null;
  drawerTab: DrawerTab;
  setDrawerTab: (tab: DrawerTab) => void;
  callRows: PublicContract[];
  putRows: PublicContract[];
  onPickContract: (key: string) => void;
  onOpenPublic: () => void;
  onFetchGreeks: () => void;
}) {
  const greeks = contract?.greeks || emptyGreeks();
  function focusBestContractHUD(){
    const best = pickBest(filteredContracts.length ? filteredContracts : allContracts, { maxAsk: inp.maxAsk, minOi: inp.minOi, targetSide: inp.targetSide }) || selectedContract;
    if(best?.key){
      setSelectedContractKey(best.key);
      setDrawerTab("detail");
      if(best.expiration && best.expiration !== inp.selectedExpiration) patch({ selectedExpiration: best.expiration });
      // scroll contracts into view
      setTimeout(() => document.getElementById("trading_contracts")?.scrollIntoView({ behavior:"smooth", block:"start" }), 120);
      pushNotif({ title: "Trading", body: `Focused ${best.symbol} ${best.side.toUpperCase()} ${best.strike}.`, tags: ["Trading"], level: "success" });
      return true;
    }
    pushNotif({ title: "Trading", body: "No contracts loaded yet — scan a symbol first.", tags: ["Trading"], level: "warn" });
    return false
  }

  async function copyPlanToClipboard(){
    try{
      await navigator.clipboard.writeText(plan);
      setLastPlanBuiltAt(Date.now());
      pushNotif({ title: "Trading", body: "Plan copied to clipboard.", tags: ["Trading"], level: "success" });
      return true;
    }catch{
      try{
        const api:any = oddApi();
        if(api?.copyText){
          await api.copyText(plan);
          setLastPlanBuiltAt(Date.now());
          pushNotif({ title: "Trading", body: "Plan copied to clipboard.", tags: ["Trading"], level: "success" });
          return true;
        }
      }catch{}
      pushNotif({ title: "Trading", body: "Could not copy plan (clipboard blocked). Use Export .md instead.", tags: ["Trading"], level: "warn" });
      return false;
    }
  }

  return (
    <div id="trading_drawer" className="card optionDrawer tradingSectionCard" style={{ minHeight: 320 }}>
      <div className="cluster spread start">
        <div>
          <div style={{ fontWeight: 900, fontSize: 18 }}>Option drawer</div>
          <div className="small">Public/mobile-style side tabs for calls, puts, detail, and greeks.</div>
        </div>
        <div className="cluster">
          {isDesktop() && (
            <button onClick={() => void undockTrading("drawer", `Option drawer • ${chain?.symbol || ""}`)} title="Open the drawer in a separate window">
              Undock
            </button>
          )}
          {contract && <span className={`badge ${contract.side === "call" ? "good" : "bad"}`}>{contract.side.toUpperCase()}</span>}
        </div>
      </div>

      <div className="tabs mt-4" style={{ flexWrap: "wrap" }}>
        <button className={drawerTab === "calls" ? "tabBtn active" : "tabBtn"} onClick={() => setDrawerTab("calls")}>Calls</button>
        <button className={drawerTab === "puts" ? "tabBtn active" : "tabBtn"} onClick={() => setDrawerTab("puts")}>Puts</button>
        <button className={drawerTab === "detail" ? "tabBtn active" : "tabBtn"} onClick={() => setDrawerTab("detail")}>Detail</button>
        <button className={drawerTab === "greeks" ? "tabBtn active" : "tabBtn"} onClick={() => setDrawerTab("greeks")}>Greeks</button>
      </div>

      {drawerTab === "calls" && <DrawerList rows={callRows} selectedKey={contract?.key ?? null} onPick={onPickContract} />}
      {drawerTab === "puts" && <DrawerList rows={putRows} selectedKey={contract?.key ?? null} onPick={onPickContract} />}

      {drawerTab === "detail" && (
        !contract ? <div className="small mt-5">Click a contract row to load quote, breakeven, and chain detail here.</div> : (
          <div className="grid mt-5">
            <div>
              <div style={{ fontWeight: 900, fontSize: 18 }}>{contract.symbol} {contract.side.toUpperCase()} {contract.strike.toFixed(2)}</div>
              <div className="small">{contract.expiration || chain?.expirationLabel || "Expiry not loaded"} • {chain?.sourceMode === "public_api" ? "Public API" : "Public website delayed"}</div>
            </div>
            <div className="drawerStatGrid">
              <div className="drawerStat"><span className="small">Bid</span><b>{formatMoney(contract.bid)}</b></div>
              <div className="drawerStat"><span className="small">Ask</span><b>{formatMoney(contract.ask)}</b></div>
              <div className="drawerStat"><span className="small">Last</span><b>{formatMoney(contract.last)}</b></div>
              <div className="drawerStat"><span className="small">Breakeven</span><b>{formatMoney(contract.breakeven)}</b></div>
              <div className="drawerStat"><span className="small">To BE</span><b>{formatPct(contract.toBreakevenPct)}</b></div>
              <div className="drawerStat"><span className="small">OI / Vol</span><b>{contract.openInterest ?? "—"} / {contract.volume ?? "—"}</b></div>
              <div className="drawerStat"><span className="small">Scanner score</span><b>{contract.score.toFixed(1)}</b></div>
              <div className="drawerStat"><span className="small">OSI</span><b style={{ fontSize: 12 }}>{contract.osiSymbol || "—"}</b></div>
            </div>
            <div className="small">Feed updated: {formatTimestamp(chain?.feedUpdated)}</div>
            <div className="row wrap">
              <button onClick={onFetchGreeks}>Refresh greeks</button>
              <button onClick={onOpenPublic}>Open on Public</button>
            </div>
          </div>
        )
      )}

      {drawerTab === "greeks" && (
        !contract ? <div className="small mt-5">Pick a contract to inspect Δ / Γ / Θ / V / ρ / IV.</div> : (
          <div className="grid mt-5">
            <div className="drawerStatGrid">
              <div className="drawerStat"><span className="small">Delta</span><b>{formatGreek(greeks.delta)}</b></div>
              <div className="drawerStat"><span className="small">Gamma</span><b>{formatGreek(greeks.gamma)}</b></div>
              <div className="drawerStat"><span className="small">Theta</span><b>{formatGreek(greeks.theta)}</b></div>
              <div className="drawerStat"><span className="small">Vega</span><b>{formatGreek(greeks.vega)}</b></div>
              <div className="drawerStat"><span className="small">Rho</span><b>{formatGreek(greeks.rho)}</b></div>
              <div className="drawerStat"><span className="small">IV</span><b>{greeks.impliedVolatility !== null && greeks.impliedVolatility !== undefined ? `${(greeks.impliedVolatility * 100).toFixed(1)}%` : "—"}</b></div>
            </div>
      <div className="card tradingMiniCard">
              <div className="small"><b>Quick read:</b></div>
              <div className="small mt-2">Δ tells you directional sensitivity. Γ tells you how fast delta changes. Θ is daily decay pressure. V shows sensitivity to IV change. ρ is usually minor for short-dated contracts. IV spikes can juice premium even if price stalls.</div>
            </div>
            <div className="row wrap">
              <span className="badge">Δ {formatGreek(greeks.delta)}</span>
              <span className="badge">Γ {formatGreek(greeks.gamma)}</span>
              <span className="badge">Θ {formatGreek(greeks.theta)}</span>
              <span className="badge">V {formatGreek(greeks.vega)}</span>
              <span className="badge">ρ {formatGreek(greeks.rho)}</span>
              <span className="badge warn">IV {greeks.impliedVolatility !== null && greeks.impliedVolatility !== undefined ? `${(greeks.impliedVolatility * 100).toFixed(1)}%` : "—"}</span>
            </div>
          </div>
        )
      )}
    </div>
  );
}

export default function Trading() {
  const [inp, setInp] = useState<Input>(() => loadJSON(KEY, DEFAULTS));
  const [chain, setChain] = useState<PublicChainData | null>(null);
  const [selectedContractKey, setSelectedContractKey] = useState<string | null>(() => loadJSON<string | null>(UI_KEY, null as any)?.selectedContractKey ?? null);
  const [loading, setLoading] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [watchlistRows, setWatchlistRows] = useState<WatchlistRow[]>([]);
  const [watchlistBusy, setWatchlistBusy] = useState(false);
  const [accounts, setAccounts] = useState<PublicApiAccount[]>([]);
  const [expirations, setExpirations] = useState<string[]>([]);
  const [greeksBusy, setGreeksBusy] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const savedUi = loadJSON<any>(UI_KEY, null as any);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>(() => savedUi?.drawerTab || "detail");
  const [activeStrikeBucket, setActiveStrikeBucket] = useState<number | null>(() => savedUi?.activeStrikeBucket ?? null);
  const [lastPlanBuiltAt, setLastPlanBuiltAt] = useState<number | null>(null);
  const [lastScanAt, setLastScanAt] = useState<number | null>(null);
  const [ticketQty, setTicketQty] = useState<number>(1);
  const [ticketLimit, setTicketLimit] = useState<number | "">("");
  const [ticketAction, setTicketAction] = useState<"BUY" | "SELL">("BUY");
  const [ticketType, setTicketType] = useState<"MARKET" | "LIMIT" | "STOP" | "STOP_LIMIT">("LIMIT");
  const [ticketStop, setTicketStop] = useState<number | "">("");
  const [ticketRisk, setTicketRisk] = useState<number | "">(20);
  const [ticketStopLossPct, setTicketStopLossPct] = useState<number>(50);

  // Execution helpers (HUD-style): exit stop + take-profit ladder.
  const [ticketExitStop, setTicketExitStop] = useState<number | "">("");
  const [ticketTakeProfitPcts, setTicketTakeProfitPcts] = useState<number[]>([25, 50, 100]);
  const [ticketTpCustomPct, setTicketTpCustomPct] = useState<number>(35);

  const computeEntryPx = (c: any) => {
    const ask = c?.ask ?? 0;
    if (ticketType === "MARKET") return ask;
    if (ticketType === "LIMIT") return ticketLimit === "" ? ask : Number(ticketLimit);
    if (ticketType === "STOP") return ticketStop === "" ? ask : Number(ticketStop);
    // STOP_LIMIT
    return ticketLimit === "" ? ask : Number(ticketLimit);
  };

  const computeExitStopPx = (entryPx: number) => {
    if (!entryPx || entryPx <= 0) return 0;
    return Math.max(0, entryPx * (1 - ticketStopLossPct / 100));
  };

  const computeTpPx = (entryPx: number, pct: number) => {
    if (!entryPx || entryPx <= 0) return 0;
    return Math.max(0, entryPx * (1 + pct / 100));
  };


  useEffect(() => {
    // Undocked window support: scroll to the requested section.
    try{
      const qs = new URLSearchParams(window.location.search);
      const kind = (qs.get("undock") || "").trim();
      const map: Record<string,string> = { chart:"trading_chart", drawer:"trading_drawer", contracts:"trading_contracts", ticket:"trading_ticket" };
      const id = map[kind];
      if(!id) return;
      setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior:"smooth", block:"start" }), 200);
    }catch{}
  }, []);

  useEffect(() => {
    const snapshot = loadJSON<any>("odd.trading.chainSnapshot", null);
    const hydrated = hydrateChainFromSnapshot(snapshot);
    if (!hydrated) return;
    setChain((prev) => prev || hydrated);
    if (snapshot?.expiration) setExpirations((prev) => prev.length ? prev : [snapshot.expiration]);
    if (snapshot?.at && !lastScanAt) setLastScanAt(snapshot.at);
  }, []);

  const score = useMemo(() => {
    let s = 0.55 * inp.heat + 0.45 * inp.env;
    const trapCount = Object.values(inp.traps).filter(Boolean).length;
    s -= trapCount * 12;
    return clamp(Math.round(s));
  }, [inp]);

  const permission = useMemo(() => {
    if (inp.env >= 75) return "FULL ATTACK";
    if (inp.env >= 55) return "SELECTIVE";
    if (inp.env >= 40) return "LIGHT";
    return "NO TRADE";
  }, [inp.env]);

  const tier = useMemo(() => {
    if (score >= 80) return "GREENLIGHT";
    if (score >= 65) return "SMALL SIZE";
    if (score >= 50) return "WATCH";
    return "NO TRADE";
  }, [score]);

  const allContracts = useMemo(() => chain ? [...chain.calls, ...chain.puts] : [], [chain]);

  const filteredContracts = useMemo(() => {
    const filtered = allContracts.filter((c) => {
      if (inp.targetSide !== "all" && c.side !== inp.targetSide) return false;
      if (c.ask !== null && c.ask > inp.maxAsk) return false;
      if (c.openInterest !== null && c.openInterest < inp.minOi) return false;
      if (!contractMatchesSearch(c, inp.contractSearch)) return false;
      return true;
    });
    return sortContracts(filtered, inp.sortBy, { maxAsk: inp.maxAsk, minOi: inp.minOi, targetSide: inp.targetSide });
  }, [allContracts, inp.targetSide, inp.maxAsk, inp.minOi, inp.contractSearch, inp.sortBy]);

  const strikeGroups = useMemo(() => groupContractsByStrike(filteredContracts, inp.strikeGrouping), [filteredContracts, inp.strikeGrouping]);

  const visibleContracts = useMemo(() => {
    if (activeStrikeBucket === null || inp.strikeGrouping === "raw") return filteredContracts;
    const size = Number(inp.strikeGrouping);
    return filteredContracts.filter((c) => Math.round(c.strike / size) * size === activeStrikeBucket);
  }, [filteredContracts, activeStrikeBucket, inp.strikeGrouping]);

  const selectedContract = useMemo(() => {
    return visibleContracts.find((c) => c.key === selectedContractKey)
      ?? filteredContracts.find((c) => c.key === selectedContractKey)
      ?? visibleContracts[0]
      ?? filteredContracts[0]
      ?? null;
  }, [filteredContracts, visibleContracts, selectedContractKey]);

  useEffect(() => {
    if (!selectedContract) return;
    const ask = selectedContract.ask;
    if (typeof ask === "number" && isFinite(ask)) setTicketLimit(ask);
  }, [selectedContractKey]);

  const drawerCalls = useMemo(() => filteredContracts.filter((c) => c.side === "call").slice(0, 30), [filteredContracts]);
  const drawerPuts = useMemo(() => filteredContracts.filter((c) => c.side === "put").slice(0, 30), [filteredContracts]);

  const scannerSummary = useMemo(() => {
    if (!chain) return null;
    const cfg = { maxAsk: inp.maxAsk, minOi: inp.minOi, targetSide: inp.targetSide };
    return {
      bestCall: pickBest(chain.calls, cfg),
      bestPut: pickBest(chain.puts, cfg),
      contracts: chain.calls.length + chain.puts.length,
    };
  }, [chain, inp.maxAsk, inp.minOi, inp.targetSide]);

  const plan = useMemo(() => {
    const tf = inp.timeframe === "0dte" ? "0DTE" : "Weeklies";
    const bias = inp.bias === "bull" ? "Bullish" : inp.bias === "bear" ? "Bearish" : "Neutral";
    const traps = Object.entries(inp.traps).filter(([, v]) => v).map(([k]) => k).join(", ") || "None";
    const rec = tier === "NO TRADE" || permission === "NO TRADE" ? "NO TRADE" : `${tf} ${bias} ${inp.setup.replaceAll("_", " ")}`;
    const selectedGreekBlock = selectedContract ? [
      `Selected contract: ${selectedContract.symbol} ${selectedContract.side.toUpperCase()} ${selectedContract.strike}`,
      `Expiry: ${selectedContract.expiration || chain?.expirationLabel || "—"}`,
      `Bid/ask/last: ${formatMoney(selectedContract.bid)} / ${formatMoney(selectedContract.ask)} / ${formatMoney(selectedContract.last)}`,
      `Breakeven: ${formatMoney(selectedContract.breakeven)} | To breakeven: ${formatPct(selectedContract.toBreakevenPct)}`,
      `OI/vol: ${selectedContract.openInterest ?? "—"} / ${selectedContract.volume ?? "—"}`,
      `Greeks: Δ ${formatGreek(selectedContract.greeks?.delta)} | Γ ${formatGreek(selectedContract.greeks?.gamma)} | Θ ${formatGreek(selectedContract.greeks?.theta)} | IV ${selectedContract.greeks?.impliedVolatility !== null && selectedContract.greeks?.impliedVolatility !== undefined ? `${(selectedContract.greeks.impliedVolatility * 100).toFixed(1)}%` : "—"}`,
      `Data source: ${chain?.sourceMode === "public_api" ? "Public API real-time chain" : "Public website delayed chain"}`,
      "",
    ] : [];
    return [
      `# FairlyOdd Options Sniper Plan`,
      "",
      `Symbol: ${inp.symbol}`,
      `Bias: ${bias}`,
      `Timeframe: ${tf}`,
      `Setup: ${inp.setup.replaceAll("_", " ")}`,
      `Chart: ${inp.chartSymbol} @ ${inp.chartInterval}`,
      "",
      `Environment: ${inp.env}/100 → ${permission}`,
      `Heat: ${inp.heat}/100`,
      `Trap flags: ${traps}`,
      `Composite Score: ${score}/100 → ${tier}`,
      "",
      `Recommendation: ${rec}`,
      "",
      ...selectedGreekBlock,
      `Levels / context:`,
      inp.levels || "(add levels: PDH/PDL, premarket, VWAP, key S/R)",
      "",
      `Notes:`,
      inp.notes || "(optional)",
      "",
      `Entry: Trigger: reclaim/hold level + confirmation candle. Use limit orders.`,
      `Invalidation: lose key level / VWAP flip against you.`,
      `Risk: 1–2 contracts max until GREENLIGHT. Stop after 2 losses or daily max loss hit.`,
      `Exits: scale 30–50% at +30–50%, trail remainder to next level.`,
      "",
    ].join("\n");
  }, [chain?.expirationLabel, chain?.sourceMode, inp, permission, score, selectedContract, tier]);

  function handlePanelAction(envelope: PanelActionEnvelope) {
    try {
      if (envelope.actionId === "trading:safer-setup") {
        const saferSide = inp.bias === "bull" ? "call" : inp.bias === "bear" ? "put" : "all";
        patch({
          timeframe: inp.timeframe === "0dte" ? "weeklies" : inp.timeframe,
          maxAsk: Math.min(Math.max(Number(inp.maxAsk || 0), 0), 3),
          minOi: Math.max(Number(inp.minOi || 0), 250),
          targetSide: saferSide,
          sortBy: "score",
          contractSearch: "",
          strikeGrouping: "raw",
        });
        setActiveStrikeBucket(null);
        setDrawerTab("detail");
        pushNotif({ title: "Trading", body: `AI applied safer filters for ${inp.symbol || "your scanner"}.`, tags: ["Trading", "AI"], level: "success" });
      }
      if (envelope.actionId === "trading:focus-best") {
        const best = pickBest(filteredContracts.length ? filteredContracts : allContracts, { maxAsk: inp.maxAsk, minOi: inp.minOi, targetSide: inp.targetSide }) || selectedContract;
        if (best?.key) {
          setSelectedContractKey(best.key);
          setDrawerTab("detail");
          if (best.expiration && best.expiration !== inp.selectedExpiration) patch({ selectedExpiration: best.expiration });
          pushNotif({ title: "Trading", body: `AI focused ${best.symbol} ${best.side.toUpperCase()} ${best.strike}.`, tags: ["Trading", "AI"], level: "success" });
        } else {
          pushNotif({ title: "Trading", body: "No contract is loaded yet — scan a symbol or use the saved chain snapshot first.", tags: ["Trading", "AI"], level: "warn" });
        }
      }
      if (envelope.actionId === "trading:build-plan") {
        const contract = selectedContract || pickBest(filteredContracts.length ? filteredContracts : allContracts, { maxAsk: inp.maxAsk, minOi: inp.minOi, targetSide: inp.targetSide });
        if (!contract && !allContracts.length) {
          const aiPrompt = [
            `AI plan blocked for ${inp.symbol || "Trading"}.`,
            `Reason: no options chain is loaded yet.`,
            `Next step: scan a symbol or restore a saved chain snapshot, then rerun the planning chain.`,
          ].join("\n");
          patch({ notes: aiPrompt });
          pushNotif({ title: "Trading", body: "No chain is loaded yet — AI wrote the next step into Notes instead of drafting a weak plan.", tags: ["Trading", "AI"], level: "warn" });
          return;
        }
        const aiPlan = [
          `AI thesis for ${inp.symbol}`,
          `Bias: ${inp.bias.toUpperCase()} • Setup: ${inp.setup.replaceAll("_", " ")} • Timeframe: ${inp.timeframe.toUpperCase()}`,
          contract ? `Best fit: ${contract.symbol} ${contract.side.toUpperCase()} ${contract.strike} • ask ${formatMoney(contract.ask)} • OI ${contract.openInterest ?? "—"}` : "Best fit: load a fresher chain to lock a contract.",
          `Risk box: env ${inp.env}/100 • heat ${inp.heat}/100 • permission ${permission} • tier ${tier}`,
          `Execution: wait for confirmation at your level map, keep size small, and honor invalidation fast.`,
        ].join("\n");
        patch({ notes: aiPlan });
        pushNotif({ title: "Trading", body: "AI drafted a tighter trade plan into Notes.", tags: ["Trading", "AI"], level: "success" });
      }
    } finally {
      acknowledgePanelAction(envelope.id);
    }
  }

  useEffect(() => {
    [...getPanelActions("Trading")].reverse().forEach(handlePanelAction);
    const onAction = (evt: Event) => {
      const detail = (evt as CustomEvent<PanelActionEnvelope>).detail;
      if (detail?.panelId === "Trading") handlePanelAction(detail);
    };
    window.addEventListener(PANEL_ACTION_EVENT, onAction as EventListener);
    return () => window.removeEventListener(PANEL_ACTION_EVENT, onAction as EventListener);
  }, [allContracts, filteredContracts, inp, permission, selectedContract, tier]);

  useEffect(() => {
    saveJSON(UI_KEY, { selectedContractKey, drawerTab, activeStrikeBucket });
  }, [selectedContractKey, drawerTab, activeStrikeBucket]);

  function save(next: Input = inp) {
    saveJSON(KEY, next);
  }

  function patch(nextPatch: Partial<Input>) {
    setInp((prev) => {
      const next = { ...prev, ...nextPatch };
      save(next);
      return next;
    });
  }

  async function enrichWithWebsiteMeta(symbol: string) {
    try {
      const url = buildPublicChainUrl(symbol);
      const html = await requestText({ url, timeoutMs: 12000, maxBytes: 3_000_000 });
      const parsed = parsePublicOptionsHtml(html, symbol, url);
      return { spot: parsed.spot, companyName: parsed.companyName, expirations: parsed.expirations.map((e) => e.label), feedUpdated: parsed.feedUpdated, sourceUrl: url };
    } catch {
      return { spot: null, companyName: null, expirations: [] as string[], feedUpdated: null, sourceUrl: buildPublicChainUrl(symbol) };
    }
  }

  async function loadChainWebsite(symbol: string): Promise<ChainLoadResult> {
    const url = buildPublicChainUrl(symbol);
    const html = await requestText({ url, timeoutMs: 16000, maxBytes: 3_500_000 });
    const parsed = parsePublicOptionsHtml(html, symbol, url);
    const expirationsOut = parsed.expirations.map((e) => e.label).filter(Boolean);
    return { chain: parsed, expirations: expirationsOut };
  }

  async function loadChainApi(symbol: string, expirationArg?: string): Promise<ChainLoadResult> {
    if (!inp.publicAccessToken || !inp.publicAccountId) throw new Error("Public API mode needs an access token and accountId.");
    const meta = await enrichWithWebsiteMeta(symbol);
    const expList = await fetchPublicExpirations(inp.publicAccessToken, inp.publicAccountId, symbol);
    const selectedExpiration = expirationArg || inp.selectedExpiration || expList[0];
    if (!selectedExpiration) throw new Error("No expirations returned for this symbol.");
    const apiChain = await fetchPublicOptionChain(inp.publicAccessToken, inp.publicAccountId, symbol, selectedExpiration);
    const chainOut = buildApiChainData({
      symbol,
      expirationDate: selectedExpiration,
      api: apiChain,
      expirations: expList,
      spot: meta.spot,
      companyName: meta.companyName,
      sourceUrl: meta.sourceUrl,
      feedUpdated: meta.feedUpdated,
    });
    return { chain: chainOut, expirations: expList };
  }

  async function scanSymbol(symbolArg?: string, expirationArg?: string) {
    const symbol = (symbolArg || inp.symbol).trim().toUpperCase();
    if (!symbol) return;
    setLoading(true);
    setScanError(null);
    try {
      const result = inp.dataMode === "api" ? await loadChainApi(symbol, expirationArg) : await loadChainWebsite(symbol);
      setChain(result.chain);
      persistTradingSnapshot(result.chain);
      setExpirations(result.expirations);
      setLastScanAt(Date.now());
      const nextExp = expirationArg || result.chain.expirationLabel || result.expirations[0] || "";
      setSelectedContractKey(null);
      setActiveStrikeBucket(null);
      patch({ symbol, chartSymbol: normalizePublicChartSymbol(symbol), selectedExpiration: nextExp });
    } catch (err) {
      setScanError(err instanceof Error ? err.message : String(err));
      setChain(null);
    } finally {
      setLoading(false);
    }
  }

  async function scanWatchlist() {
    const symbols = uniqSymbols(inp.watchlist);
    if (!symbols.length) return;
    setWatchlistBusy(true);
    setScanError(null);
    const rows: WatchlistRow[] = [];
    try {
      for (const symbol of symbols) {
        try {
          const result = inp.dataMode === "api" ? await loadChainApi(symbol, inp.selectedExpiration) : await loadChainWebsite(symbol);
          const cfg = { maxAsk: inp.maxAsk, minOi: inp.minOi, targetSide: inp.targetSide };
          rows.push({
            symbol,
            companyName: result.chain.companyName,
            sourceUrl: result.chain.sourceUrl,
            spot: result.chain.spot,
            expiration: result.chain.expirationLabel,
            feedUpdated: result.chain.feedUpdated,
            bestCall: pickBest(result.chain.calls, cfg),
            bestPut: pickBest(result.chain.puts, cfg),
          });
        } catch (err) {
          rows.push({
            symbol,
            companyName: null,
            sourceUrl: buildPublicChainUrl(symbol),
            spot: null,
            expiration: null,
            feedUpdated: null,
            bestCall: null,
            bestPut: null,
            error: err instanceof Error ? err.message : String(err),
          });
        }
        setWatchlistRows([...rows]);
      }
    } finally {
      setWatchlistBusy(false);
    }
  }

  async function handleCreateAccessToken() {
    if (!inp.publicSecretKey.trim()) {
      setScanError("Paste your Public secret key first.");
      return;
    }
    setAuthBusy(true);
    setScanError(null);
    try {
      const token = await createPublicAccessToken(inp.publicSecretKey.trim());
      patch({ publicAccessToken: token });
      const nextAccounts = await fetchPublicAccounts(token);
      setAccounts(nextAccounts);
      if (nextAccounts[0]?.accountId) patch({ publicAccountId: nextAccounts[0].accountId });
    } catch (err) {
      setScanError(err instanceof Error ? err.message : String(err));
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleLoadAccounts() {
    if (!inp.publicAccessToken.trim()) {
      setScanError("Paste or create an access token first.");
      return;
    }
    setAuthBusy(true);
    setScanError(null);
    try {
      const nextAccounts = await fetchPublicAccounts(inp.publicAccessToken.trim());
      setAccounts(nextAccounts);
      if (nextAccounts[0]?.accountId) patch({ publicAccountId: nextAccounts[0].accountId });
    } catch (err) {
      setScanError(err instanceof Error ? err.message : String(err));
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleLoadExpirations() {
    if (inp.dataMode !== "api") {
      setScanError("Expiration picker is real-time in Public API mode. Switch to API mode or scan the website chain.");
      return;
    }
    if (!inp.publicAccessToken || !inp.publicAccountId) {
      setScanError("Public API mode needs access token + accountId.");
      return;
    }
    setLoading(true);
    setScanError(null);
    try {
      const list = await fetchPublicExpirations(inp.publicAccessToken, inp.publicAccountId, inp.symbol.trim().toUpperCase());
      setExpirations(list);
      if (!inp.selectedExpiration && list[0]) patch({ selectedExpiration: list[0] });
    } catch (err) {
      setScanError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function refreshGreeks(forceAll = false) {
    if (!chain || inp.dataMode !== "api") return;
    if (!inp.publicAccessToken || !inp.publicAccountId) return;
    const rows = forceAll ? filteredContracts.slice(0, 120) : (selectedContract ? [selectedContract] : filteredContracts.slice(0, 40));
    const osiSymbols = rows.map((r) => r.osiSymbol).filter(Boolean) as string[];
    if (!osiSymbols.length) return;
    setGreeksBusy(true);
    try {
      const greekMap = await fetchPublicGreeks(inp.publicAccessToken, inp.publicAccountId, osiSymbols);
      setChain((prev) => mergeGreeksIntoChain(prev, greekMap));
    } catch (err) {
      setScanError(err instanceof Error ? err.message : String(err));
    } finally {
      setGreeksBusy(false);
    }
  }

  useEffect(() => {
    if (inp.chartSymbol === DEFAULTS.chartSymbol && inp.symbol !== DEFAULTS.symbol) patch({ chartSymbol: normalizePublicChartSymbol(inp.symbol) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (inp.strikeGrouping === "raw") setActiveStrikeBucket(null);
  }, [inp.strikeGrouping]);

  const spotlightContracts = useMemo(() => filteredContracts.slice(0, 3), [filteredContracts]);
  const bestContract = selectedContract || spotlightContracts[0] || null;
  const spreadPct = useMemo(() => {
    if (!bestContract || bestContract.ask == null || bestContract.bid == null || !bestContract.ask) return null;
    return ((bestContract.ask - bestContract.bid) / Math.max(bestContract.ask, 0.01)) * 100;
  }, [bestContract]);
  const watchNarrative = useMemo(() => {
    if (!chain) return "Load a chain to generate a FairlyOdd thesis card and attack plan.";
    const lead = spotlightContracts[0];
    const side = lead ? lead.side.toUpperCase() : "MIXED";
    const exp = chain.expirationLabel || inp.selectedExpiration || "next expiry";
    return `${chain.symbol || inp.symbol} is in ${tier} mode with ${filteredContracts.length} filtered contracts. ${lead ? `Best current fit is a ${side} ${lead.strike.toFixed(2)} into ${exp}.` : `Scan a cleaner chain for ${exp}.`}`;
  }, [chain, filteredContracts.length, inp.selectedExpiration, inp.symbol, spotlightContracts, tier]);

  useEffect(() => {
    if (!selectedContract?.osiSymbol || inp.dataMode !== "api") return;
    const hasGreeks = selectedContract.greeks && selectedContract.greeks.delta !== null && selectedContract.greeks.delta !== undefined;
    if (hasGreeks) return;
    void refreshGreeks(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedContract?.osiSymbol, inp.dataMode]);

  function focusBestContractHUD(){
    const best = pickBest(filteredContracts.length ? filteredContracts : allContracts, { maxAsk: inp.maxAsk, minOi: inp.minOi, targetSide: inp.targetSide }) || selectedContract;
    if(best?.key){
      setSelectedContractKey(best.key);
      setDrawerTab("detail");
      if(best.expiration && best.expiration !== inp.selectedExpiration) patch({ selectedExpiration: best.expiration });
      // scroll contracts into view
      setTimeout(() => document.getElementById("trading_contracts")?.scrollIntoView({ behavior:"smooth", block:"start" }), 120);
      pushNotif({ title: "Trading", body: `Focused ${best.symbol} ${best.side.toUpperCase()} ${best.strike}.`, tags: ["Trading"], level: "success" });
      return true;
    }
    pushNotif({ title: "Trading", body: "No contracts loaded yet — scan a symbol first.", tags: ["Trading"], level: "warn" });
    return false
  }

  async function copyPlanToClipboard(){
    try{
      await navigator.clipboard.writeText(plan);
      setLastPlanBuiltAt(Date.now());
      pushNotif({ title: "Trading", body: "Plan copied to clipboard.", tags: ["Trading"], level: "success" });
      return true;
    }catch{
      try{
        const api:any = oddApi();
        if(api?.copyText){
          await api.copyText(plan);
          setLastPlanBuiltAt(Date.now());
          pushNotif({ title: "Trading", body: "Plan copied to clipboard.", tags: ["Trading"], level: "success" });
          return true;
        }
      }catch{}
      pushNotif({ title: "Trading", body: "Could not copy plan (clipboard blocked). Use Export .md instead.", tags: ["Trading"], level: "warn" });
      return false;
    }
  }

  return (
    <div className="card tradingPanelRoot">
      <div className="tradingHeroBar">
        <div>
          <div className="small shellEyebrow">TRADING DESK</div>
          <div className="tradingHeroTitle">Trading</div>
          <div className="small tradingHeroSub">Public API mode + better expiration tabs + contract search + strike grouping + mobile-style calls/puts/detail/greeks drawer.</div>
        </div>
        <div className="row wrap tradingHeroBadges" style={{ justifyContent: "flex-end" }}>
          <span className={`badge ${inp.dataMode === "api" ? "good" : "warn"}`}>{inp.dataMode === "api" ? "Public API mode" : "Public website fallback"}</span>
          <span className={`badge ${tier === "GREENLIGHT" ? "good" : tier === "NO TRADE" ? "bad" : "warn"}`}>{tier} • {score}</span>
          <span className="badge">Symbol {chain?.symbol || inp.symbol}</span>
          <span className="badge">{selectedContract ? `${selectedContract.side.toUpperCase()} ${selectedContract.strike.toFixed(2)}` : "No contract selected"}</span>
        </div>
      </div>

      <div className="quickActionGrid mt-5">
      <div className="card spotlightCard tradingSpotlightCard" style={{ border: "1px solid rgba(255,255,255,0.08)", background: "linear-gradient(135deg, rgba(255,80,190,0.10), rgba(0,210,255,0.06), rgba(255,200,80,0.06))" }}>
        <div className="small shellEyebrow">Trading HUD Wizard</div>
        <div className="cardTitle18 mt-1">Load chain → Pick contract → Build plan</div>
        <div className="cluster wrap mt-4">
          <span className={`badge ${chain ? "good" : "warn"}`}>1) Chain {chain ? "✅ loaded" : "—"} {chain ? `• ${sinceMs(lastScanAt)}` : ""}</span>
          <span className={`badge ${(selectedContractKey && selectedContract) ? "good" : "warn"}`}>2) Contract {(selectedContractKey && selectedContract) ? "✅ selected" : "—"} {(selectedContractKey && selectedContract) ? `• ${selectedContract?.symbol || ""}` : ""}</span>
          <span className={`badge ${lastPlanBuiltAt ? "good" : "warn"}`}>3) Plan {lastPlanBuiltAt ? "✅ built" : "—"} {lastPlanBuiltAt ? `• ${sinceMs(lastPlanBuiltAt)}` : ""}</span>
        </div>
        <div className="cluster wrap loose mt-5">
          <button className={chain ? "tabBtn" : "tabBtn active"} onClick={() => void scanSymbol(undefined, inp.selectedExpiration)} disabled={loading}>{loading ? "Scanning…" : chain ? "Reload chain" : "Load chain"}</button>
          <button className={(selectedContractKey && selectedContract) ? "tabBtn" : "tabBtn active"} onClick={() => focusBestContractHUD()} disabled={!chain && !allContracts.length}>Focus best contract</button>
          <button className={lastPlanBuiltAt ? "tabBtn" : "tabBtn active"} onClick={() => { void copyPlanToClipboard(); setTimeout(() => document.getElementById("trading_plan")?.scrollIntoView({ behavior:"smooth", block:"start" }), 120); }} disabled={!chain && !selectedContract}>Build plan</button>
          {isDesktop() && (
            <button className="tabBtn" onClick={() => void undockTrading("ticket", `Order Ticket • ${chain?.symbol || inp.symbol}`)} disabled={!selectedContract}>Open order ticket</button>
          )}
          <button className="tabBtn" onClick={() => { setTimeout(() => document.getElementById("trading_source")?.scrollIntoView({ behavior:"smooth", block:"start" }), 120); }}>Setup</button>
        </div>
        <div className="small mt-4" style={{ opacity: 0.9, lineHeight: 1.45 }}>
          Tip: hit <b>Focus best contract</b> after scanning to auto-highlight the best call/put under your filters. Then <b>Build plan</b> copies a ready-to-send plan.
        </div>
      </div>

        <div className="card spotlightCard">
          <div className="small shellEyebrow">Trade thesis</div>
          <div className="cardTitle18 mt-1">FairlyOdd attack plan</div>
          <div className="small mt-3" style={{ lineHeight: 1.5 }}>{watchNarrative}</div>
          <div className="assistantChipWrap">
            <span className={`badge ${tier === "GREENLIGHT" ? "good" : tier === "NO TRADE" ? "bad" : "warn"}`}>{tier}</span>
            <span className="badge">{filteredContracts.length} filtered</span>
            {bestContract && <span className={`badge ${bestContract.side === "call" ? "good" : "bad"}`}>{bestContract.side.toUpperCase()} {bestContract.strike.toFixed(2)}</span>}
          </div>
        </div>
        <div className="card spotlightCard">
          <div className="small shellEyebrow">Best contract</div>
          <div className="cardTitle18 mt-1">{bestContract ? `${bestContract.symbol} ${bestContract.side.toUpperCase()} ${bestContract.strike.toFixed(2)}` : "No contract locked"}</div>
          <div className="small mt-3" style={{ lineHeight: 1.5 }}>{bestContract ? `Ask ${formatMoney(bestContract.ask)} • OI ${bestContract.openInterest ?? "—"} • Volume ${bestContract.volume ?? "—"} • To BE ${formatPct(bestContract.toBreakevenPct)}` : "Run a fresh scan or load a chain snapshot to lock the best contract."}</div>
          <div className="assistantChipWrap">
            <span className={`badge ${spreadPct != null && spreadPct > 12 ? "warn" : "good"}`}>{spreadPct != null ? `Spread ${spreadPct.toFixed(1)}%` : "Spread waiting"}</span>
            <span className="badge">Score {bestContract ? bestContract.score.toFixed(1) : "—"}</span>
          </div>
        </div>
        <div className="card spotlightCard">
          <div className="small shellEyebrow">Journal snapshot</div>
          <div className="cardTitle18 mt-1">Execution guardrails</div>
          <div className="small mt-3" style={{ lineHeight: 1.5 }}>{bestContract ? `Plan the entry only if price confirms and the spread stays under control. If the spread is wide or the drawer is empty, switch into safer setup mode first.` : `No chain loaded yet. Use scan symbol, then focus the best contract before building a plan.`}</div>
          <div className="cluster wrap mt-4">
            <button className="tabBtn active" onClick={() => window.dispatchEvent(new CustomEvent("oddengine:run-command", { detail: { text: "run trading chain" } }))}>Run trading chain</button>
            <button className="tabBtn" onClick={() => window.dispatchEvent(new CustomEvent("oddengine:run-command", { detail: { text: "build trade plan" } }))}>Build trade plan</button>
          </div>
        </div>
      </div>

      <div className="grid2 mt-5" style={{ alignItems: "stretch" }}>
        <div id="trading_chart" className="card tradingSectionCard">
          <div className="cluster spread">
            <div>
              <div style={{ fontWeight: 900 }}>TradingView-style chart</div>
              <div className="small">Free advanced chart widget with symbol switch + interval controls.</div>
            </div>
            <div className="cluster">
              {isDesktop() && (
                <button onClick={() => void undockTrading("chart", `Chart • ${inp.chartSymbol}`)} title="Open this chart in a separate window">
                  Undock
                </button>
              )}
              <button onClick={() => void openExternal(`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(inp.chartSymbol)}`)}>Open chart</button>
            </div>
          </div>
          <div className="row mt-4">
            <div style={{ flex: 1 }}>
              <label className="small">Chart symbol</label>
              <input value={inp.chartSymbol} onChange={(e) => patch({ chartSymbol: e.target.value.toUpperCase() })} placeholder="AMEX:SPY" />
            </div>
            <div style={{ width: 130 }}>
              <label className="small">Interval</label>
              <select value={inp.chartInterval} onChange={(e) => patch({ chartInterval: e.target.value })}>
                <option value="1">1m</option>
                <option value="5">5m</option>
                <option value="15">15m</option>
                <option value="60">1h</option>
                <option value="240">4h</option>
                <option value="1D">1D</option>
              </select>
            </div>
          </div>
          <div className="mt-4">
            <TradingViewChart symbol={inp.chartSymbol} interval={inp.chartInterval} />
          </div>
        </div>

        <div id="trading_source" className="card tradingSectionCard">
          <div className="cluster spread start">
            <div>
              <div style={{ fontWeight: 900 }}>Public source + expiration flow</div>
              <div className="small">Website mode works with no key. API mode unlocks real expiration dates, richer chain data, and greeks.</div>
            </div>
            <div className="cluster tight">
              <button className={inp.dataMode === "website" ? "tabBtn active" : "tabBtn"} onClick={() => patch({ dataMode: "website" })}>Website</button>
              <button className={inp.dataMode === "api" ? "tabBtn active" : "tabBtn"} onClick={() => patch({ dataMode: "api" })}>API</button>
            </div>
          </div>

          <div className="grid2 mt-5">
            <div>
              <label className="small">Active symbol</label>
              <input value={inp.symbol} onChange={(e) => patch({ symbol: e.target.value.toUpperCase(), chartSymbol: normalizePublicChartSymbol(e.target.value.toUpperCase()) })} />
            </div>
            <div>
              <label className="small">Expiration</label>
              <div className="row">
                <select value={inp.selectedExpiration} onChange={(e) => patch({ selectedExpiration: e.target.value })}>
                  <option value="">{inp.dataMode === "api" ? "Load expirations" : "Website picks current page expiry"}</option>
                  {expirations.map((exp) => <option key={exp} value={exp}>{exp}</option>)}
                </select>
                <button onClick={() => void handleLoadExpirations()} disabled={loading}>{loading ? "…" : "Load"}</button>
              </div>
            </div>
          </div>

          {expirations.length > 0 && (
            <div className="mt-4">
              <div className="small">Expiration tabs</div>
              <div className="tabs mt-2" style={{ flexWrap: "wrap" }}>
                {expirations.slice(0, 12).map((exp, idx) => (
                  <button
                    key={exp}
                    className={inp.selectedExpiration === exp ? "tabBtn active" : "tabBtn"}
                    onClick={() => {
                      patch({ selectedExpiration: exp });
                      if (inp.dataMode === "api") void scanSymbol(undefined, exp);
                    }}
                    title={exp}
                  >
                    {formatExpirationChip(exp, idx)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {inp.dataMode === "api" && (
            <div className="card tradingMiniCard mt-5">
              <div style={{ fontWeight: 800 }}>Public API key mode</div>
              <div className="small mt-1">Paste your secret key to mint a short-lived access token, then pull accountId + option expirations directly in Desktop mode.</div>
              <div className="mt-4">
                <label className="small">Secret key</label>
                <input type="password" value={inp.publicSecretKey} onChange={(e) => patch({ publicSecretKey: e.target.value })} placeholder="Public secret key" />
              </div>
              <div className="row wrap mt-4">
                <button onClick={() => void handleCreateAccessToken()} disabled={authBusy}>{authBusy ? "Authorizing…" : "Create access token"}</button>
                <button onClick={() => void handleLoadAccounts()} disabled={authBusy}>{authBusy ? "Loading…" : "Load accounts"}</button>
              </div>
              <div className="mt-4">
                <label className="small">Access token</label>
                <input type="password" value={inp.publicAccessToken} onChange={(e) => patch({ publicAccessToken: e.target.value })} placeholder="Bearer token" />
              </div>
              <div className="mt-4">
                <label className="small">Account ID</label>
                <div className="row">
                  <input value={inp.publicAccountId} onChange={(e) => patch({ publicAccountId: e.target.value })} placeholder="accountId" />
                  <select value={inp.publicAccountId} onChange={(e) => patch({ publicAccountId: e.target.value })}>
                    <option value="">Detected accounts</option>
                    {accounts.map((acct) => <option key={acct.accountId} value={acct.accountId}>{acct.accountId} • {acct.optionsLevel || acct.accountType || "acct"}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          <div className="row wrap mt-5">
            <button onClick={() => void scanSymbol(undefined, inp.selectedExpiration)} disabled={loading}>{loading ? "Scanning…" : "Scan symbol"}</button>
            <button onClick={() => void scanWatchlist()} disabled={watchlistBusy}>{watchlistBusy ? "Scanning watchlist…" : "Scan watchlist"}</button>
            <button onClick={() => void refreshGreeks(true)} disabled={greeksBusy || inp.dataMode !== "api"}>{greeksBusy ? "Loading greeks…" : "Refresh greeks"}</button>
            <button onClick={() => void openExternal(buildPublicChainUrl(inp.symbol))}>Open on Public</button>
          </div>
          {scanError && <div className="small mt-4" style={{ color: "var(--bad)" }}>⚠️ {scanError}</div>}
          {!scanError && inp.dataMode === "website" && <div className="small mt-4">Website mode is the no-key fallback. Public says website chain pages display 15-minute delayed data, while authenticated API mode exposes option expirations, option chain, and greeks.</div>}
        </div>
      </div>

      <div className="grid2 mt-5">
        <div className="card tradingSectionCard">
          <div className="cluster spread start">
            <div>
              <div style={{ fontWeight: 900 }}>Scanner snapshot</div>
              <div className="small">Expiration tabs + search + side filters + watchlist scan.</div>
            </div>
            {chain?.expirationLabel && <span className="badge warn">{chain.expirationLabel}</span>}
          </div>
          {!chain && <div className="small mt-3">No chain loaded yet. Hit <b>Scan symbol</b> to pull Public chain data into charts and the contracts table.</div>}
          {chain && (
            <div className="grid mt-4">
              <div className="row wrap">
                <span className="badge good">{chain.symbol}</span>
                {chain.companyName && <span className="badge">{chain.companyName}</span>}
                {chain.spot !== null && <span className="badge warn">Spot {formatMoney(chain.spot)}</span>}
                <span className="badge">{chain.calls.length} calls</span>
                <span className="badge">{chain.puts.length} puts</span>
              </div>
              <div className="small">Feed: {chain.feedUpdated ?? (chain.sourceMode === "public_api" ? "Public API" : "Public website delayed data")}</div>
              {scannerSummary?.bestCall && <div className="small"><b>Best call:</b> {scannerSummary.bestCall.strike} @ {formatMoney(scannerSummary.bestCall.ask)} • OI {scannerSummary.bestCall.openInterest ?? "—"} • Δ {formatGreek(scannerSummary.bestCall.greeks?.delta)}</div>}
              {scannerSummary?.bestPut && <div className="small"><b>Best put:</b> {scannerSummary.bestPut.strike} @ {formatMoney(scannerSummary.bestPut.ask)} • OI {scannerSummary.bestPut.openInterest ?? "—"} • Δ {formatGreek(scannerSummary.bestPut.greeks?.delta)}</div>}
            </div>
          )}
        </div>

        <ContractDrawer
          contract={selectedContract}
          chain={chain}
          drawerTab={drawerTab}
          setDrawerTab={setDrawerTab}
          callRows={drawerCalls}
          putRows={drawerPuts}
          onPickContract={(key) => {
            setSelectedContractKey(key);
            setDrawerTab("detail");
          }}
          onOpenPublic={() => void openExternal(buildPublicChainUrl(inp.symbol))}
          onFetchGreeks={() => void refreshGreeks(false)}
        />
      </div>

      <div className="grid2 mt-5">
        <div className="card tradingSectionCard">
          <div style={{ fontWeight: 900, marginBottom: 8 }}>Strike / premium curve</div>
          <OptionCurveChart chain={chain} selectedKey={selectedContract?.key ?? null} />
        </div>
        <div className="card tradingSectionCard">
          <div style={{ fontWeight: 900, marginBottom: 8 }}>Open interest bars</div>
          <OiBarChart contracts={visibleContracts} selectedKey={selectedContract?.key ?? null} />
        </div>
      </div>

      <div id="trading_contracts" className="card tradingSectionCard mt-5">
        <div className="cluster spread start">
          <div>
            <div style={{ fontWeight: 900 }}>Contracts</div>
            <div className="small">Search contracts, group strikes, then click a row to pin it into the Sniper plan and drawer.</div>
          </div>
          <div className="cluster loose">
            {isDesktop() && (
              <button onClick={() => void undockTrading("contracts", `Contracts • ${chain?.symbol || ""}`)} title="Open the contracts table in a separate window">
                Undock
              </button>
            )}
            <div className="small">Showing {visibleContracts.length} rows after filters</div>
          </div>
        </div>

        <div className="grid2 mt-4">
          <div className="row">
            <div style={{ flex: 1 }}>
              <label className="small">Contract search</label>
              <input value={inp.contractSearch} onChange={(e) => patch({ contractSearch: e.target.value })} placeholder="strike, OSI, call, put, expiry..." />
            </div>
            <div style={{ width: 180 }}>
              <label className="small">Strike grouping</label>
              <select value={inp.strikeGrouping} onChange={(e) => patch({ strikeGrouping: e.target.value as Input["strikeGrouping"] })}>
                <option value="raw">Raw contracts</option>
                <option value="1">$1 buckets</option>
                <option value="2.5">$2.50 buckets</option>
                <option value="5">$5 buckets</option>
                <option value="10">$10 buckets</option>
              </select>
            </div>
          </div>
          <div className="row">
            <div style={{ flex: 1 }}>
              <label className="small">Max ask</label>
              <input type="number" min="0" step="0.05" value={inp.maxAsk} onChange={(e) => patch({ maxAsk: Number(e.target.value || 0) })} />
            </div>
            <div style={{ flex: 1 }}>
              <label className="small">Min open interest</label>
              <input type="number" min="0" step="1" value={inp.minOi} onChange={(e) => patch({ minOi: Number(e.target.value || 0) })} />
            </div>
          </div>
          <div className="row">
            <div style={{ flex: 1 }}>
              <label className="small">Target side</label>
              <select value={inp.targetSide} onChange={(e) => patch({ targetSide: e.target.value as Input["targetSide"] })}>
                <option value="all">All</option>
                <option value="call">Calls</option>
                <option value="put">Puts</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label className="small">Sort</label>
              <select value={inp.sortBy} onChange={(e) => patch({ sortBy: e.target.value as Input["sortBy"] })}>
                <option value="score">Scanner score</option>
                <option value="oi">Open interest</option>
                <option value="ask">Lowest ask</option>
                <option value="dayChange">1D change</option>
                <option value="delta">Delta</option>
                <option value="strike">Strike</option>
              </select>
            </div>
          </div>
        </div>

        {inp.strikeGrouping !== "raw" && strikeGroups.length > 0 && (
          <div className="mt-4">
            <div className="small">Strike grouping</div>
            <div className="tabs mt-2" style={{ flexWrap: "wrap" }}>
              <button className={activeStrikeBucket === null ? "tabBtn active" : "tabBtn"} onClick={() => setActiveStrikeBucket(null)}>All groups</button>
              {strikeGroups.slice(0, 18).map((group) => (
                <button
                  key={group.bucket}
                  className={activeStrikeBucket === group.bucket ? "tabBtn active" : "tabBtn"}
                  onClick={() => {
                    setActiveStrikeBucket(group.bucket);
                    if (group.bestContract) {
                      setSelectedContractKey(group.bestContract.key);
                      setDrawerTab(group.bestContract.side === "call" ? "calls" : "puts");
                    }
                  }}
                  title={`Calls ${group.callCount} • Puts ${group.putCount} • Max OI ${group.maxOi}`}
                >
                  {group.label} ({group.count})
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="tableWrap mt-4">
          <table className="dataTable">
            <thead>
              <tr>
                <th>Side</th>
                <th>Expiry</th>
                <th>Strike</th>
                <th>Bid</th>
                <th>Ask</th>
                <th>Last</th>
                <th>To BE</th>
                <th>Δ</th>
                <th>IV</th>
                <th>Vol</th>
                <th>OI</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {visibleContracts.map((c) => {
                const total = scanContractScore(c, { maxAsk: inp.maxAsk, minOi: inp.minOi, targetSide: inp.targetSide });
                const selected = selectedContract?.key === c.key;
                function focusBestContractHUD(){
    const best = pickBest(filteredContracts.length ? filteredContracts : allContracts, { maxAsk: inp.maxAsk, minOi: inp.minOi, targetSide: inp.targetSide }) || selectedContract;
    if(best?.key){
      setSelectedContractKey(best.key);
      setDrawerTab("detail");
      if(best.expiration && best.expiration !== inp.selectedExpiration) patch({ selectedExpiration: best.expiration });
      // scroll contracts into view
      setTimeout(() => document.getElementById("trading_contracts")?.scrollIntoView({ behavior:"smooth", block:"start" }), 120);
      pushNotif({ title: "Trading", body: `Focused ${best.symbol} ${best.side.toUpperCase()} ${best.strike}.`, tags: ["Trading"], level: "success" });
      return true;
    }
    pushNotif({ title: "Trading", body: "No contracts loaded yet — scan a symbol first.", tags: ["Trading"], level: "warn" });
    return false
  }

  async function copyPlanToClipboard(){
    try{
      await navigator.clipboard.writeText(plan);
      setLastPlanBuiltAt(Date.now());
      pushNotif({ title: "Trading", body: "Plan copied to clipboard.", tags: ["Trading"], level: "success" });
      return true;
    }catch{
      try{
        const api:any = oddApi();
        if(api?.copyText){
          await api.copyText(plan);
          setLastPlanBuiltAt(Date.now());
          pushNotif({ title: "Trading", body: "Plan copied to clipboard.", tags: ["Trading"], level: "success" });
          return true;
        }
      }catch{}
      pushNotif({ title: "Trading", body: "Could not copy plan (clipboard blocked). Use Export .md instead.", tags: ["Trading"], level: "warn" });
      return false;
    }
  }

  return (
                  <tr key={c.key} className={`${selected ? "selected" : ""} ${bestContract && c.key === bestContract.key ? "bestRow" : ""}`} onClick={() => { setSelectedContractKey(c.key); setDrawerTab("detail"); }}>
                    <td><span className={`badge ${c.side === "call" ? "good" : "bad"}`}>{c.side.toUpperCase()}</span></td>
                    <td>{c.expiration || chain?.expirationLabel || "—"}</td>
                    <td>{c.strike.toFixed(2)}</td>
                    <td>{formatMoney(c.bid)}</td>
                    <td>{formatMoney(c.ask)}</td>
                    <td>{formatMoney(c.last)}</td>
                    <td>{formatPct(c.toBreakevenPct)}</td>
                    <td>{formatGreek(c.greeks?.delta)}</td>
                    <td>{c.greeks?.impliedVolatility !== null && c.greeks?.impliedVolatility !== undefined ? `${(c.greeks.impliedVolatility * 100).toFixed(1)}%` : "—"}</td>
                    <td>{c.volume ?? "—"}</td>
                    <td>{c.openInterest ?? "—"}</td>
                    <td>{total.toFixed(1)}</td>
                  </tr>
                );
              })}
              {visibleContracts.length === 0 && (
                <tr><td colSpan={12} className="small">No contracts matched your filters yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card tradingSectionCard mt-5">
        <div className="cluster spread">
          <div>
            <div style={{ fontWeight: 900 }}>Watchlist scan</div>
            <div className="small">Ranks the strongest call + put across your current watchlist and filters.</div>
          </div>
          <div className="small">{watchlistBusy ? "Running…" : `${watchlistRows.length} rows`}</div>
        </div>
        <div className="mt-4">
          <label className="small">Watchlist</label>
          <textarea rows={3} value={inp.watchlist} onChange={(e) => patch({ watchlist: e.target.value.toUpperCase() })} />
        </div>
        <div className="grid2 mt-4">
          {watchlistRows.map((row) => (
            <div key={row.symbol} className="card tradingMiniCard">
              <div className="cluster spread start">
                <div>
                  <div style={{ fontWeight: 800 }}>{row.symbol}{row.companyName ? ` • ${row.companyName}` : ""}</div>
                  <div className="small">Spot {formatMoney(row.spot)}{row.expiration ? ` • ${row.expiration}` : ""}{row.feedUpdated ? ` • ${row.feedUpdated}` : ""}</div>
                </div>
                <button onClick={() => void scanSymbol(row.symbol, row.expiration || inp.selectedExpiration)}>Load</button>
              </div>
              {row.error ? (
                <div className="small mt-3" style={{ color: "var(--bad)" }}>{row.error}</div>
              ) : (
                <div className="grid tight mt-3">
                  <div className="small"><b>Call:</b> {row.bestCall ? `${row.bestCall.strike} @ ${formatMoney(row.bestCall.ask)} • Δ ${formatGreek(row.bestCall.greeks?.delta)} • OI ${row.bestCall.openInterest ?? "—"}` : "—"}</div>
                  <div className="small"><b>Put:</b> {row.bestPut ? `${row.bestPut.strike} @ ${formatMoney(row.bestPut.ask)} • Δ ${formatGreek(row.bestPut.greeks?.delta)} • OI ${row.bestPut.openInterest ?? "—"}` : "—"}</div>
                </div>
              )}
            </div>
          ))}
          {watchlistRows.length === 0 && <div className="small">No watchlist scan results yet.</div>}
        </div>
      </div>

      <div className="tradingSplit mt-5">
        <div className="card tradingSectionCard">
          <div className="row">
            <div style={{ flex: 1 }}>
              <label className="small">Symbol</label>
              <input value={inp.symbol} onChange={(e) => patch({ symbol: e.target.value.toUpperCase() })} />
            </div>
            <div style={{ flex: 1 }}>
              <label className="small">Timeframe</label>
              <select value={inp.timeframe} onChange={(e) => patch({ timeframe: e.target.value as Input["timeframe"] })}>
                <option value="0dte">0DTE</option>
                <option value="weeklies">Weeklies</option>
              </select>
            </div>
          </div>

          <div className="row mt-4">
            <div style={{ flex: 1 }}>
              <label className="small">Bias</label>
              <select value={inp.bias} onChange={(e) => patch({ bias: e.target.value as Input["bias"] })}>
                <option value="bull">Bullish</option>
                <option value="bear">Bearish</option>
                <option value="neutral">Neutral</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label className="small">Setup</label>
              <select value={inp.setup} onChange={(e) => patch({ setup: e.target.value as Input["setup"] })}>
                <option value="vwap_flip">VWAP flip</option>
                <option value="break_retest">Break + retest</option>
                <option value="range_reject">Range reject</option>
              </select>
            </div>
          </div>

          <div className="mt-4">
            <label className="small">Market environment (permission) {inp.env}</label>
            <input type="range" min="0" max="100" value={inp.env} onChange={(e) => patch({ env: Number(e.target.value) })} />
            <div className="small">Permission: <b>{permission}</b></div>
          </div>

          <div className="mt-4">
            <label className="small">Setup heat {inp.heat}</label>
            <input type="range" min="0" max="100" value={inp.heat} onChange={(e) => patch({ heat: Number(e.target.value) })} />
          </div>

          <div className="mt-4">
            <div className="small"><b>Trap flags</b> (auto-penalize)</div>
            {Object.entries(inp.traps).map(([k, v]) => (
              <label key={k} className="small block mt-2">
                <input type="checkbox" checked={v} onChange={(e) => patch({ traps: { ...inp.traps, [k]: e.target.checked } })} /> {k}
              </label>
            ))}
          </div>

          <div className="mt-4">
            <label className="small">Levels / context</label>
            <textarea rows={4} value={inp.levels} onChange={(e) => patch({ levels: e.target.value })} />
          </div>

          <div className="mt-4">
            <label className="small">Notes</label>
            <textarea rows={4} value={inp.notes} onChange={(e) => patch({ notes: e.target.value })} />
          </div>

          <div className="row mt-4">
            <button onClick={() => save()}>Save</button>
            <button onClick={() => downloadTextFile(`${inp.symbol}_sniper_plan.md`, plan)}>Export .md</button>
          </div>
        </div>

        <div id="trading_ticket" className="card tradingSectionCard">
          <div className="cluster spread start">
            <div>
              <div style={{ fontWeight: 900 }}>Order Ticket</div>
              <div className="small">Quick launcher for execution details (desktop-friendly). Uses your selected contract.</div>
            </div>
            <div className="cluster">
              {isDesktop() && (
                <button onClick={() => void undockTrading("ticket", `Order Ticket • ${chain?.symbol || inp.symbol}`)} title="Open ticket in a separate window">
                  Undock
                </button>
              )}
              {chain?.sourceUrl && <button onClick={() => void openExternal(chain.sourceUrl)}>Open chain</button>}
            </div>
          </div>

          {!selectedContract ? (
            <div className="small mt-4" style={{ opacity: 0.9 }}>
              No contract selected yet. Hit <b>Focus best contract</b> in the HUD wizard, then come back here.
            </div>
          ) : (
            <>
              
              <div className="cluster wrap end loose mt-4">
                <div className="cluster tight">
                  <button className={ticketAction === "BUY" ? "tabBtn active" : "tabBtn"} onClick={() => setTicketAction("BUY")}>Buy</button>
                  <button className={ticketAction === "SELL" ? "tabBtn active" : "tabBtn"} onClick={() => setTicketAction("SELL")}>Sell</button>
                </div>

                <div style={{ width: 170 }}>
                  <label className="small">Order type</label>
                  <select value={ticketType} onChange={(e) => setTicketType(e.target.value as any)}>
                    <option value="MARKET">Market</option>
                    <option value="LIMIT">Limit</option>
                    <option value="STOP">Stop</option>
                    <option value="STOP_LIMIT">Stop-Limit</option>
                  </select>
                </div>

                <div style={{ width: 120 }}>
                  <label className="small">Qty</label>
                  <input
                    type="number"
                    min={1}
                    value={ticketQty}
                    onChange={(e) => setTicketQty(Math.max(1, parseInt(e.target.value || "1", 10) || 1))}
                  />
                </div>

                {(ticketType === "LIMIT" || ticketType === "STOP_LIMIT") && (
                  <div style={{ width: 160 }}>
                    <label className="small">Limit</label>
                    <input
                      type="number"
                      step="0.01"
                      value={ticketLimit}
                      onChange={(e) => setTicketLimit(e.target.value === "" ? "" : Number(e.target.value))}
                      placeholder={selectedContract.ask != null ? String(selectedContract.ask) : ""}
                    />
                  </div>
                )}

                {(ticketType === "STOP" || ticketType === "STOP_LIMIT") && (
                  <div style={{ width: 160 }}>
                    <label className="small">Stop</label>
                    <input
                      type="number"
                      step="0.01"
                      value={ticketStop}
                      onChange={(e) => setTicketStop(e.target.value === "" ? "" : Number(e.target.value))}
                    />
                  </div>
                )}

                <div style={{ width: 160 }}>
                  <label className="small">Risk $</label>
                  <input
                    type="number"
                    step="1"
                    value={ticketRisk}
                    onChange={(e) => setTicketRisk(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="20"
                  />
                </div>

                <div style={{ width: 170 }}>
                  <label className="small">Stop-loss % (long)</label>
                  <input
                    type="number"
                    min={5}
                    max={95}
                    step={5}
                    value={ticketStopLossPct}
                    onChange={(e) => setTicketStopLossPct(Math.max(5, Math.min(95, parseInt(e.target.value || "50", 10) || 50)))}
                  />
                </div>

                <div style={{ width: 190 }}>
                  <label className="small">Exit stop (option)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={ticketExitStop}
                    onChange={(e) => setTicketExitStop(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="Auto"
                    disabled={ticketAction === "SELL"}
                  />
                </div>

                <div className="cluster tight" style={{ paddingBottom: 2 }}>
                  <button
                    className="tabBtn"
                    disabled={ticketAction === "SELL"}
                    onClick={() => {
                      const entry = computeEntryPx(selectedContract);
                      const auto = computeExitStopPx(entry);
                      if (auto > 0) setTicketExitStop(Number(auto.toFixed(2)));
                    }}
                    title="Auto-fill exit stop from entry and stop-loss %"
                  >
                    Auto-fill stop
                  </button>
                </div>

                <div style={{ flex: 1, minWidth: 260 }}>
                  <label className="small">Order note</label>
                  <input
                    value={`${ticketAction} ${ticketQty} ${selectedContract.symbol} • ${ticketType}${ticketType === "MARKET" ? "" : ticketType === "LIMIT" ? ` @ ${ticketLimit === "" ? "—" : ticketLimit}` : ticketType === "STOP" ? ` stop ${ticketStop === "" ? "—" : ticketStop}` : ` stop ${ticketStop === "" ? "—" : ticketStop} / limit ${ticketLimit === "" ? "—" : ticketLimit}`}`}
                    readOnly
                  />
                </div>
              </div>

              <div className="cluster wrap loose mt-3">
                {ticketAction === "SELL" ? (
                  <span className="badge bad">SELL risk can be undefined (assignment/margin). Use caution.</span>
                ) : (
                  (() => {
                    const px = computeEntryPx(selectedContract);
                    const perContractMaxLoss = px > 0 ? (px * 100) : 0;
                    const plannedLoss = perContractMaxLoss * (ticketStopLossPct / 100);
                    const maxQty = (ticketRisk !== "" && plannedLoss > 0) ? Math.max(0, Math.floor(Number(ticketRisk) / plannedLoss)) : 0;
                    const suggested = Math.max(1, maxQty || 1);
                    return (
                      <>
                        <span className="badge good">Est. risk/contract: {plannedLoss > 0 ? `$${plannedLoss.toFixed(0)}` : "—"}</span>
                        <span className="badge">Max qty @ risk: {maxQty || "—"}</span>
                        <button className="tabBtn" onClick={() => setTicketQty(1)}>1</button>
                        <button className="tabBtn" onClick={() => setTicketQty(2)}>2</button>
                        <button className="tabBtn" onClick={() => setTicketQty(suggested)} title="Set qty to max suggested size">MAX</button>
                      </>
                    );
                  })()
                )}
              </div>

              <div className="cluster wrap mt-3">
                <span className="badge">Take-profit ladder</span>
                {[25, 50, 100].map((p) => (
                  <button
                    key={p}
                    className={ticketTakeProfitPcts.includes(p) ? "tabBtn active" : "tabBtn"}
                    onClick={() => {
                      setTicketTakeProfitPcts((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p].sort((a, b) => a - b));
                    }}
                    title="Toggle take-profit target"
                    disabled={ticketAction === "SELL"}
                  >
                    {p}%
                  </button>
                ))}
                
                <span className="badge">Target +</span>
                <input
                  type="number"
                  value={ticketTpCustomPct}
                  onChange={(e) => setTicketTpCustomPct(Number(e.target.value || 0))}
                  style={{ width: 76 }}
                  min={0}
                  step={5}
                  disabled={ticketAction === "SELL"}
                  title="Custom take-profit percent (e.g., 35 = +35%)"
                />
                <span className="badge">%</span>
                <button
                  className="tabBtn"
                  onClick={() => {
                    const p = Math.max(0, Math.round(ticketTpCustomPct || 0));
                    if (!p) return;
                    setTicketTakeProfitPcts([p]);
                  }}
                  disabled={ticketAction === "SELL"}
                  title="Replace ladder with this single take-profit target"
                >
                  Auto-fill TP
                </button>
                <button
                  className="tabBtn"
                  onClick={() => {
                    const p = Math.max(0, Math.round(ticketTpCustomPct || 0));
                    if (!p) return;
                    setTicketTakeProfitPcts((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p].sort((a, b) => a - b));
                  }}
                  disabled={ticketAction === "SELL"}
                  title="Toggle this custom take-profit target in the ladder"
                >
                  Add
                </button>
{ticketAction !== "SELL" && (
                  (() => {
                    const entry = computeEntryPx(selectedContract);
                    const exits = ticketTakeProfitPcts
                      .map((p) => ({ p, px: computeTpPx(entry, p) }))
                      .filter((x) => x.px > 0);
                    if (!exits.length) return null;
                    return exits.map((x) => (
                      <span key={x.p} className="badge good">TP {x.p}%: {x.px.toFixed(2)}</span>
                    ));
                  })()
                )}
              </div>

              <div className="cluster wrap mt-4">
                <button
                  className="tabBtn active"
                  onClick={async () => {
                    const entry = computeEntryPx(selectedContract);
                    const entryFmt = entry > 0 ? entry.toFixed(2) : "—";
                    const limit = ticketLimit === "" ? "MKT" : Number(ticketLimit).toFixed(2);
                    const exitStop = ticketAction === "SELL" ? 0 : (ticketExitStop === "" ? computeExitStopPx(entry) : Number(ticketExitStop));
                    const tps = ticketAction === "SELL" ? [] : ticketTakeProfitPcts
                      .map((p) => ({ p, px: computeTpPx(entry, p) }))
                      .filter((x) => x.px > 0);
                    const txt = [
                      `ORDER TICKET`,
                      `Symbol: ${selectedContract.symbol}`,
                      `Contract side: ${selectedContract.side.toUpperCase()}`,
                      `Strike: ${selectedContract.strike}`,
                      `Expiry: ${selectedContract.expiration || chain?.expirationLabel || "—"}`,
                      `Qty: ${ticketQty}`,
                      `Action: ${ticketAction}`,
                      `OrderType: ${ticketType}`,
                      `Limit: ${ticketLimit === "" ? "—" : ticketLimit}`,
                      `Stop: ${ticketStop === "" ? "—" : ticketStop}`,
                      `Risk$: ${ticketRisk === "" ? "—" : ticketRisk}`,
                      `StopLoss%: ${ticketStopLossPct}%`,
                      `EntryPx: ${entryFmt}`,
                      `ExitStopPx: ${exitStop > 0 ? exitStop.toFixed(2) : "—"}`,
                      `TakeProfits: ${tps.length ? tps.map((x) => `${x.p}% @ ${x.px.toFixed(2)}`).join(" | ") : "—"}`,
                      `Entry: ${ticketType === "MARKET" ? "MKT" : (ticketType === "LIMIT" ? `LMT ${limit}` : ticketType === "STOP" ? `STP ${ticketStop}` : `STP ${ticketStop} / LMT ${limit}`)}`,
                      `Ask: ${selectedContract.ask != null ? selectedContract.ask : "—"}`,
                      ``,
                      `Plan preview follows:`,
                      plan,
                    ].join("\n");
                    try {
                      await navigator.clipboard.writeText(txt);
                      pushNotif({ title: "Trading", body: "Order ticket copied.", tags: ["Trading"], level: "success" });
                    } catch {
                      pushNotif({ title: "Trading", body: "Clipboard blocked. Use Export .md.", tags: ["Trading"], level: "warn" });
                    }
                  }}
                >
                  Copy ticket
                </button>

                <button
                  className="tabBtn"
                  onClick={async () => {
                    const entry = computeEntryPx(selectedContract);
                    const exitStop = ticketAction === "SELL" ? 0 : (ticketExitStop === "" ? computeExitStopPx(entry) : Number(ticketExitStop));
                    const tps = ticketAction === "SELL" ? [] : ticketTakeProfitPcts
                      .map((p) => ({ p, px: computeTpPx(entry, p) }))
                      .filter((x) => x.px > 0);

                    const brokerTxt = [
                      "PUBLIC (short format)",
                      buildPublicShortTicket({
                        action: ticketAction,
                        qty: Number(ticketQty || 1),
                        osi: selectedContract.symbol,
                        orderType: ticketType,
                        limitPx: ticketLimit === "" ? null : Number(ticketLimit),
                        stopPx: ticketStop === "" ? null : Number(ticketStop),
                        exitStopPx: exitStop > 0 ? exitStop : null,
                        tp: tps,
                        riskTxt: ticketRisk === "" ? "—" : `$${ticketRisk}`,
                        slPct: ticketStopLossPct,
                      }),
                      "",
                      "PLAN:",
                      plan,
                    ].join("\n");

                    try {
                      await navigator.clipboard.writeText(brokerTxt);
                      pushNotif({ title: "Trading", body: "Public-style ticket copied.", tags: ["Trading"], level: "success" });
                    } catch {
                      pushNotif({ title: "Trading", body: "Clipboard blocked. Use Export .md.", tags: ["Trading"], level: "warn" });
                    }
                  }}
                  title="Copy Public-style short ticket text"
                >
                  Copy Public text
                </button>
                
                <button
                  className="tabBtn"
                  onClick={async () => {
                    const entry = computeEntryPx(selectedContract);
                    const entryFmt = entry > 0 ? entry.toFixed(2) : "MKT";
                    const exitStop = ticketAction === "SELL" ? 0 : (ticketExitStop === "" ? computeExitStopPx(entry) : Number(ticketExitStop));
                    const tps = ticketAction === "SELL" ? [] : ticketTakeProfitPcts
                      .map((p) => ({ p, px: computeTpPx(entry, p) }))
                      .filter((x) => x.px > 0);

                    const label = formatPublicContractLabel(selectedContract.symbol);

                    const entryLine = (() => {
                      if (ticketType === "MARKET") return `${ticketAction} ${ticketQty} ${label} MKT`;
                      if (ticketType === "LIMIT") return `${ticketAction} ${ticketQty} ${label} LMT ${entryFmt}`;
                      if (ticketType === "STOP") return `${ticketAction} ${ticketQty} ${label} STP ${ticketStop === "" ? "—" : ticketStop}`;
                      return `${ticketAction} ${ticketQty} ${label} STP ${ticketStop === "" ? "—" : ticketStop} / LMT ${ticketLimit === "" ? "—" : ticketLimit}`;
                    })();

                    const lines: string[] = [];
                    lines.push("PUBLIC BRACKET (short)");
                    lines.push(entryLine);

                    if (ticketAction === "SELL") {
                      lines.push("⚠ SELL: bracket/OCO formatting is broker-specific. Size carefully.");
                    } else {
                      lines.push(`OCO:`);
                      lines.push(`STOP SELL ${ticketQty} ${label} STP ${exitStop > 0 ? exitStop.toFixed(2) : "—"}`);

                      if (tps.length) {
                        // Split quantity across TP targets (even split, remainder to last)
                        const qty = Math.max(1, Number(ticketQty || 1));
                        const base = Math.floor(qty / tps.length);
                        const rem = qty - base * tps.length;
                        tps.forEach((tp, i) => {
                          const q = base + (i === tps.length - 1 ? rem : 0);
                          lines.push(`TP${i + 1} SELL ${q} ${label} LMT ${tp.px.toFixed(2)}  (+${tp.p}%)`);
                        });
                        lines.push("NOTE: Some brokers require separate OCO per TP. Use as plan template.");
                      } else {
                        lines.push("TP: — (add TP % targets first)");
                      }

                      lines.push(`RISK ${ticketRisk === "" ? "—" : `$${ticketRisk}`} | SL ${ticketStopLossPct}%`);
                    }

                    lines.push("");
                    lines.push("PLAN:");
                    lines.push(plan);

                    try {
                      await navigator.clipboard.writeText(lines.join("\n"));
                      pushNotif({ title: "Trading", body: "Bracket/OCO text copied.", tags: ["Trading"], level: "success" });
                    } catch {
                      pushNotif({ title: "Trading", body: "Clipboard blocked. Use Export .md.", tags: ["Trading"], level: "warn" });
                    }
                  }}
                  title="Copy a bracket-style (entry + OCO exits) text block"
                >
                  Copy bracket (OCO)
                </button>
<button className="tabBtn" onClick={() => setDrawerTab("detail")}>Open details</button>
              </div>
            </>
          )}
        </div>

        <div id="trading_plan" className="card tradingSectionCard">
          <div style={{ fontWeight: 900 }}>Plan Preview</div>
          <textarea className="mt-3" value={plan} readOnly rows={28} />
        </div>
      </div>
    </div>
  );
}
