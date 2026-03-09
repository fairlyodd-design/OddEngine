import { oddApi, isDesktop } from './odd';
import { generateMockChain, type MockContract } from './optionsChainMocks';
import {
  asNumber,
  breakevenFromStrike,
  emptyGreeks,
  optionSideFromOsiSymbol,
  parseGreeksResponse,
  parseOsiSymbol,
} from './publicApi';

export type BrokerAdapterMode = 'mock' | 'public-api' | 'custom';

export type BrokerAdapterSettings = {
  mode: BrokerAdapterMode;
  publicSecretKey: string;
  publicAccessToken: string;
  publicAccountId: string;
  customBaseUrl: string;
};

export type BrokerAdapterResult = {
  contracts: MockContract[];
  expirations: string[];
  sourceMode: BrokerAdapterMode | 'fallback';
  sourceLabel: string;
  feedUpdated: string | null;
  status: string;
  usedFallback: boolean;
  error?: string;
};

export const BROKER_SETTINGS_KEY = 'oddengine:sniper:brokerAdapter:v1';

export const DEFAULT_BROKER_SETTINGS: BrokerAdapterSettings = {
  mode: 'mock',
  publicSecretKey: '',
  publicAccessToken: '',
  publicAccountId: '',
  customBaseUrl: 'http://127.0.0.1:8787',
};

function round(n: number, digits = 2) {
  return Number(n.toFixed(digits));
}

function isoNowLabel() {
  return new Date().toLocaleString();
}

export function readBrokerAdapterSettings(): BrokerAdapterSettings {
  try {
    const raw = localStorage.getItem(BROKER_SETTINGS_KEY);
    if (!raw) return DEFAULT_BROKER_SETTINGS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_BROKER_SETTINGS, ...(parsed || {}) };
  } catch {
    return DEFAULT_BROKER_SETTINGS;
  }
}

export function saveBrokerAdapterSettings(settings: BrokerAdapterSettings) {
  localStorage.setItem(BROKER_SETTINGS_KEY, JSON.stringify(settings));
}

async function requestText(opts: { url: string; method?: string; headers?: Record<string, string>; body?: string; timeoutMs?: number; maxBytes?: number }) {
  const api = oddApi();
  if (isDesktop() && api.fetchText) {
    const res = await api.fetchText({
      url: opts.url,
      method: opts.method || 'GET',
      headers: opts.headers,
      body: opts.body,
      timeoutMs: opts.timeoutMs || 15000,
      maxBytes: opts.maxBytes || 4_500_000,
    });
    if (!res?.ok || typeof res.text !== 'string') throw new Error(res?.error || `Request failed for ${opts.url}`);
    return res.text;
  }

  const ctrl = new AbortController();
  const t = window.setTimeout(() => ctrl.abort(), opts.timeoutMs || 15000);
  try {
    const res = await fetch(opts.url, {
      method: opts.method || 'GET',
      headers: opts.headers,
      body: opts.body,
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    window.clearTimeout(t);
  }
}

async function requestJson<T = any>(opts: { url: string; method?: string; headers?: Record<string, string>; body?: any; timeoutMs?: number; maxBytes?: number }): Promise<T> {
  const headers = { ...(opts.headers || {}) };
  let body: string | undefined;
  if (opts.body !== undefined) {
    body = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body);
    if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
  }
  const text = await requestText({ ...opts, headers, body });
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error('Response was not valid JSON.');
  }
}

function publicAuthHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export async function createPublicAccessToken(secretKey: string): Promise<string> {
  const json = await requestJson<{ accessToken?: string }>({
    url: 'https://api.public.com/userapiauthservice/personal/access-tokens',
    method: 'POST',
    body: { validityInMinutes: 720, secret: secretKey },
  });
  if (!json?.accessToken) throw new Error('Public did not return an access token.');
  return json.accessToken;
}

