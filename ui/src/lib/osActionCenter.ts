import { getPanelMeta, normalizePanelId } from "./brain";

export type ActionCenterVisit = {
  panelId: string;
  title: string;
  icon: string;
  section: string;
  ts: number;
};

export type PulseItem = {
  id: string;
  kind: "info" | "warn" | "good";
  label: string;
  body: string;
  panelId?: string;
  ts: number;
  seen?: boolean;
};

const VISITS_KEY = "oddengine:actioncenter:visits:v1";
const PINNED_KEY = "oddengine:actioncenter:pinned:v1";
const PULSE_KEY = "oddengine:actioncenter:pulse:v1";
const EVENT_NAME = "oddengine:action-center-updated";

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJSON<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

function emitUpdate() {
  try {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { ts: Date.now() } }));
  } catch {
    // ignore
  }
}

function uid(prefix = "pulse") {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36)}`;
}

export function getActionCenterEventName() {
  return EVENT_NAME;
}

export function getRecentPanelVisits(limit = 8): ActionCenterVisit[] {
  return readJSON<ActionCenterVisit[]>(VISITS_KEY, []).slice(0, limit);
}

export function recordPanelVisit(panelId: string) {
  const normalized = normalizePanelId(panelId);
  if (!normalized) return;
  const meta = getPanelMeta(normalized);
  const current: ActionCenterVisit = {
    panelId: normalized,
    title: meta.title,
    icon: meta.icon,
    section: meta.section,
    ts: Date.now(),
  };
  const visits = readJSON<ActionCenterVisit[]>(VISITS_KEY, []);
  const without = visits.filter((item) => item.panelId !== normalized);
  const next = [current, ...without].slice(0, 18);
  writeJSON(VISITS_KEY, next);

  const previous = visits[0];
  if (!previous || previous.panelId !== normalized) {
    maybeCreatePulse(normalized, previous?.panelId || "");
  }
  emitUpdate();
}

function maybeCreatePulse(currentPanelId: string, previousPanelId: string) {
  const currentMeta = getPanelMeta(currentPanelId);
  if (!previousPanelId) {
    addPulse({
      kind: "info",
      label: `Now in ${currentMeta.title}`,
      body: `${currentMeta.icon} ${currentMeta.sub}`,
      panelId: currentPanelId,
    });
    return;
  }
  const previousMeta = getPanelMeta(previousPanelId);
  if (currentMeta.section !== previousMeta.section) {
    addPulse({
      kind: "info",
      label: `Shifted to ${currentMeta.section}`,
      body: `${previousMeta.title} → ${currentMeta.title}`,
      panelId: currentPanelId,
    });
  }
}

export function getPinnedPanelIds(): string[] {
  return readJSON<string[]>(PINNED_KEY, []);
}

export function togglePinnedPanel(panelId: string) {
  const normalized = normalizePanelId(panelId);
  const current = getPinnedPanelIds();
  const next = current.includes(normalized)
    ? current.filter((item) => item !== normalized)
    : [normalized, ...current].slice(0, 8);
  writeJSON(PINNED_KEY, next);
  emitUpdate();
}

export function addPulse(item: Omit<PulseItem, "id" | "ts">) {
  const pulses = readJSON<PulseItem[]>(PULSE_KEY, []);
  const next: PulseItem = {
    id: uid(),
    ts: Date.now(),
    seen: false,
    ...item,
  };
  writeJSON(PULSE_KEY, [next, ...pulses].slice(0, 18));
  emitUpdate();
}

export function getPulseItems(limit = 6): PulseItem[] {
  return readJSON<PulseItem[]>(PULSE_KEY, []).slice(0, limit);
}

export function dismissPulse(id: string) {
  const pulses = readJSON<PulseItem[]>(PULSE_KEY, []);
  writeJSON(PULSE_KEY, pulses.filter((item) => item.id !== id));
  emitUpdate();
}

export function markPulseSeen(id: string) {
  const pulses = readJSON<PulseItem[]>(PULSE_KEY, []);
  writeJSON(PULSE_KEY, pulses.map((item) => item.id === id ? { ...item, seen: true } : item));
  emitUpdate();
}

export function getLiveStatus(activePanelId: string) {
  const normalized = normalizePanelId(activePanelId);
  const active = getPanelMeta(normalized);
  const recent = getRecentPanelVisits(6);
  const previous = recent[1] ? getPanelMeta(recent[1].panelId) : null;
  const pinned = getPinnedPanelIds();
  const unseen = getPulseItems(18).filter((item) => !item.seen).length;
  const focusLane = inferFocusLane(normalized);
  return {
    activePanelId: normalized,
    activeTitle: active.title,
    activeIcon: active.icon,
    focusLane,
    previousTitle: previous?.title || "",
    pulseCount: unseen,
    recentCount: recent.length,
    pinnedCount: pinned.length,
    updatedAt: Date.now(),
  };
}

function inferFocusLane(panelId: string) {
  const title = getPanelMeta(panelId).title.toLowerCase();
  const section = getPanelMeta(panelId).section.toLowerCase();
  if (title.includes("trade") || title.includes("market") || title.includes("option")) return "Trading";
  if (title.includes("family") || title.includes("grocery") || title.includes("calendar") || title.includes("chores")) return "Family";
  if (title.includes("writer") || title.includes("studio") || title.includes("book") || title.includes("music") || title.includes("render")) return "Studio";
  if (title.includes("homie") || title.includes("brain")) return "Homie";
  if (section.includes("oddengine") || panelId === "Home") return "Home";
  return "Focus";
}

export function buildResumeActions(activePanelId: string) {
  const recent = getRecentPanelVisits(5).filter((item) => item.panelId !== normalizePanelId(activePanelId));
  const pinned = getPinnedPanelIds().slice(0, 4).map((id) => {
    const meta = getPanelMeta(id);
    return { panelId: id, label: meta.title, sub: meta.sub, icon: meta.icon, type: "pinned" as const };
  });
  const recentActions = recent.map((item) => ({ panelId: item.panelId, label: item.title, sub: `Recent • ${item.section}`, icon: item.icon, type: "recent" as const }));
  const defaults = ["Home", "Homie", "Trading", "Books", "Calendar"].map((id) => {
    const meta = getPanelMeta(id);
    return { panelId: id, label: meta.title, sub: meta.sub, icon: meta.icon, type: "core" as const };
  });
  const merged = [...pinned, ...recentActions, ...defaults].filter((item, idx, arr) => arr.findIndex((x) => x.panelId === item.panelId) === idx);
  return merged.slice(0, 8);
}
