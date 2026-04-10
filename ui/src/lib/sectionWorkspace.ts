import { screenMemoryKey } from "./multiScreenWorkspace";

export type FloatingSectionId =
  | "trading-chart"
  | "trading-chain"
  | "trading-watchlist"
  | "budget-summary"
  | "budget-transactions"
  | "budget-payoff"
  | "homie-presence"
  | "homie-command-deck"
  | "homie-conversation-log";

export type FloatingSection = {
  id: FloatingSectionId;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  z: number;
  visible: boolean;
  kind?: "trading" | "budget" | "homie" | "writers" | "studio";
};

const KEY = screenMemoryKey("fairlyodd.sectionWorkspace.v10.26.17i");

export const DEFAULT_SECTIONS: FloatingSection[] = [
  { id: "trading-chart", title: "Trading Chart", x: 120, y: 100, width: 640, height: 380, z: 1, visible: false, kind: "trading" },
  { id: "trading-chain", title: "Trading Chain", x: 200, y: 140, width: 520, height: 420, z: 2, visible: false, kind: "trading" },
  { id: "trading-watchlist", title: "Trading Watchlist", x: 760, y: 100, width: 340, height: 420, z: 3, visible: false, kind: "trading" },
  { id: "budget-summary", title: "Budget Summary", x: 140, y: 120, width: 420, height: 260, z: 4, visible: false, kind: "budget" },
  { id: "budget-transactions", title: "Budget Transactions", x: 180, y: 180, width: 700, height: 420, z: 5, visible: false, kind: "budget" },
  { id: "budget-payoff", title: "Budget Payoff Planner", x: 900, y: 160, width: 420, height: 340, z: 6, visible: false, kind: "budget" },
  { id: "homie-presence", title: "Homie Presence", x: 960, y: 90, width: 360, height: 260, z: 7, visible: false, kind: "homie" },
  { id: "homie-command-deck", title: "Homie Command Deck", x: 920, y: 380, width: 420, height: 280, z: 8, visible: false, kind: "homie" },
  { id: "homie-conversation-log", title: "Homie Conversation Log", x: 500, y: 500, width: 620, height: 260, z: 9, visible: false, kind: "homie" },
  { id: "writers-home", title: "Writers Home", x: 90, y: 90, width: 520, height: 360, z: 10, visible: false, kind: "writers" },
  { id: "writers-room", title: "Writers Room", x: 140, y: 120, width: 640, height: 420, z: 11, visible: false, kind: "writers" },
  { id: "director-room", title: "Director Room", x: 220, y: 150, width: 520, height: 360, z: 12, visible: false, kind: "writers" },
  { id: "music-lab", title: "Music Lab", x: 260, y: 180, width: 520, height: 340, z: 13, visible: false, kind: "writers" },
  { id: "render-lab", title: "Render Lab", x: 320, y: 200, width: 560, height: 360, z: 14, visible: false, kind: "writers" },
  { id: "producer-ops", title: "Producer Ops", x: 360, y: 220, width: 560, height: 360, z: 15, visible: false, kind: "writers" },
  { id: "studio-pipeline", title: "Studio Pipeline", x: 120, y: 120, width: 820, height: 620, z: 16, visible: false, kind: "studio" },
];

