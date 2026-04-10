import { loadJSON, saveJSON } from "./storage";

export type MusicProviderMode = "stub" | "webhook" | "local";
export type MusicBridgeEngine = "auto" | "musicgen-cli" | "bark-cli" | "python-adapter" | "external-api-json" | "command-json" | "stub";

export type MusicProviderConfig = {
  enabled: boolean;
  mode: MusicProviderMode;
  endpoint: string;
  healthPath: string;
  model: string;
  providerName: string;
  timeoutMs: number;
  bridgeEngine: MusicBridgeEngine;
  externalApiUrl?: string;
  command?: string;
};

export type MusicRuntimeDoctor = {
  ok: boolean;
  status: string;
  selectedEngine?: string;
  selectedLabel?: string;
  selectedDetail?: string;
  runtimeLockPresent?: boolean;
  runtimeLockPath?: string;
  runtimeLock?: any;
  guidance?: string;
  models?: any;
  adapters?: any;
  install?: any;
  engines?: Array<{ id: string; label: string; available: boolean; detail: string }>;
};

export type MusicProviderProbe = {
  ok: boolean;
  status: string;
  detail: string;
  endpoint: string;
  mode: MusicProviderMode;
  providerName: string;
  config?: any;
  selectedEngine?: string;
  engines?: Array<{ id: string; label: string; available: boolean; detail: string }>;
  runtime?: MusicRuntimeDoctor;
};

const KEY = "oddengine:musicProviderBridge:v1";

const DEFAULT_CONFIG: MusicProviderConfig = {
  enabled: false,
  mode: "stub",
  endpoint: "http://127.0.0.1:7010",
  healthPath: "/health",
  model: "oddengine-music-bridge",
  providerName: "Local Music Bridge",
  timeoutMs: 180000,
  bridgeEngine: "auto",
  externalApiUrl: "",
  command: "",
};

function timeoutFetch(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => window.clearTimeout(timer));
}

export function getMusicProviderConfig(): MusicProviderConfig {
  return { ...DEFAULT_CONFIG, ...(loadJSON<Partial<MusicProviderConfig>>(KEY, {}) || {}) };
}

export function saveMusicProviderConfig(patch: Partial<MusicProviderConfig>) {
  const next = { ...getMusicProviderConfig(), ...patch };
  saveJSON(KEY, next);
  return next;
}

export async function probeMusicProvider(): Promise<MusicProviderProbe> {
  const cfg = getMusicProviderConfig();
  if (!cfg.enabled || !cfg.endpoint) {
    return {
      ok: false,
      status: "disabled",
      detail: "Provider disabled",
      endpoint: cfg.endpoint,
      mode: cfg.mode,
      providerName: cfg.providerName,
    };
  }
  try {
    const base = String(cfg.endpoint).replace(/\/$/, "");
    const url = `${base}${cfg.healthPath || "/health"}`;
    const res = await timeoutFetch(url, { method: "GET" }, Math.min(10000, Number(cfg.timeoutMs || 180000)));
    const json = await res.json().catch(() => ({}));
    return {
      ok: !!res.ok,
      status: json?.status || json?.service || (res.ok ? "ready" : "unreachable"),
      detail: json?.detail || json?.message || (res.ok ? "reachable" : `HTTP ${res.status}`),
      endpoint: cfg.endpoint,
      mode: cfg.mode,
      providerName: cfg.providerName,
      config: json?.config || null,
      selectedEngine: json?.selectedEngine || json?.config?.engine || null,
      engines: json?.engines || [],
      runtime: json?.runtime || null,
    };
  } catch (e: any) {
    return {
      ok: false,
      status: "unreachable",
      detail: e?.message || String(e),
      endpoint: cfg.endpoint,
      mode: cfg.mode,
      providerName: cfg.providerName,
    };
  }
}

export async function renderViaMusicProvider(payload: any) {
  const cfg = getMusicProviderConfig();
  if (!cfg.enabled || !cfg.endpoint) return null;
  const base = String(cfg.endpoint).replace(/\/$/, "");
  await timeoutFetch(`${base}/config`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      engine: cfg.bridgeEngine || "auto",
      externalApiUrl: cfg.externalApiUrl || "",
      command: cfg.command || "",
    }),
  }, Math.min(15000, Number(cfg.timeoutMs || 180000))).catch(() => null);
  const res = await timeoutFetch(`${base}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: "music",
      model: cfg.model,
      payload,
    }),
  }, Number(cfg.timeoutMs || 180000));
  if (!res.ok) throw new Error(`Music provider HTTP ${res.status}`);
  return await res.json().catch(() => ({}));
}

export async function getMusicRuntimeDoctor(): Promise<MusicRuntimeDoctor | null> {
  const cfg = getMusicProviderConfig();
  if (!cfg.endpoint) return null;
  try {
    const base = String(cfg.endpoint).replace(/\/$/, "");
    const res = await timeoutFetch(`${base}/runtime/doctor`, { method: "GET" }, Math.min(15000, Number(cfg.timeoutMs || 180000)));
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
    return (json?.runtime || null) as MusicRuntimeDoctor | null;
  } catch {
    return null;
  }
}


export async function runMusicModelSmokeTest(payload: any) {
  const cfg = getMusicProviderConfig();
  if (!cfg.endpoint) throw new Error("Music provider endpoint missing");
  const base = String(cfg.endpoint).replace(/\/$/, "");
  await timeoutFetch(`${base}/config`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      engine: cfg.bridgeEngine || "auto",
      externalApiUrl: cfg.externalApiUrl || "",
      command: cfg.command || "",
    }),
  }, Math.min(15000, Number(cfg.timeoutMs || 180000))).catch(() => null);
  const res = await timeoutFetch(`${base}/smoke-test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload }),
  }, Number(cfg.timeoutMs || 180000));
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || json?.failReasons?.join(", ") || `HTTP ${res.status}`);
  return json;
}
