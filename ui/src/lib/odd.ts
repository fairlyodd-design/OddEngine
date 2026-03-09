import { loadJSON, saveJSON } from "./storage";

type DetectedEmulator = {
  id: string;
  name: string;
  kind: string;
  exePath: string;
  notes?: string;
};

type DetectedPlugin = {
  id: string;
  name: string;
  version: string;
  description?: string;
  ui?: string;
  actions?: any[];
};

type HomieChatMsg = { role: "system" | "user" | "assistant"; content: string };

type Odd = {
  isDesktop: () => boolean;

  // windowing (Desktop + browser fallback)
  openWindow?: (opts: {
    title?: string;
    /** Optional full URL. If omitted, panel + query will be used. */
    url?: string;
    /** Optional panel name to open inside OddEngine. */
    panel?: string;
    /** Query params appended to the URL */
    query?: Record<string, string>;
    /** Optional routine id for routine window tracking (Desktop). */
    routineId?: string;
    /** Optional per-window-type persistence key for bounds (size/position). */
    windowType?: string;
    /** Alias of windowType (back-compat). */
    persistKey?: string;
    /** Optional x/y position (Desktop only). */
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    alwaysOnTop?: boolean;
    frame?: boolean;
    transparent?: boolean;
    skipTaskbar?: boolean;
    resizable?: boolean;
  }) => Promise<{ ok: boolean; error?: string }>;

  /** Tiles (auto-stacks) routine windows on the desktop. */
  tileRoutineWindows?: (payload: { routineId: string; style?: "grid" | "left-main" | "hero"; preset?: string; assignments?: Record<string,string> }) => Promise<{ ok: boolean; error?: string; count?: number; cols?: number; rows?: number; style?: string; preset?: string }>;

  /** Closes all windows opened for a routine (clean shutdown). */
  closeRoutineWindows?: (payload: { routineId: string }) => Promise<{ ok: boolean; error?: string; closed?: number }>;

  /** Lists available desktop displays (Desktop only). */
  getDisplays?: () => Promise<{ ok: boolean; error?: string; displays?: Array<{ id: string; bounds: any; workArea: any; scaleFactor?: number; isPrimary?: boolean; label?: string }> }>;

  /** Dedicated player window for non-DRM streaming (Desktop). Persists size/position. */
  openEntertainmentPlayer?: (opts: {
    url: string;
    title?: string;
    serviceId?: string;
    width?: number;
    height?: number;
  }) => Promise<{ ok: boolean; error?: string; reused?: boolean }>;

  /** Focus (and show) the entertainment player if it exists. */
  focusEntertainmentPlayer?: () => Promise<{ ok: boolean; shown?: boolean; hasLast?: boolean; last?: any; error?: string }>;

  /** Returns last opened entertainment URL/title, if any (Desktop). */
  getEntertainmentLast?: () => Promise<{ ok: boolean; last?: any; error?: string }>;

  /** Clears persisted desktop window bounds (popouts), if supported. */
  resetWindowBounds?: () => Promise<{ ok: boolean; error?: string; cleared?: number }>;

  // system
  getSystemInfo: () => Promise<{
    ok: boolean;
    userData?: string;
    bundlesDir?: string;
    growOsDir?: string;
    appVersion?: string;
    packaged?: boolean;
    cwd?: string;
    appPath?: string;
  }>;

  updateGrowBundle: () => Promise<{ ok: boolean; path?: string; updated?: boolean; version?: string | null; error?: string }>;
  growPlannerHandoff: (payload: any) => Promise<{ ok: boolean; path?: string; handoffPath?: string; roomsUpdated?: number; error?: string }>;

  // network (Desktop only)
  fetchText: (payload: { url: string; method?: string; headers?: Record<string,string>; body?: string; timeoutMs?: number; maxBytes?: number; }) => Promise<{ ok: boolean; status?: number; text?: string; error?: string }>; 

  // filesystem / shell
  pickDirectory: (opts?: any) => Promise<{ ok: boolean; path?: string }>;
  pickFile: (opts?: any) => Promise<{ ok: boolean; path?: string }>;
  openPath: (p: string) => Promise<any>;
  openExternal?: (url: string) => Promise<any>;

  // generators / commands
  generate: (payload: any) => Promise<any>;
  run: (payload: any) => Promise<any>;
  stopRun: (id: string) => Promise<any>;
  tcpPing: (payload: any) => Promise<any>;
  onRunOutput: (cb: (msg: any) => void) => () => void;

  // dev snapshot / playbooks
  getDevSnapshot: (opts?: { limit?: number }) => Promise<any>;
  runPlaybook: (payload: { playbookId: string; cwd: string }) => Promise<any>;

  // plugins
  listPlugins: () => Promise<{ ok: boolean; plugins: DetectedPlugin[]; pluginDir?: string }>;
  openPluginsFolder: () => Promise<{ ok: boolean; path?: string }>;

  // emulators
  detectEmulators: () => Promise<{
    ok: boolean;
    emulators: DetectedEmulator[];
    adbPath?: string | null;
    sdkRoot?: string | null;
  }>;
  emuAction: (payload: any) => Promise<any>;

  // Homie AI (Desktop-only; calls local Ollama)
  homieCheck: () => Promise<{ ok: boolean; running?: boolean; models?: string[]; error?: string }>;
  homieChat: (payload: { messages: HomieChatMsg[]; model?: string; system?: string; temperature?: number }) => Promise<{ ok: boolean; reply?: string; model?: string; error?: string }>;

  // External/local voice bridge (Desktop-only; optional local HTTP service)
  voiceBridgeProbe?: (payload: { baseUrl: string; timeoutMs?: number }) => Promise<{ ok: boolean; status?: string; model?: string; version?: string; detail?: string; error?: string }>;
  voiceBridgeTranscribe?: (payload: { baseUrl: string; timeoutMs?: number; mimeType?: string; audioBase64: string }) => Promise<{ ok: boolean; text?: string; model?: string; detail?: string; error?: string }>;
};

