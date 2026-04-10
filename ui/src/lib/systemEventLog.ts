import { loadJSON, saveJSON } from "./storage";

export type SystemEventLevel = "info" | "good" | "warn" | "error";
export type SystemEvent = {
  id: string;
  ts: number;
  level: SystemEventLevel;
  scope: string;
  title: string;
  body?: string;
  runId?: string;
};

const KEY = "oddengine:systemTruth:events:v1";
const EVENT = "oddengine:system-truth:events";

function uid() {
  return `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function save(items: SystemEvent[]) {
  saveJSON(KEY, items.slice(0, 500));
  try { window.dispatchEvent(new CustomEvent(EVENT)); } catch {}
}

export function listSystemEvents(): SystemEvent[] {
  return loadJSON<SystemEvent[]>(KEY, []).sort((a, b) => (b.ts || 0) - (a.ts || 0));
}

export function logSystemEvent(input: Omit<SystemEvent, "id" | "ts"> & { ts?: number }) {
  const next: SystemEvent = { id: uid(), ts: input.ts || Date.now(), level: input.level, scope: input.scope, title: input.title, body: input.body, runId: input.runId };
  save([next, ...listSystemEvents()]);
  return next;
}

export function clearSystemEvents() {
  save([]);
}

export const SYSTEM_EVENT_LOG_EVENT = EVENT;