async function fetchPublicExpirations(accessToken: string, accountId: string, symbol: string): Promise<string[]> {
  const json = await requestJson<{ expirations?: string[] }>({
    url: `https://api.public.com/userapigateway/marketdata/${encodeURIComponent(accountId)}/option-expirations`,
    method: 'POST',
    headers: publicAuthHeaders(accessToken),
    body: { instrument: { symbol, type: 'EQUITY' } },
  });
  return Array.isArray(json?.expirations) ? json.expirations : [];
}

async function fetchPublicOptionChain(accessToken: string, accountId: string, symbol: string, expirationDate: string): Promise<any> {
  return await requestJson<any>({
    url: `https://api.public.com/userapigateway/marketdata/${encodeURIComponent(accountId)}/option-chain`,
    method: 'POST',
    headers: publicAuthHeaders(accessToken),
    body: { instrument: { symbol, type: 'EQUITY' }, expirationDate },
    maxBytes: 8_000_000,
  });
}

async function fetchPublicGreeks(accessToken: string, accountId: string, osiSymbols: string[]): Promise<Record<string, ReturnType<typeof emptyGreeks>>> {
  if (!osiSymbols.length) return {};
  const repeated = osiSymbols.map((s) => `osiSymbols=${encodeURIComponent(s)}`).join('&');
  const baseUrl = `https://api.public.com/userapigateway/option-details/${encodeURIComponent(accountId)}/greeks`;
  try {
    const json = await requestJson<any>({ url: `${baseUrl}?${repeated}`, method: 'GET', headers: { Authorization: `Bearer ${accessToken}` }, maxBytes: 2_500_000 });
    return parseGreeksResponse(json);
  } catch {
    const json = await requestJson<any>({ url: `${baseUrl}?osiSymbols=${encodeURIComponent(osiSymbols.join(','))}`, method: 'GET', headers: { Authorization: `Bearer ${accessToken}` }, maxBytes: 2_500_000 });
    return parseGreeksResponse(json);
  }
}

function scoreFromNumbers(params: { ask: number; bid: number; oi: number; volume: number; delta: number | null; gamma: number | null; theta: number | null; vega: number | null }) {
  const spreadPct = Math.max(0, ((params.ask - params.bid) / Math.max(params.ask, 0.01)) * 100);
  const deltaScore = params.delta == null ? 16 : Math.max(0, 30 - Math.abs(Math.abs(params.delta) - 0.35) * 55);
  const gammaScore = params.gamma == null ? 10 : Math.min(18, params.gamma * 220);
  const thetaScore = params.theta == null ? 8 : Math.max(0, 15 - Math.abs(params.theta) * 100);
  const liqScore = Math.min(22, params.oi / 180) + Math.min(16, params.volume / 130);
  const spreadScore = Math.max(0, 18 - spreadPct);
  return Math.round(deltaScore + gammaScore + thetaScore + liqScore + spreadScore);
}

function probabilityFromDelta(delta: number | null, biasBoost = 0) {
  if (delta == null) return Math.max(20, Math.min(80, 48 + biasBoost));
  return Math.max(20, Math.min(84, Math.round(30 + Math.abs(delta) * 82 + biasBoost)));
}

