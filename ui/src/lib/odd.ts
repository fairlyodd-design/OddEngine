import { loadJSON, saveJSON } from "./storage";

export type DetectedEmulator = {
  id: string;
  name: string;
  kind: string;
  exePath: string;
  notes?: string;
};

export type DetectedPlugin = {
  id: string;
  name: string;
  version: string;
  description?: string;
  ui?: string;
  actions?: any[];
};

export type HomieChatMsg = {
  role: "system" | "user" | "assistant" | string;
  content: string;
};

export type Odd = {
  isDesktop: () => boolean;
  openWindow: (opts: any) => Promise<any>;
  tileRoutineWindows: (payload: any) => Promise<any>;
  closeRoutineWindows: (payload: any) => Promise<any>;
  getDisplays: () => Promise<any>;
  openEntertainmentPlayer: (opts: any) => Promise<any>;
  focusEntertainmentPlayer: () => Promise<any>;
  getEntertainmentLast: () => Promise<any>;
  resetWindowBounds: () => Promise<any>;
  getSystemInfo: () => Promise<any>;
  getRuntimeStats: () => Promise<any>;
  updateGrowBundle: () => Promise<any>;
  growPlannerHandoff: (payload: any) => Promise<any>;
  fetchText: (payload: any) => Promise<any>;
  pickDirectory: (opts?: any) => Promise<any>;
  pickFile: (opts?: any) => Promise<any>;
  openPath: (p: string) => Promise<any>;
  openExternal: (url: string) => Promise<any>;
  shellOpenPath: (p: string) => Promise<any>;
  generate: (payload: any) => Promise<any>;
  run: (payload: any) => Promise<any>;
  stopRun: (id: string) => Promise<any>;
  tcpPing: (payload: any) => Promise<any>;
  onRunOutput: (cb: (msg: any) => void) => () => void;
  getDevSnapshot: (opts?: any) => Promise<any>;
  runPlaybook: (payload: any) => Promise<any>;
  listPlugins: () => Promise<{ ok: boolean; plugins: DetectedPlugin[]; pluginDir?: string }>;
  openPluginsFolder: () => Promise<any>;
  detectEmulators: () => Promise<any>;
  emuAction: (payload: any) => Promise<any>;
  homieCheck: () => Promise<any>;
  homieChat: (payload: { messages: HomieChatMsg[]; model?: string; system?: string; temperature?: number } | any) => Promise<any>;
  voiceBridgeProbe: (payload: any) => Promise<any>;
  voiceBridgeTranscribe: (payload: any) => Promise<any>;
  vaultGet: () => Promise<any>;
  vaultSet: (next: any) => Promise<any>;
  vaultStatus: () => Promise<any>;
  [key: string]: any;
};

declare global {
  interface Window {
    __ODD__?: Odd;
  }
}

export function isDesktop(): boolean {
  return !!(window.__ODD__ && window.__ODD__.isDesktop && window.__ODD__.isDesktop());
}

function buildUrl(panel?: string, query?: Record<string, string>) {
  const u = new URL(window.location.href);
  if (panel) u.searchParams.set("panel", panel);
  if (query) Object.entries(query).forEach(([k, v]) => u.searchParams.set(k, v));
  return u.toString();
}

