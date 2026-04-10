import { loadJSON, saveJSON } from "./storage";

export const OPERATOR_MEMORY_KEY = "oddengine:operator:memory:v1";
export const OPERATOR_MEMORY_EVENT = "oddengine:operator-memory";

type PanelTone = "good" | "warn" | "bad" | "muted";

export type OperatorPanelContext = {
  panelId: string;
  title?: string;
  summary: string;
  nextMove?: string;
  blocker?: string;
  score?: number;
  tone?: PanelTone;
  chips?: string[];
  updatedAt: number;
  routeHint?: string;
};

export type OperatorMemoryItem = {
  id: string;
  panelId: string;
  title: string;
  body: string;
  ts: number;
};

export type OperatorMemoryState = {
  panels: Record<string, OperatorPanelContext>;
  feed: OperatorMemoryItem[];
};

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function normalizeState(value: any): OperatorMemoryState {
  const safe = value && typeof value === "object" ? value : {};
  return {
    panels: safe.panels && typeof safe.panels === "object" ? safe.panels : {},
    feed: Array.isArray(safe.feed) ? safe.feed : [],
  };
}

export function readOperatorMemory(): OperatorMemoryState {
  return normalizeState(loadJSON<any>(OPERATOR_MEMORY_KEY, { panels: {}, feed: [] }));
}

export function writeOperatorMemory(next: OperatorMemoryState) {
  saveJSON(OPERATOR_MEMORY_KEY, next);
  try {
    window.dispatchEvent(new CustomEvent(OPERATOR_MEMORY_EVENT, { detail: { ts: Date.now() } }));
  } catch {
    // ignore
  }
}

export function updatePanelContext(
  panelId: string,
  partial: Omit<OperatorPanelContext, "panelId" | "updatedAt"> & { updatedAt?: number }
) {
  const state = readOperatorMemory();
  const prev = state.panels[panelId] || { panelId, summary: "", updatedAt: 0 };
  state.panels[panelId] = {
    ...prev,
    ...partial,
    panelId,
    updatedAt: partial.updatedAt || Date.now(),
  };
  writeOperatorMemory(state);
}

export function pushOperatorMemory(panelId: string, title: string, body: string) {
  const state = readOperatorMemory();
  state.feed = [{ id: uid(), panelId, title, body, ts: Date.now() }, ...state.feed].slice(0, 24);
  writeOperatorMemory(state);
}

export function getOperatorSummary() {
  const state = readOperatorMemory();
  const panels = Object.values(state.panels).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  const top = panels.slice(0, 5);
  const lines = top.map((item) => `${item.title || item.panelId}: ${item.summary}${item.nextMove ? ` | Next: ${item.nextMove}` : ""}${item.blocker ? ` | Blocker: ${item.blocker}` : ""}`);
  return {
    panels: top,
    feed: state.feed.slice(0, 6),
    text: lines.join("\n") || "No shared operator memory yet.",
  };
}
