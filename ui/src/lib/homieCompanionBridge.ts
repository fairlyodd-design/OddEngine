import { loadPrefs } from "./prefs";
import type { Notif } from "./notifs";

export type HomieBridgeEvent =
  | { type: "alert:new_setup"; payload?: { symbol?: string; note?: string } }
  | { type: "coach:wait"; payload?: { reason?: string } }
  | { type: "coach:good_reclaim"; payload?: { symbol?: string } }
  | { type: "scanner:best_pair"; payload?: { symbol?: string } }
  | { type: "speech:say"; payload?: { text?: string } }
  | { type: "system:notify"; payload?: { title?: string; body?: string; level?: "info" | "warn" | "error" | "success"; source?: string } }
  | { type: "presence:set_state"; payload?: { state?: "idle" | "listening" | "talking" | "alert" | "celebrate" } };

type BridgeCooldownState = {
  target: string;
  until: number;
  error: string;
};

let bridgeCooldown: BridgeCooldownState | null = null;

function isBridgeCoolingDown(target: string) {
  return !!bridgeCooldown && bridgeCooldown.target === target && bridgeCooldown.until > Date.now();
}

function rememberBridgeFailure(target: string, error: string) {
  bridgeCooldown = {
    target,
    until: Date.now() + 30_000,
    error,
  };
}

function clearBridgeCooldown(target: string) {
  if (bridgeCooldown?.target === target) bridgeCooldown = null;
}

export type HomieBridgeHealth = {
  ok: boolean;
  app?: string;
  port?: number;
  recentEventCount?: number;
  error?: string;
};

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = 3500) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), Math.max(500, timeoutMs));
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

export function getCompanionBridgeSettings() {
  const prefs = loadPrefs();
  return {
    enabled: prefs.ai.homieCompanionBridgeEnabled !== false,
    baseUrl: String(prefs.ai.homieCompanionBridgeBaseUrl || "http://127.0.0.1:45777").replace(/\/+$/, ""),
    timeoutMs: Math.max(750, Number(prefs.ai.homieCompanionBridgeTimeoutMs || 3500)),
    mirrorNotifications: prefs.ai.homieCompanionBridgeMirrorNotifications !== false,
  };
}

export async function probeHomieCompanionBridge(baseUrl?: string, timeoutMs?: number): Promise<HomieBridgeHealth> {
  const settings = getCompanionBridgeSettings();
  const target = (baseUrl || settings.baseUrl).replace(/\/+$/, "");
  if (isBridgeCoolingDown(target)) {
    return { ok: false, error: bridgeCooldown?.error || "Homie Companion bridge cooldown active." };
  }
  try {
    const response = await fetchWithTimeout(`${target}/health`, {}, timeoutMs || settings.timeoutMs);
    const json = await response.json();
    clearBridgeCooldown(target);
    return {
      ok: !!json?.ok,
      app: json?.app,
      port: json?.port,
      recentEventCount: json?.recentEventCount,
      error: response.ok ? undefined : `HTTP ${response.status}`
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    rememberBridgeFailure(target, message);
    return { ok: false, error: message };
  }
}

export async function sendHomieCompanionEvent(event: HomieBridgeEvent, baseUrl?: string, timeoutMs?: number) {
  const settings = getCompanionBridgeSettings();
  const target = (baseUrl || settings.baseUrl).replace(/\/+$/, "");
  if (isBridgeCoolingDown(target)) {
    throw new Error(bridgeCooldown?.error || "Homie Companion bridge is cooling down after a recent failed connection.");
  }
  try {
    const response = await fetchWithTimeout(`${target}/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    }, timeoutMs || settings.timeoutMs);
    const json = await response.json().catch(() => ({}));
    if (!response.ok || !json?.ok) {
      const message = json?.error || `Homie companion bridge failed with HTTP ${response.status}`;
      rememberBridgeFailure(target, message);
      throw new Error(message);
    }
    clearBridgeCooldown(target);
    return json;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    rememberBridgeFailure(target, message);
    throw new Error(message);
  }
}

export function notifToHomieEvent(notif: Notif): HomieBridgeEvent {
  return {
    type: "system:notify",
    payload: {
      title: notif.title,
      body: notif.body || notif.tags?.join(" • ") || "",
      level: notif.level,
      source: notif.tags?.[0] || "OddEngine"
    }
  };
}

export function emitHomieCompanionEvent(event: HomieBridgeEvent) {
  window.dispatchEvent(new CustomEvent("oddengine:homie-companion-event", { detail: { event } }));
}
