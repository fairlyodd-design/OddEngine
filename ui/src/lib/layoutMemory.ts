import { loadJSON, saveJSON } from "./storage";

export type ShellSidebarLayoutStore = {
  leftRailWidth: number;
  assistantWidth: number;
  assistantHeight: number;
  activityRailWidth: number;
  activityRailHeight: number;
};

const SHELL_SIDEBAR_LAYOUT_KEY = "oddengine:shellSidebarLayout:v2";

const DEFAULT_SHELL_SIDEBAR_LAYOUT: ShellSidebarLayoutStore = {
  leftRailWidth: 280,
  assistantWidth: 340,
  assistantHeight: 820,
  activityRailWidth: 360,
  activityRailHeight: 860,
};

const SIZE_LIMITS: Record<keyof ShellSidebarLayoutStore, { min: number; max: number }> = {
  leftRailWidth: { min: 220, max: 520 },
  assistantWidth: { min: 260, max: 760 },
  assistantHeight: { min: 320, max: 1600 },
  activityRailWidth: { min: 280, max: 760 },
  activityRailHeight: { min: 360, max: 1800 },
};

export function clampShellSidebarSize(key: keyof ShellSidebarLayoutStore, value: number) {
  const { min, max } = SIZE_LIMITS[key];
  const next = Number.isFinite(value) ? value : DEFAULT_SHELL_SIDEBAR_LAYOUT[key];
  return Math.max(min, Math.min(max, Math.round(next)));
}

export function loadShellSidebarLayout(): ShellSidebarLayoutStore {
  const raw = loadJSON<Partial<ShellSidebarLayoutStore>>(SHELL_SIDEBAR_LAYOUT_KEY, DEFAULT_SHELL_SIDEBAR_LAYOUT);
  return {
    leftRailWidth: clampShellSidebarSize("leftRailWidth", raw?.leftRailWidth ?? DEFAULT_SHELL_SIDEBAR_LAYOUT.leftRailWidth),
    assistantWidth: clampShellSidebarSize("assistantWidth", raw?.assistantWidth ?? DEFAULT_SHELL_SIDEBAR_LAYOUT.assistantWidth),
    assistantHeight: clampShellSidebarSize("assistantHeight", raw?.assistantHeight ?? DEFAULT_SHELL_SIDEBAR_LAYOUT.assistantHeight),
    activityRailWidth: clampShellSidebarSize("activityRailWidth", raw?.activityRailWidth ?? DEFAULT_SHELL_SIDEBAR_LAYOUT.activityRailWidth),
    activityRailHeight: clampShellSidebarSize("activityRailHeight", raw?.activityRailHeight ?? DEFAULT_SHELL_SIDEBAR_LAYOUT.activityRailHeight),
  };
}

export function saveShellSidebarLayout(layout: ShellSidebarLayoutStore) {
  saveJSON(SHELL_SIDEBAR_LAYOUT_KEY, {
    leftRailWidth: clampShellSidebarSize("leftRailWidth", layout.leftRailWidth),
    assistantWidth: clampShellSidebarSize("assistantWidth", layout.assistantWidth),
    assistantHeight: clampShellSidebarSize("assistantHeight", layout.assistantHeight),
    activityRailWidth: clampShellSidebarSize("activityRailWidth", layout.activityRailWidth),
    activityRailHeight: clampShellSidebarSize("activityRailHeight", layout.activityRailHeight),
  });
}


export type FreeformPaneRect = {
  x: number;
  y: number;
  w: number;
  h: number;
  z?: number;
};

const FREEFORM_WORKSPACE_KEY = "oddengine:freeformWorkspace:v1";

type FreeformWorkspaceStore = Record<string, FreeformPaneRect>;

function viewportBounds() {
  if (typeof window === "undefined") {
    return { width: 1600, height: 1000 };
  }
  const vv = window.visualViewport;
  const width = Math.round(vv?.width || window.innerWidth || document.documentElement.clientWidth || 1600);
  const height = Math.round(vv?.height || window.innerHeight || document.documentElement.clientHeight || 1000);
  return { width: Math.max(1280, width), height: Math.max(720, height) };
}

export function clampFreeformPaneRect(rect: FreeformPaneRect, defaults: FreeformPaneRect & { minWidth?: number; minHeight?: number }) {
  const viewport = viewportBounds();
  const minWidth = Math.max(220, Number(defaults.minWidth || 240));
  const minHeight = Math.max(120, Number(defaults.minHeight || 180));
  const width = Math.max(minWidth, Math.min(Math.round(rect.w || defaults.w), Math.max(minWidth, viewport.width - 24)));
  const height = Math.max(minHeight, Math.min(Math.round(rect.h || defaults.h), Math.max(minHeight, viewport.height - 24)));
  const x = Math.max(8, Math.min(Math.round(rect.x ?? defaults.x), Math.max(8, viewport.width - width - 8)));
  const y = Math.max(8, Math.min(Math.round(rect.y ?? defaults.y), Math.max(8, viewport.height - height - 8)));
  return { x, y, w: width, h: height, z: Math.max(10, Math.round(rect.z || defaults.z || 10)) };
}

export function loadFreeformWorkspace(): FreeformWorkspaceStore {
  return loadJSON<FreeformWorkspaceStore>(FREEFORM_WORKSPACE_KEY, {} as FreeformWorkspaceStore) || {};
}

export function loadFreeformPaneRect(paneId: string, defaults: FreeformPaneRect) {
  const store = loadFreeformWorkspace();
  return clampFreeformPaneRect(store[paneId] || defaults, defaults);
}

export function saveFreeformPaneRect(paneId: string, rect: FreeformPaneRect) {
  const store = loadFreeformWorkspace();
  store[paneId] = rect;
  saveJSON(FREEFORM_WORKSPACE_KEY, store);
}
