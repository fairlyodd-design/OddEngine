import { loadJSON, saveJSON } from "./storage";

export type WidgetLayout = Record<string, string[]>;

export function normalizeWidgetLayout(layout: WidgetLayout | null | undefined, defaults: WidgetLayout): WidgetLayout {
  const next: WidgetLayout = {};
  const seen = new Set<string>();
  for (const [zone, ids] of Object.entries(defaults)) {
    const raw = Array.isArray(layout?.[zone]) ? layout![zone] : [];
    next[zone] = raw.filter((id): id is string => typeof id === 'string' && ids.includes(id) && !seen.has(id));
    next[zone].forEach((id) => seen.add(id));
  }
  for (const ids of Object.values(defaults)) {
    for (const id of ids) {
      if (!seen.has(id)) {
        const fallbackZone = Object.keys(defaults).find((zone) => defaults[zone].includes(id));
        if (fallbackZone) {
          next[fallbackZone] = next[fallbackZone] || [];
          next[fallbackZone].push(id);
          seen.add(id);
        }
      }
    }
  }
  return next;
}

export function loadWidgetLayout(key: string, defaults: WidgetLayout): WidgetLayout {
  return normalizeWidgetLayout(loadJSON<WidgetLayout>(key, defaults), defaults);
}

export function saveWidgetLayout(key: string, layout: WidgetLayout) {
  saveJSON(key, layout);
}

export function moveWidget(layout: WidgetLayout, widgetId: string, sourceZone: string, targetZone: string, targetIndex?: number): WidgetLayout {
  const next: WidgetLayout = Object.fromEntries(Object.entries(layout).map(([zone, ids]) => [zone, [...ids].filter((id) => id !== widgetId)]));
  const zone = next[targetZone] || [];
  let idx = typeof targetIndex === 'number' ? targetIndex : zone.length;
  if (idx < 0) idx = 0;
  if (idx > zone.length) idx = zone.length;
  zone.splice(idx, 0, widgetId);
  next[targetZone] = zone;
  if (!next[sourceZone]) next[sourceZone] = [];
  return next;
}