export function oddApi(): Odd {
  if (window.__ODD__) {
    return {
      ...window.__ODD__,
      openWindow: window.__ODD__.openWindow || (async () => ({ ok: false, error: "Not available" })),
      tileRoutineWindows: window.__ODD__.tileRoutineWindows || (async () => ({ ok: false, error: "Not available" })),
      closeRoutineWindows: window.__ODD__.closeRoutineWindows || (async () => ({ ok: false, error: "Not available" })),
      getDisplays: window.__ODD__.getDisplays || (async () => ({ ok: false, displays: [] })),
      openEntertainmentPlayer: window.__ODD__.openEntertainmentPlayer || (async () => ({ ok: false, error: "Not available" })),
      focusEntertainmentPlayer: window.__ODD__.focusEntertainmentPlayer || (async () => ({ ok: false, shown: false })),
      getEntertainmentLast: window.__ODD__.getEntertainmentLast || (async () => ({ ok: false })),
      resetWindowBounds: window.__ODD__.resetWindowBounds || (async () => ({ ok: false, error: "Not available" })),
      getRuntimeStats: window.__ODD__.getRuntimeStats || (async () => ({ ok: false, error: "Not available" })),
      updateGrowBundle: window.__ODD__.updateGrowBundle || (async () => ({ ok: false, error: "Not available" })),
      growPlannerHandoff: window.__ODD__.growPlannerHandoff || (async () => ({ ok: false, error: "Not available" })),
      openExternal: window.__ODD__.openExternal || (async () => ({ ok: false, error: "Not available" })),
      shellOpenPath: window.__ODD__.shellOpenPath || (async () => ({ ok: false, error: "Not available" })),
      homieChat: window.__ODD__.homieChat || (async () => ({ ok: false, reply: "" })),
      voiceBridgeProbe: window.__ODD__.voiceBridgeProbe || (async () => ({ ok: false, error: "Not available" })),
      voiceBridgeTranscribe: window.__ODD__.voiceBridgeTranscribe || (async () => ({ ok: false, error: "Not available" })),
      vaultGet: window.__ODD__.vaultGet || (async () => ({ ok: false, error: "Not available" })),
      vaultSet: window.__ODD__.vaultSet || (async () => ({ ok: false, error: "Not available" })),
      vaultStatus: window.__ODD__.vaultStatus || (async () => ({ ok: false, error: "Not available" })),
    };
  }

  return {
    isDesktop: () => false,
    getSystemInfo: async () => ({ ok: false }),
    getRuntimeStats: async () => ({ ok: false, error: "Not available in browser" }),
    updateGrowBundle: async () => ({ ok: false }),
    growPlannerHandoff: async () => ({ ok: false }),
    fetchText: async () => ({ ok: false, error: "Not available in browser" }),
    pickDirectory: async () => ({ ok: false }),
    pickFile: async () => ({ ok: false }),
    openPath: async () => ({ ok: false }),
    openExternal: async (url: string) => {
      try {
        window.open(url, "_blank", "noopener,noreferrer");
        return { ok: true };
      } catch (error: any) {
        return { ok: false, error: String(error?.message || error) };
      }
    },
    shellOpenPath: async () => ({ ok: false, error: "Not available in browser" }),
    generate: async () => ({ ok: false }),
    run: async () => ({ ok: false }),
    stopRun: async () => ({ ok: false }),
    tcpPing: async () => ({ ok: false }),
    onRunOutput: () => () => {},
    getDevSnapshot: async () => ({ ok: false, items: [] }),
    runPlaybook: async () => ({ ok: false }),
    listPlugins: async () => ({ ok: false, plugins: [] }),
    openPluginsFolder: async () => ({ ok: false }),
    detectEmulators: async () => ({ ok: false, emulators: [] }),
    emuAction: async () => ({ ok: false }),
    homieCheck: async () => ({ ok: false }),
    homieChat: async () => ({ ok: false, reply: "" }),
    voiceBridgeProbe: async () => ({ ok: false, error: "Not available in browser" }),
    voiceBridgeTranscribe: async () => ({ ok: false, error: "Not available in browser" }),
    vaultGet: async () => ({ ok: false, error: "Not available in browser" }),
    vaultSet: async () => ({ ok: false, error: "Not available in browser" }),
    vaultStatus: async () => ({ ok: false, error: "Not available in browser" }),
    openWindow: async (opts: any) => {
      try {
        const url = String(opts?.url || buildUrl(opts?.panel, opts?.query));
        window.open(url, "_blank", "noopener,noreferrer");
        return { ok: true };
      } catch (error: any) {
        return { ok: false, error: String(error?.message || error) };
      }
    },
    openEntertainmentPlayer: async (opts: any) => {
      try {
        const url = String(opts?.url || "");
        const w = Number(opts?.width || loadJSON("oddengine:entertainment:player:w", 1280));
        const h = Number(opts?.height || loadJSON("oddengine:entertainment:player:h", 820));
        saveJSON("oddengine:entertainment:player:w", w);
        saveJSON("oddengine:entertainment:player:h", h);
        window.open(url, "_blank", `noopener,noreferrer,width=${w},height=${h}`);
        return { ok: true };
      } catch (error: any) {
        return { ok: false, error: String(error?.message || error) };
      }
    },
    focusEntertainmentPlayer: async () => ({ ok: false, shown: false }),
    getEntertainmentLast: async () => ({ ok: false }),
    resetWindowBounds: async () => ({ ok: false, error: "Not available in browser" }),
    getDisplays: async () => ({ ok: false, displays: [] }),
    tileRoutineWindows: async () => ({ ok: false, error: "Not available in browser" }),
    closeRoutineWindows: async () => ({ ok: false, error: "Not available in browser" }),
  };
}
