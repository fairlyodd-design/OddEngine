import { loadJSON, saveJSON } from "./storage";
import { loadPrefs } from "./prefs";
import { emitHomieCompanionEvent, type HomieBridgeEvent } from "./homieCompanionBridge";

export type HomiePhoenixRelayLogEntry = {
  id: string;
  ts: number;
  lane: string;
  title: string;
  detail: string;
  eventType: HomieBridgeEvent["type"];
  symbol?: string;
  score?: number;
};

const LOG_KEY = "oddengine:homie:phoenix-relay-log:v1";
const seenAt = new Map<string, number>();

function getRelaySettings() {
  const prefs = loadPrefs();
  return {
    enabled: prefs.ai.homieCompanionBridgeEnabled !== false && (prefs.ai as any).homieCompanionPhoenixRelayEnabled !== false,
    scanner: (prefs.ai as any).homieCompanionPhoenixRelayScanner !== false,
    coach: (prefs.ai as any).homieCompanionPhoenixRelayCoach !== false,
    minScore: Math.max(60, Number((prefs.ai as any).homieCompanionPhoenixRelayMinScore || 84)),
  };
}

function shouldRelay(signature: string, cooldownMs = 45000) {
  const now = Date.now();
  const last = seenAt.get(signature) || 0;
  if (now - last < cooldownMs) return false;
  seenAt.set(signature, now);
  return true;
}

function appendLog(entry: Omit<HomiePhoenixRelayLogEntry, "id" | "ts">) {
  const current = loadJSON<HomiePhoenixRelayLogEntry[]>(LOG_KEY, []);
  const next: HomiePhoenixRelayLogEntry = {
    id: crypto.randomUUID(),
    ts: Date.now(),
    ...entry,
  };
  saveJSON(LOG_KEY, [next, ...current].slice(0, 24));
  try {
    window.dispatchEvent(new CustomEvent("oddengine:homie-phoenix-relay-log-updated", { detail: { entry: next } }));
  } catch {
    // ignore local-only dispatch issues
  }
  return next;
}

function relay(event: HomieBridgeEvent, entry: Omit<HomiePhoenixRelayLogEntry, "id" | "ts">, signature: string, cooldownMs = 45000) {
  const settings = getRelaySettings();
  if (!settings.enabled) return false;
  if (!shouldRelay(signature, cooldownMs)) return false;
  emitHomieCompanionEvent(event);
  appendLog(entry);
  return true;
}

export function getHomiePhoenixRelayLog() {
  return loadJSON<HomiePhoenixRelayLogEntry[]>(LOG_KEY, []);
}

export function clearHomiePhoenixRelayLog() {
  saveJSON(LOG_KEY, []);
  try {
    window.dispatchEvent(new CustomEvent("oddengine:homie-phoenix-relay-log-updated", { detail: { cleared: true } }));
  } catch {
    // ignore
  }
}

export function relayPhoenixScannerWinner(input: {
  symbol: string;
  score: number;
  confidenceLabel: string;
  setupName: string;
  marketTone?: string;
}) {
  const settings = getRelaySettings();
  if (!settings.scanner || input.score < settings.minScore) return false;
  return relay(
    { type: "scanner:best_pair", payload: { symbol: input.symbol } },
    {
      lane: "scanner",
      title: `${input.symbol} bubbled to the top`,
      detail: `${input.confidenceLabel} • ${input.setupName}${input.marketTone ? ` • ${input.marketTone}` : ""}`,
      eventType: "scanner:best_pair",
      symbol: input.symbol,
      score: input.score,
    },
    `scanner:${input.symbol}:${input.confidenceLabel}:${Math.round(input.score)}:${input.setupName}`,
    60000,
  );
}

export function relayPhoenixCoachWait(input: { reason: string; symbol?: string; score?: number }) {
  const settings = getRelaySettings();
  if (!settings.coach) return false;
  return relay(
    { type: "coach:wait", payload: { reason: input.reason } },
    {
      lane: "coach",
      title: "Homie says wait",
      detail: input.reason,
      eventType: "coach:wait",
      symbol: input.symbol,
      score: input.score,
    },
    `coach:wait:${input.symbol || "BTCUSDT"}:${input.reason}`,
    45000,
  );
}

export function relayPhoenixGoodReclaim(input: { symbol?: string; detail: string; score?: number }) {
  const settings = getRelaySettings();
  if (!settings.coach) return false;
  return relay(
    { type: "coach:good_reclaim", payload: { symbol: input.symbol } },
    {
      lane: "coach",
      title: input.symbol ? `${input.symbol} good reclaim` : "Good reclaim",
      detail: input.detail,
      eventType: "coach:good_reclaim",
      symbol: input.symbol,
      score: input.score,
    },
    `coach:good-reclaim:${input.symbol || "BTCUSDT"}:${input.detail}`,
    45000,
  );
}

export function relayPhoenixSetupAlert(input: {
  symbol: string;
  score: number;
  bias: string;
  setupName: string;
  whyNow: string;
  leverageLane?: string;
}) {
  const settings = getRelaySettings();
  if (input.score < settings.minScore) return false;
  const note = `${input.bias} • ${input.setupName}${input.leverageLane ? ` • ${input.leverageLane}` : ""} • ${input.whyNow}`;
  return relay(
    { type: "alert:new_setup", payload: { symbol: input.symbol, note } },
    {
      lane: "alert",
      title: `${input.symbol} live setup`,
      detail: note,
      eventType: "alert:new_setup",
      symbol: input.symbol,
      score: input.score,
    },
    `alert:${input.symbol}:${Math.round(input.score)}:${input.setupName}:${input.bias}`,
    60000,
  );
}

export function relayPhoenixSpeechSummary(input: { symbol: string; text: string; score?: number }) {
  const settings = getRelaySettings();
  if (!settings.coach) return false;
  return relay(
    { type: "speech:say", payload: { text: input.text } },
    {
      lane: "speech",
      title: `${input.symbol} spoken summary`,
      detail: input.text,
      eventType: "speech:say",
      symbol: input.symbol,
      score: input.score,
    },
    `speech:${input.symbol}:${input.text}`,
    90000,
  );
}