function normalizePublicRows(params: {
  symbol: string;
  expiration: string;
  chainJson: any;
  greeksMap: Record<string, ReturnType<typeof emptyGreeks>>;
}): MockContract[] {
  const allRows = [
    ...((params.chainJson?.calls || []) as any[]),
    ...((params.chainJson?.puts || []) as any[]),
  ];

  const out: MockContract[] = [];
  for (const row of allRows) {
    const osi = String(row?.instrument?.symbol || '').toUpperCase();
    const parsed = parseOsiSymbol(osi);
    if (!parsed) continue;
    const ask = asNumber(row?.ask) ?? asNumber(row?.last) ?? 0;
    const bid = asNumber(row?.bid) ?? Math.max(0.01, ask - 0.05);
    const last = asNumber(row?.last) ?? round((ask + bid) / 2, 2);
    const greeks = params.greeksMap[osi] || emptyGreeks();
    const spreadPct = round(((ask - bid) / Math.max(ask, 0.01)) * 100, 1);
    const probability = probabilityFromDelta(greeks.delta, parsed.side === 'call' ? 3 : 0);
    const score = scoreFromNumbers({
      ask,
      bid,
      oi: Number(row?.openInterest || 0),
      volume: Number(row?.volume || 0),
      delta: greeks.delta,
      gamma: greeks.gamma,
      theta: greeks.theta,
      vega: greeks.vega,
    });

    out.push({
      id: `${params.symbol}-${params.expiration}-${parsed.side}-${parsed.strike}`,
      symbol: parsed.root,
      side: parsed.side,
      strike: parsed.strike,
      bid: round(bid, 2),
      ask: round(ask, 2),
      last: round(last, 2),
      volume: Number(row?.volume || 0),
      oi: Number(row?.openInterest || 0),
      iv: round(((greeks.impliedVolatility ?? 0.24) * 100), 1),
      delta: round(greeks.delta ?? (parsed.side === 'call' ? 0.35 : -0.35), 3),
      gamma: round(greeks.gamma ?? 0.025, 3),
      theta: round(greeks.theta ?? -0.04, 3),
      vega: round(greeks.vega ?? 0.08, 3),
      probability,
      spreadPct,
      score,
    });
  }

  return out.sort((a, b) => b.score - a.score);
}

async function fetchCustomExpirations(baseUrl: string, symbol: string): Promise<string[]> {
  const json = await requestJson<{ expirations?: string[] }>({
    url: `${baseUrl.replace(/\/$/, '')}/expirations?symbol=${encodeURIComponent(symbol)}`,
    method: 'GET',
  });
  return Array.isArray(json?.expirations) ? json.expirations : [];
}

async function fetchCustomChain(baseUrl: string, symbol: string, expiration: string): Promise<any> {
  return await requestJson<any>({
    url: `${baseUrl.replace(/\/$/, '')}/chain?symbol=${encodeURIComponent(symbol)}&expiration=${encodeURIComponent(expiration)}`,
    method: 'GET',
    maxBytes: 8_000_000,
  });
}

function fallbackResult(symbol: string, underlying: number, expiration: string, bias: 'bullish' | 'bearish' | 'neutral', status: string, error?: string): BrokerAdapterResult {
  return {
    contracts: generateMockChain(symbol, underlying, expiration, bias),
    expirations: [expiration],
    sourceMode: 'fallback',
    sourceLabel: 'Phoenix mock fallback',
    feedUpdated: isoNowLabel(),
    status,
    usedFallback: true,
    error,
  };
}

export async function loadBrokerExpirations(params: { symbol: string; settings: BrokerAdapterSettings }): Promise<{ expirations: string[]; status: string }> {
  const symbol = params.symbol.toUpperCase();
  const settings = params.settings;
  try {
    if (settings.mode === 'public-api') {
      if (!settings.publicAccessToken || !settings.publicAccountId) {
        return { expirations: [], status: 'Public API mode needs token + accountId' };
      }
      const expirations = await fetchPublicExpirations(settings.publicAccessToken, settings.publicAccountId, symbol);
      return { expirations, status: expirations.length ? 'Live expirations loaded' : 'No expirations returned' };
    }
    if (settings.mode === 'custom') {
      if (!settings.customBaseUrl.trim()) return { expirations: [], status: 'Custom adapter needs a base URL' };
      const expirations = await fetchCustomExpirations(settings.customBaseUrl.trim(), symbol);
      return { expirations, status: expirations.length ? 'Adapter expirations loaded' : 'Adapter returned no expirations' };
    }
    return { expirations: [], status: 'Mock mode uses built-in expirations' };
  } catch (e: any) {
    return { expirations: [], status: String(e?.message || e || 'Expiration request failed') };
  }
}