declare global {
  interface Window {
    __ODD__?: Odd;
  }
}

export function isDesktop(): boolean {
  return !!(window.__ODD__ && window.__ODD__.isDesktop && window.__ODD__.isDesktop());
}

export function oddApi(): Odd {
  // Desktop: real API from preload.
  if (window.__ODD__) return window.__ODD__;

  // Browser/dev fallback: keep the UI from crashing.
  const buildUrl = (panel?: string, query?: Record<string, string>) => {
    const u = new URL(window.location.href);
    if (panel) u.searchParams.set("panel", panel);
    if (query) Object.entries(query).forEach(([k, v]) => u.searchParams.set(k, v));
    return u.toString();
  };

  return {
    isDesktop: () => false,
    getSystemInfo: async () => ({ ok: false }),
    updateGrowBundle: async () => ({ ok: false }),
    growPlannerHandoff: async () => ({ ok: false }),
    fetchText: async () => ({ ok: false, error: "Not available in browser" }),
    pickDirectory: async () => ({ ok: false }),
    pickFile: async () => ({ ok: false }),
    openPath: async () => ({ ok: false }),
    openExternal: async (url: string) => {
      try {
        window.open(url, "_blank", "noopener,noreferrer");
        return { ok: true } as any;
      } catch (e: any) {
        return { ok: false, error: String(e) } as any;
      }
    },
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
    homieChat: async () => ({ ok: false }),
    voiceBridgeProbe: async () => ({ ok: false, error: "Not available in browser" }),
    voiceBridgeTranscribe: async () => ({ ok: false, error: "Not available in browser" }),
    tileRoutineWindows: async () => ({ ok: false, error: "Not available in browser" } as any),
    closeRoutineWindows: async () => ({ ok: false, error: "Not available in browser" } as any),
    openWindow: async (opts) => {
      try {
        const url = opts?.url || buildUrl(opts?.panel, opts?.query);
        window.open(url, "_blank", "noopener,noreferrer");
        return { ok: true };
      } catch (e: any) {
        return { ok: false, error: String(e) };
      }
    },
    openEntertainmentPlayer: async (opts) => {
      try {
        const url = String(opts?.url || "");
        const w = Number((opts as any)?.width || loadJSON("oddengine:entertainment:player:w", 1280));
        const h = Number((opts as any)?.height || loadJSON("oddengine:entertainment:player:h", 820));
        saveJSON("oddengine:entertainment:player:w", w);
        saveJSON("oddengine:entertainment:player:h", h);
        window.open(url, "_blank", `noopener,noreferrer,width=${w},height=${h}`);
        return { ok: true } as any;
      } catch (e: any) {
        return { ok: false, error: String(e) } as any;
      }
    },
    focusEntertainmentPlayer: async () => ({ ok: false, shown: false } as any),
    getEntertainmentLast: async () => ({ ok: false } as any),
    resetWindowBounds: async () => ({ ok: false, error: "Not available in browser" } as any),
  };
}
