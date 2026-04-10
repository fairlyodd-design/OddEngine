import { loadJSON, saveJSON } from "./storage";

export const SYSTEM_STATE_KEY = "oddengine:system-state:v1";
export const SYSTEM_STATE_EVENT = "oddengine:system-state";

export type PanelRuntimeStatus = "idle" | "loading" | "ready" | "error";

export type PanelRuntimeState = {
  panelId: string;
  status: PanelRuntimeStatus;
  updatedAt: number;
  summary?: string;
  error?: string;
  lastGood?: any;
  metrics?: Record<string, number | string | boolean | null | undefined>;
  interactionCount?: number;
};

export type SystemInteraction = {
  id: string;
  panelId: string;
  label: string;
  ts: number;
};

export type SystemState = {
  panels: Record<string, PanelRuntimeState>;
  interactions: SystemInteraction[];
};

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function normalize(value: any): SystemState {
  const safe = value && typeof value === "object" ? value : {};
  return {
    panels: safe.panels && typeof safe.panels === "object" ? safe.panels : {},
    interactions: Array.isArray(safe.interactions) ? safe.interactions : [],
  };
}

export function readSystemState(): SystemState {
  return normalize(loadJSON<any>(SYSTEM_STATE_KEY, { panels: {}, interactions: [] }));
}

export function writeSystemState(next: SystemState) {
  saveJSON(SYSTEM_STATE_KEY, next);
  try {
    window.dispatchEvent(new CustomEvent(SYSTEM_STATE_EVENT, { detail: { ts: Date.now() } }));
  } catch {
    // ignore
  }
}

export function updateSystemPanel(panelId: string, patch: Partial<PanelRuntimeState>) {
  const state = readSystemState();
  const prev = state.panels[panelId] || { panelId, status: "idle" as PanelRuntimeStatus, updatedAt: 0, interactionCount: 0 };
  state.panels[panelId] = {
    ...prev,
    ...patch,
    panelId,
    updatedAt: patch.updatedAt || Date.now(),
    interactionCount: typeof patch.interactionCount === "number" ? patch.interactionCount : prev.interactionCount || 0,
  };
  writeSystemState(state);
}

export function markPanelInteraction(panelId: string, label: string) {
  const state = readSystemState();
  const prev = state.panels[panelId] || { panelId, status: "idle" as PanelRuntimeStatus, updatedAt: 0, interactionCount: 0 };
  state.panels[panelId] = {
    ...prev,
    panelId,
    updatedAt: Date.now(),
    interactionCount: Number(prev.interactionCount || 0) + 1,
  };
  state.interactions = [{ id: uid(), panelId, label, ts: Date.now() }, ...state.interactions].slice(0, 40);
  writeSystemState(state);
}

export function getSystemHealthSummary() {
  const state = readSystemState();
  const panels = Object.values(state.panels).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  const scoreFor = (item: PanelRuntimeState) => {
    if (item.status === "error") return 34;
    if (item.status === "loading") return 66;
    if (item.status === "ready") return 92;
    return 76;
  };
  const avgHealth = panels.length ? Math.round(panels.reduce((sum, item) => sum + scoreFor(item), 0) / panels.length) : 0;
  const issues = panels.filter((item) => item.status === "error" || item.error).slice(0, 6);
  const hotPanels = panels.filter((item) => item.status === "loading" || item.status === "ready").slice(0, 6);
  return {
    panels,
    issues,
    hotPanels,
    interactions: state.interactions.slice(0, 8),
    avgHealth,
    text: issues.length
      ? issues.map((item) => `${item.panelId}: ${item.error || item.summary || item.status}`).join("\n")
      : hotPanels.length
      ? hotPanels.map((item) => `${item.panelId}: ${item.summary || item.status}`).join("\n")
      : "System truth layer is standing by.",
  };
}