export async function loadBrokerChain(params: {
  symbol: string;
  underlying: number;
  expiration: string;
  bias: 'bullish' | 'bearish' | 'neutral';
  settings: BrokerAdapterSettings;
}): Promise<BrokerAdapterResult> {
  const symbol = params.symbol.toUpperCase();
  const settings = params.settings;

  if (settings.mode === 'mock') {
    return {
      contracts: generateMockChain(symbol, params.underlying, params.expiration, params.bias),
      expirations: [params.expiration],
      sourceMode: 'mock',
      sourceLabel: 'Phoenix mock chain',
      feedUpdated: isoNowLabel(),
      status: 'Mock mode active',
      usedFallback: false,
    };
  }

  try {
    if (settings.mode === 'public-api') {
      if (!settings.publicAccessToken || !settings.publicAccountId) {
        return fallbackResult(symbol, params.underlying, params.expiration, params.bias, 'Public API credentials missing', 'Add token + accountId to use live chain mode.');
      }
      const expirations = await fetchPublicExpirations(settings.publicAccessToken, settings.publicAccountId, symbol);
      const targetExpiration = expirations.includes(params.expiration) ? params.expiration : (expirations[0] || params.expiration);
      const chainJson = await fetchPublicOptionChain(settings.publicAccessToken, settings.publicAccountId, symbol, targetExpiration);
      const osiSymbols = [...(chainJson?.calls || []), ...(chainJson?.puts || [])].map((row: any) => String(row?.instrument?.symbol || '').toUpperCase()).filter(Boolean);
      const greeksMap = await fetchPublicGreeks(settings.publicAccessToken, settings.publicAccountId, osiSymbols);
      const contracts = normalizePublicRows({ symbol, expiration: targetExpiration, chainJson, greeksMap });
      if (!contracts.length) return fallbackResult(symbol, params.underlying, params.expiration, params.bias, 'Public API returned no contracts', 'Live chain came back empty.');
      return {
        contracts,
        expirations,
        sourceMode: 'public-api',
        sourceLabel: 'Public API adapter',
        feedUpdated: isoNowLabel(),
        status: `Live chain loaded for ${targetExpiration}`,
        usedFallback: false,
      };
    }

    if (settings.mode === 'custom') {
      if (!settings.customBaseUrl.trim()) {
        return fallbackResult(symbol, params.underlying, params.expiration, params.bias, 'Custom adapter URL missing', 'Add a base URL for the broker-style adapter.');
      }
      const expirations = await fetchCustomExpirations(settings.customBaseUrl.trim(), symbol);
      const targetExpiration = expirations.includes(params.expiration) ? params.expiration : (expirations[0] || params.expiration);
      const chainJson = await fetchCustomChain(settings.customBaseUrl.trim(), symbol, targetExpiration);
      const contracts = Array.isArray(chainJson?.contracts) ? chainJson.contracts as MockContract[] : [];
      if (!contracts.length) return fallbackResult(symbol, params.underlying, params.expiration, params.bias, 'Custom adapter returned no contracts', 'Adapter responded but did not include contracts.');
      return {
        contracts,
        expirations,
        sourceMode: 'custom',
        sourceLabel: 'Custom broker adapter',
        feedUpdated: typeof chainJson?.feedUpdated === 'string' ? chainJson.feedUpdated : isoNowLabel(),
        status: `Adapter chain loaded for ${targetExpiration}`,
        usedFallback: false,
      };
    }

    return fallbackResult(symbol, params.underlying, params.expiration, params.bias, 'Unknown adapter mode');
  } catch (e: any) {
    return fallbackResult(symbol, params.underlying, params.expiration, params.bias, 'Adapter request failed', String(e?.message || e || 'Unknown error'));
  }
}
