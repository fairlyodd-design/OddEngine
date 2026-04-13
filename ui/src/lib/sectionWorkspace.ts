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
  | "homie-conversation-log"
  | "writers-home"
  | "writers-room"
  | "director-room"
  | "music-lab"
  | "render-lab"
  | "producer-ops"
  | "studio-pipeline";

export type FloatingSectionKind = "trading" | "budget" | "homie" | "writers" | "studio";

export type FloatingSection = {
  id: FloatingSectionId;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  z: number;
  visible: boolean;
  kind?: FloatingSectionKind;
};

const KEY = screenMemoryKey("fairlyodd.sectionWorkspace.v10.35.5d");

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
    if (Array.isArray(parsed)) return parsed as FloatingSection[];
  } catch {}
  return DEFAULT_SECTIONS;
}

export function saveFloatingSections(sections: FloatingSection[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(sections));
  } catch {}
}

export function bringSectionToFront(sections: FloatingSection[], id: FloatingSectionId): FloatingSection[] {
  const topZ = sections.reduce((max, section) => Math.max(max, section.z), 0) + 1;
  return sections.map((section) => (section.id === id ? { ...section, z: topZ } : section));
}

export function toggleSection(sections: FloatingSection[], id: FloatingSectionId, visible?: boolean): FloatingSection[] {
  return bringSectionToFront(
    sections.map((section) => (section.id === id ? { ...section, visible: typeof visible === "boolean" ? visible : !section.visible } : section)),
    id
  );
}

export function updateSectionBounds(sections: FloatingSection[], id: FloatingSectionId, patch: Partial<FloatingSection>): FloatingSection[] {
  return sections.map((section) => (section.id === id ? { ...section, ...patch } : section));
}

export function presetLayout(mode: FloatingSectionKind | "night"): FloatingSection[] {
  const base = DEFAULT_SECTIONS.map((section) => ({ ...section, visible: false }));

  const apply = (placements: Partial<Record<FloatingSectionId, Partial<FloatingSection>>>) =>
    base.map((section) => {
      const placement = placements[section.id];
      return placement ? { ...section, ...placement, visible: true } : section;
    });

  switch (mode) {
    case "studio":
      return apply({
        "studio-pipeline": { x: 70, y: 80, width: 900, height: 640 },
        "writers-room": { x: 990, y: 80, width: 520, height: 320 },
        "render-lab": { x: 990, y: 420, width: 520, height: 280 },
      });
    case "writers":
      return apply({
        "writers-home": { x: 70, y: 90, width: 420, height: 260 },
        "writers-room": { x: 70, y: 370, width: 700, height: 360 },
        "director-room": { x: 790, y: 90, width: 420, height: 260 },
        "music-lab": { x: 790, y: 370, width: 420, height: 220 },
        "producer-ops": { x: 1225, y: 90, width: 360, height: 260 },
      });
    case "trading":
      return apply({
        "trading-chart": { x: 60, y: 80, width: 760, height: 460 },
        "trading-chain": { x: 840, y: 80, width: 460, height: 460 },
        "trading-watchlist": { x: 60, y: 560, width: 420, height: 260 },
        "homie-command-deck": { x: 500, y: 560, width: 520, height: 260 },
      });
    case "budget":
      return apply({
        "budget-summary": { x: 70, y: 90, width: 430, height: 260 },
        "budget-transactions": { x: 70, y: 370, width: 860, height: 360 },
        "budget-payoff": { x: 950, y: 90, width: 360, height: 300 },
        "homie-presence": { x: 950, y: 410, width: 360, height: 220 },
      });
    case "homie":
      return apply({
        "homie-presence": { x: 100, y: 100, width: 380, height: 280 },
        "homie-command-deck": { x: 100, y: 400, width: 520, height: 280 },
        "homie-conversation-log": { x: 640, y: 100, width: 700, height: 580 },
      });
    case "night":
    default:
      return apply({
        "trading-chart": { x: 70, y: 90, width: 620, height: 360 },
        "trading-watchlist": { x: 710, y: 90, width: 320, height: 360 },
        "homie-presence": { x: 1050, y: 90, width: 280, height: 220 },
        "homie-command-deck": { x: 710, y: 470, width: 620, height: 260 },
      });
  }
}
