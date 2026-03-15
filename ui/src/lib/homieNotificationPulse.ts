export type HomiePulseItem = {
  id: string;
  kind: "visit" | "nudge" | "family" | "trading" | "studio" | "system";
  title: string;
  body?: string;
  panelId?: string;
  seen?: boolean;
  ts: number;
};

const KEY = "oddengine:homie:pulse:v1";
const EVENT = "oddengine:homie-pulse";
export const HOMIE_PULSE_EVENT = EVENT;

function readAll(): HomiePulseItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as HomiePulseItem[]) : [];
  } catch {
    return [];
  }
}

function writeAll(items: HomiePulseItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent(EVENT, { detail: items }));
  } catch {
    // ignore
  }
}

export function loadHomiePulse() {
  return readAll().sort((a, b) => b.ts - a.ts).slice(0, 20);
}

export function pushHomiePulse(item: HomiePulseItem) {
  const items = [item, ...readAll().filter((x) => x.id !== item.id)].slice(0, 24);
  writeAll(items);
}

export function markPulseSeen(id: string) {
  writeAll(readAll().map((x) => (x.id === id ? { ...x, seen: true } : x)));
}

export function dismissPulse(id: string) {
  writeAll(readAll().filter((x) => x.id !== id));
}

export function getUnseenPulseCount() {
  return readAll().filter((x) => !x.seen).length;
}
