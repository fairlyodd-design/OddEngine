export type HomieMemoryContext = {
  recentPanels: string[];
  favoritePanels: string[];
  currentMode: string;
  unfinishedFlows: string[];
  lastUpdated: number;
};

const KEY = "oddengine:homie:memory-context:v1";
const EVENT = "oddengine:homie-memory-context";
export const HOMIE_MEMORY_CONTEXT_EVENT = EVENT;

function safeRead<T>(fallback: T): T {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function safeWrite(value: HomieMemoryContext) {
  try {
    localStorage.setItem(KEY, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent(EVENT, { detail: value }));
  } catch {
    // ignore
  }
}

export function loadHomieMemoryContext(): HomieMemoryContext {
  return safeRead<HomieMemoryContext>({
    recentPanels: [],
    favoritePanels: [],
    currentMode: "home",
    unfinishedFlows: [],
    lastUpdated: 0,
  });
}

export function rememberPanelVisit(panelId: string) {
  const next = loadHomieMemoryContext();
  const normalized = String(panelId || "Home");
  next.recentPanels = [normalized, ...next.recentPanels.filter((x) => x !== normalized)].slice(0, 8);
  next.currentMode = normalized.toLowerCase().includes("trading") || normalized.toLowerCase().includes("options") ? "trading"
    : normalized.toLowerCase().includes("book") || normalized.toLowerCase().includes("studio") ? "studio"
    : normalized.toLowerCase().includes("family") || normalized.toLowerCase().includes("grocery") || normalized.toLowerCase().includes("chore") ? "family"
    : "home";
  next.lastUpdated = Date.now();
  safeWrite(next);
}

export function toggleFavoritePanel(panelId: string) {
  const next = loadHomieMemoryContext();
  const normalized = String(panelId || "Home");
  next.favoritePanels = next.favoritePanels.includes(normalized)
    ? next.favoritePanels.filter((x) => x !== normalized)
    : [...next.favoritePanels, normalized].slice(-8);
  next.lastUpdated = Date.now();
  safeWrite(next);
}

export function setUnfinishedFlows(flows: string[]) {
  const next = loadHomieMemoryContext();
  next.unfinishedFlows = [...new Set((flows || []).filter(Boolean))].slice(0, 8);
  next.lastUpdated = Date.now();
  safeWrite(next);
}