export function loadFloatingSections(): FloatingSection[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SECTIONS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return DEFAULT_SECTIONS;
}
export function saveFloatingSections(sections: FloatingSection[]) {
  try { window.localStorage.setItem(KEY, JSON.stringify(sections)); } catch {}
}
export function bringSectionToFront(sections: FloatingSection[], id: FloatingSectionId): FloatingSection[] {
  const topZ = sections.reduce((m, s) => Math.max(m, s.z), 0) + 1;
  return sections.map((s) => s.id === id ? { ...s, z: topZ } : s);
}
export function toggleSection(sections: FloatingSection[], id: FloatingSectionId, visible?: boolean): FloatingSection[] {
  return bringSectionToFront(sections.map((s) => s.id === id ? { ...s, visible: typeof visible === "boolean" ? visible : !s.visible } : s), id);
}
export function updateSectionBounds(sections: FloatingSection[], id: FloatingSectionId, patch: Partial<FloatingSection>): FloatingSection[] {
  return sections.map((s) => s.id === id ? { ...s, ...patch } : s);
}
export function presetLayout(mode: "trading" | "budget" | "homie" | "night" | "writers" | "studio"): FloatingSection[] {
  const base = DEFAULT_SECTIONS.map((s) => ({ ...s, visible: false }));
  if (mode === "trading") {
if (mode === "studio") {
  return base.map((s) => {
    if (s.id === "studio-pipeline") return { ...s, x: 70, y: 80, width: 900, height: 640, visible: true };
    if (s.id === "writers-room") return { ...s, x: 990, y: 80, width: 520, height: 320, visible: true };
    if (s.id === "render-lab") return { ...s, x: 990, y: 420, width: 520, height: 280, visible: true };
    return s;
  });
}
  if (mode === "writers") {
  return base.map((s) => {
    if (s.id === "writers-home") return { ...s, x: 70, y: 90, width: 420, height: 260, visible: true };
    if (s.id === "writers-room") return { ...s, x: 70, y: 370, width: 700, height: 360, visible: true };
    if (s.id === "director-room") return { ...s, x: 790, y: 90, width: 420, height: 260, visible: true };
    if (s.id === "music-lab") return { ...s, x: 790, y: 370, width: 420, height: 220, visible: true };
    if (s.id === "producer-ops") return { ...s, x: 1225, y: 90, width: 360, height: 260, visible: true };
    return s;
  });
}
  return base.map((s) => {
      if (s.id === "trading-chart") return { ...s, x: 60, y: 80, width: 760, height: 460, visible: true };
      if (s.id === "trading-chain") return { ...s, x: 840, y: 80, width: 460, height: 460, visible: true };
      if (s.id === "trading-watchlist") return { ...s, x: 60, y: 560, width: 420, height: 260, visible: true };
      if (s.id === "homie-command-deck") return { ...s, x: 500, y: 560, width: 520, height: 260, visible: true };
      return s;
    });
  }
  if (mode === "budget") {
if (mode === "studio") {
  return base.map((s) => {
    if (s.id === "studio-pipeline") return { ...s, x: 70, y: 80, width: 900, height: 640, visible: true };
    if (s.id === "writers-room") return { ...s, x: 990, y: 80, width: 520, height: 320, visible: true };
    if (s.id === "render-lab") return { ...s, x: 990, y: 420, width: 520, height: 280, visible: true };
    return s;
  });
}
  if (mode === "writers") {
  return base.map((s) => {
    if (s.id === "writers-home") return { ...s, x: 70, y: 90, width: 420, height: 260, visible: true };
    if (s.id === "writers-room") return { ...s, x: 70, y: 370, width: 700, height: 360, visible: true };
    if (s.id === "director-room") return { ...s, x: 790, y: 90, width: 420, height: 260, visible: true };
    if (s.id === "music-lab") return { ...s, x: 790, y: 370, width: 420, height: 220, visible: true };
    if (s.id === "producer-ops") return { ...s, x: 1225, y: 90, width: 360, height: 260, visible: true };
    return s;
  });
}
  return base.map((s) => {
      if (s.id === "budget-summary") return { ...s, x: 70, y: 90, width: 430, height: 260, visible: true };
      if (s.id === "budget-transactions") return { ...s, x: 70, y: 370, width: 860, height: 360, visible: true };
      if (s.id === "budget-payoff") return { ...s, x: 950, y: 90, width: 360, height: 300, visible: true };
      if (s.id === "homie-presence") return { ...s, x: 950, y: 410, width: 360, height: 220, visible: true };
      return s;
    });
  }
  if (mode === "homie") {
if (mode === "studio") {
  return base.map((s) => {
    if (s.id === "studio-pipeline") return { ...s, x: 70, y: 80, width: 900, height: 640, visible: true };
    if (s.id === "writers-room") return { ...s, x: 990, y: 80, width: 520, height: 320, visible: true };
    if (s.id === "render-lab") return { ...s, x: 990, y: 420, width: 520, height: 280, visible: true };
    return s;
  });
}
  if (mode === "writers") {
  return base.map((s) => {
    if (s.id === "writers-home") return { ...s, x: 70, y: 90, width: 420, height: 260, visible: true };
    if (s.id === "writers-room") return { ...s, x: 70, y: 370, width: 700, height: 360, visible: true };
    if (s.id === "director-room") return { ...s, x: 790, y: 90, width: 420, height: 260, visible: true };
    if (s.id === "music-lab") return { ...s, x: 790, y: 370, width: 420, height: 220, visible: true };
    if (s.id === "producer-ops") return { ...s, x: 1225, y: 90, width: 360, height: 260, visible: true };
    return s;
  });
}
  return base.map((s) => {
      if (s.id === "homie-presence") return { ...s, x: 100, y: 100, width: 380, height: 280, visible: true };
      if (s.id === "homie-command-deck") return { ...s, x: 100, y: 400, width: 520, height: 280, visible: true };
      if (s.id === "homie-conversation-log") return { ...s, x: 640, y: 100, width: 700, height: 580, visible: true };
      return s;
    });
  }
if (mode === "writers") {
  return base.map((s) => {
    if (s.id === "writers-home") return { ...s, x: 70, y: 90, width: 420, height: 260, visible: true };
    if (s.id === "writers-room") return { ...s, x: 70, y: 370, width: 700, height: 360, visible: true };
    if (s.id === "director-room") return { ...s, x: 790, y: 90, width: 420, height: 260, visible: true };
    if (s.id === "music-lab") return { ...s, x: 790, y: 370, width: 420, height: 220, visible: true };
    if (s.id === "producer-ops") return { ...s, x: 1225, y: 90, width: 360, height: 260, visible: true };
    return s;
  });
}
  return base.map((s) => {
    if (s.id === "trading-chart") return { ...s, x: 70, y: 90, width: 620, height: 360, visible: true };
    if (s.id === "trading-watchlist") return { ...s, x: 710, y: 90, width: 320, height: 360, visible: true };
    if (s.id === "homie-presence") return { ...s, x: 1050, y: 90, width: 280, height: 220, visible: true };
    if (s.id === "homie-command-deck") return { ...s, x: 710, y: 470, width: 620, height: 260, visible: true };
    return s;
  });
}
