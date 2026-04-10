import { loadJSON, saveJSON } from "./storage";
import { normalizePanelId } from "./brain";

export type CalEvent = {
  id: string;
  ts: number;
  date: string; // YYYY-MM-DD
  title: string;
  time?: string; // HH:MM (optional)
  notes?: string;
  panelId?: string; // optional deep link
};

export type CalendarStore = { events: CalEvent[] };

export const CALENDAR_KEY = "oddengine:calendar:v1";
export const CALENDAR_EVENT = "oddengine:calendar-changed";

// Home/OS can request Calendar to focus a specific date.
export const CALENDAR_FOCUS_KEY = "oddengine:calendar:focus";
export const CALENDAR_FOCUS_EVENT = "oddengine:calendar-focus";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function fmtDate(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function uid() {
  return `cal_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
}

export function loadCalendar(): CalendarStore {
  return loadJSON<CalendarStore>(CALENDAR_KEY, { events: [] });
}

export function saveCalendar(store: CalendarStore) {
  saveJSON(CALENDAR_KEY, store);
  try {
    window.dispatchEvent(new CustomEvent(CALENDAR_EVENT, { detail: { ts: Date.now() } }));
  } catch {
    // ignore
  }
}

function safeTimeSort(t?: string) {
  if (!t) return "99:99";
  return t;
}

export function upsertEvent(ev: CalEvent) {
  const store = loadCalendar();
  const next = (store.events || []).slice();
  const idx = next.findIndex((x) => x.id === ev.id);
  const normalized = ev.panelId ? normalizePanelId(ev.panelId) : undefined;
  const payload = { ...ev, panelId: normalized };
  if (idx >= 0) next[idx] = payload;
  else next.unshift(payload);
  saveCalendar({ events: next });
}

export function deleteEvent(id: string) {
  const store = loadCalendar();
  const next = (store.events || []).slice().filter((e) => e.id !== id);
  saveCalendar({ events: next });
}

export function listUpcoming(opts: { panelId?: string; limit?: number } = {}) {
  const { panelId, limit = 10 } = opts;
  const store = loadCalendar();
  const nowKey = fmtDate(new Date());
  const normalized = panelId ? normalizePanelId(panelId) : null;
  const all = (store.events || []).slice();
  all.sort((a, b) => (a.date + safeTimeSort(a.time)).localeCompare(b.date + safeTimeSort(b.time)));
  const filtered = all.filter((e) => e.date >= nowKey && (!normalized || normalizePanelId(e.panelId || "") === normalized));
  return filtered.slice(0, limit);
}

export function addQuickEvent(opts: { title: string; panelId?: string; date?: string; time?: string; notes?: string }) {
  const date = opts.date || fmtDate(new Date());
  upsertEvent({
    id: uid(),
    ts: Date.now(),
    date,
    title: opts.title,
    time: opts.time,
    notes: opts.notes,
    panelId: opts.panelId,
  });
}

export function focusCalendarDate(date: string) {
  const d = String(date || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
  try {
    localStorage.setItem(CALENDAR_FOCUS_KEY, JSON.stringify({ date: d, ts: Date.now() }));
  } catch {
    // ignore
  }
  try {
    window.dispatchEvent(new CustomEvent(CALENDAR_FOCUS_EVENT, { detail: { date: d, ts: Date.now() } }));
  } catch {
    // ignore
  }
}

export function readAndClearCalendarFocus(): { date: string } | null {
  try {
    const raw = localStorage.getItem(CALENDAR_FOCUS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.date && /^\d{4}-\d{2}-\d{2}$/.test(String(parsed.date))) {
      localStorage.removeItem(CALENDAR_FOCUS_KEY);
      return { date: String(parsed.date) };
    }
  } catch {
    // ignore
  }
  return null;
}
