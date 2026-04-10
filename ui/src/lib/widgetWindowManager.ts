import { loadJSON, saveJSON } from "./storage";

export type WidgetGeometry = {
  id: string;
  panelId: string;
  title: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  floating?: boolean;
  pinned?: boolean;
  zIndex?: number;
  detached?: boolean;
  updatedAt: number;
};

const KEY = "oddengine:widget-window-manager:v2";
const LEGACY_KEY = "oddengine:widget-window-manager:v1";
const EVENT = "oddengine:widget-window-manager";

function dispatchChange() {
  try {
    window.dispatchEvent(new CustomEvent(EVENT));
  } catch {}
}

function save(items: WidgetGeometry[]) {
  saveJSON(KEY, items.slice(0, 1200));
  dispatchChange();
}

function normalize(items: WidgetGeometry[]): WidgetGeometry[] {
  return (items || [])
    .map((item) => ({ ...item, updatedAt: Number(item.updatedAt || Date.now()) }))
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export function listWidgetGeometries(): WidgetGeometry[] {
  const current = loadJSON<WidgetGeometry[]>(KEY, []);
  if (current && current.length) return normalize(current);
  const legacy = loadJSON<WidgetGeometry[]>(LEGACY_KEY, []);
  if (legacy && legacy.length) {
    const next = normalize(legacy);
    save(next);
    return next;
  }
  return [];
}

export function upsertWidgetGeometry(input: WidgetGeometry) {
  const next = { ...input, updatedAt: Date.now() };
  save([next, ...listWidgetGeometries().filter((item) => item.id !== next.id)]);
  return next;
}

export function getWidgetGeometry(id: string) {
  return listWidgetGeometries().find((item) => item.id === id) || null;
}

export function getPanelWidgetGeometries(panelId: string) {
  return listWidgetGeometries().filter((item) => item.panelId === panelId);
}

export function clearWidgetGeometries(panelId?: string) {
  const next = panelId ? listWidgetGeometries().filter((item) => item.panelId !== panelId) : [];
  save(next);
}

export function getNextWidgetZIndex() {
  const top = listWidgetGeometries().reduce((max, item) => Math.max(max, Number(item.zIndex || 0)), 120);
  return top + 1;
}

export const WIDGET_WINDOW_MANAGER_EVENT = EVENT;
