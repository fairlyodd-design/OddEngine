import { loadJSON, saveJSON } from "./storage";

export type GrowDefaults = {
  name: string;
  size: string;
  stage: "seedling" | "veg" | "flower" | "dry";
  lightsOn: string;
  lightsOff: string;
};

export type CameraDefaults = {
  grid: "2x2" | "3x2" | "3x3" | "4x3" | "6x2";
  livePreviews: boolean;
  snapshotIntervalMs: number;
};

export type ZbdDefaults = {
  walletAddress: string;
  preferredEmulator: "auto" | "bluestacks" | "ldplayer" | "nox" | "memu" | "androidstudio";
};

export type DesktopDefaults = {
  startPanel: string;
  autoRunSafeFixes: boolean;
};

export type CannabisDefaults = {
  zip: string;
  categories: string[];
  priceTiers: string[];
  minDealScore: number;
};

export type AiDefaults = {
  tone: "coach" | "builder" | "operator";
  verbosity: "tight" | "balanced" | "deep";
  autoPinNotes: boolean;
  defaultDockOpen: boolean;
  homieVoiceEnabled: boolean;
  homieVoiceProfile: "auto" | "warm" | "clear" | "bright";
  homieAvatarSkin: "memoji" | "orb" | "phoenix" | "terminal" | "lil-homie";
  homieMascotAnimated: boolean;
  homieMascotEnergy: number;
  homieRiveEnabled: boolean;
  homieRiveSrc: string;
  homieRiveArtboard: string;
  homieRiveStateMachine: string;
  homieRivePointerTracking: boolean;
  homieRoomPreset: "trading" | "grow" | "chill" | "mission-control" | "custom";
  homieFurnitureTheme: "fairlyodd-neon" | "arcade-rig" | "studio-loft" | "greenhouse-den" | "cyber-noir" | "mission-ops";
  homieWallItem: "mission-board" | "chart-wall" | "grow-calendar" | "family-wall";
  homieDeskItem: "terminal-stack" | "trading-rig" | "grow-sensor" | "tea-notes";
  homieMoodLighting: "neon" | "golden" | "forest" | "sunset";
  homieLayoutSnap: boolean;
  homieLayoutGridPx: number;
  homieRoomAutoLink: boolean;
  homieCompanionWindow: boolean;
  homieIdleChatter: boolean;
  homieCompanionMode: boolean;
  homieCompanionCoachStyle: "gentle" | "hype" | "legacy";
  homieCompanionDailyCheckin: boolean;
  homieCompanionVoiceFirst: boolean;
  homiePreferLocalVoice: boolean;
  homieLocalVoiceStrict: boolean;
  homieVoiceEngineMode: "cloud" | "external-http" | "hybrid";
  homieExternalVoiceBaseUrl: string;
  homieExternalVoiceTimeoutMs: number;
  homieLilEnabled: boolean;
  homieLilRoam: boolean;
  homieLilSpeech: boolean;
  homieLilSpeed: number;
  homieLilScale: number;
  homieLilChatter: boolean;
  homieLil3d: boolean;
  homieLilEnergy: number;
  homieEmbeddedCore: boolean;
  homieCompanionBridgeEnabled: boolean;
  homieCompanionBridgeBaseUrl: string;
  homieCompanionBridgeTimeoutMs: number;
  homieCompanionBridgeMirrorNotifications: boolean;
  homieCompanionPhoenixRelayEnabled: boolean;
};

export type FairlyGodDefaults = {
  gridSize: number;
  snapEnabled: boolean;
  autoLockAfterSec: number;
  defaultTileStyle: "grid" | "left-main" | "hero";
  defaultRoutineMode: "windows" | "main";
  defaultTilePreset: "single" | "trader-main-3mon";
  compactEnabled: boolean;
  compactKeep: number;
};

export type Prefs = {
  grow: GrowDefaults;
  cameras: CameraDefaults;
  zbd: ZbdDefaults;
  desktop: DesktopDefaults;
  cannabis: CannabisDefaults;
  ai: AiDefaults;
  fairlygod: FairlyGodDefaults;
};

export const PREFS_KEY = "oddengine:prefs:v1";

export const DEFAULT_PREFS: Prefs = {
  grow: { name: "", size: "", stage: "veg", lightsOn: "06:00", lightsOff: "00:00" },
  cameras: { grid: "4x3", livePreviews: true, snapshotIntervalMs: 2500 },
  zbd: { walletAddress: "", preferredEmulator: "auto" },
  desktop: { startPanel: "Home", autoRunSafeFixes: false },
  cannabis: {
    zip: "",
    categories: ["Flower", "Pre-Rolls", "Vapes", "Edibles", "Concentrates", "Tinctures", "Topicals", "Accessories", "CBD"],
    priceTiers: ["$", "$$", "$$$", "$$$$"],
    minDealScore: 60,
  },
  ai: {
    tone: "coach",
    verbosity: "balanced",
    autoPinNotes: false,
    defaultDockOpen: true,
    homieVoiceEnabled: true,
    homieVoiceProfile: "auto",
    homieAvatarSkin: "memoji",
    homieMascotAnimated: false,
    homieMascotEnergy: 1,
    homieRiveEnabled: false,
    homieRiveSrc: "/rive/homie.riv",
    homieRiveArtboard: "Homie",
    homieRiveStateMachine: "State Machine 1",
    homieRivePointerTracking: true,
    homieRoomPreset: "trading",
    homieFurnitureTheme: "fairlyodd-neon",
    homieWallItem: "chart-wall",
    homieDeskItem: "trading-rig",
    homieMoodLighting: "neon",
    homieLayoutSnap: true,
    homieLayoutGridPx: 16,
    homieRoomAutoLink: false,
    homieCompanionWindow: true,
    homieIdleChatter: true,
    homieCompanionMode: true,
    homieCompanionCoachStyle: "legacy",
    homieCompanionDailyCheckin: true,
    homieCompanionVoiceFirst: true,
    homiePreferLocalVoice: false,
    homieLocalVoiceStrict: false,
    homieVoiceEngineMode: "cloud",
    homieExternalVoiceBaseUrl: "http://127.0.0.1:8765",
    homieExternalVoiceTimeoutMs: 20000,
    homieLilEnabled: true,
    homieLilRoam: true,
    homieLilSpeech: false,
    homieLilSpeed: 160,
    homieLilScale: 1,
    homieLilChatter: true,
    homieLil3d: false,
    homieLilEnergy: 0.9,
    homieEmbeddedCore: true,
    homieCompanionBridgeEnabled: true,
    homieCompanionBridgeBaseUrl: "http://127.0.0.1:45777",
    homieCompanionBridgeTimeoutMs: 3500,
    homieCompanionBridgeMirrorNotifications: true,
    homieCompanionPhoenixRelayEnabled: true,
  },
  fairlygod: {
    gridSize: 16,
    snapEnabled: true,
    autoLockAfterSec: 0,
    defaultTileStyle: "grid",
    defaultRoutineMode: "windows",
    defaultTilePreset: "single",
    compactEnabled: false,
    compactKeep: 3,
  },
};

function merge<T extends Record<string, any>>(base: T, over: any): T {
  const out: any = { ...base, ...(over || {}) };
  for (const key of Object.keys(base)) {
    const bv = (base as any)[key];
    const ov = (over || {})[key];
    if (bv && typeof bv === "object" && !Array.isArray(bv)) out[key] = { ...bv, ...(ov || {}) };
  }
  return out as T;
}

export function loadPrefs(): Prefs {
  const raw: any = loadJSON(PREFS_KEY, null as any);
  if (!raw) return DEFAULT_PREFS;
  const merged: Prefs = {
    ...DEFAULT_PREFS,
    ...raw,
    grow: merge(DEFAULT_PREFS.grow as any, raw.grow),
    cameras: merge(DEFAULT_PREFS.cameras as any, raw.cameras),
    zbd: merge(DEFAULT_PREFS.zbd as any, raw.zbd),
    desktop: merge(DEFAULT_PREFS.desktop as any, raw.desktop),
    cannabis: merge(DEFAULT_PREFS.cannabis as any, raw.cannabis),
    ai: merge(DEFAULT_PREFS.ai as any, raw.ai),
    fairlygod: merge(DEFAULT_PREFS.fairlygod as any, raw.fairlygod),
  };
  merged.ai.homiePreferLocalVoice = !!merged.ai.homiePreferLocalVoice;
  merged.ai.homieLocalVoiceStrict = !!merged.ai.homieLocalVoiceStrict;
  return merged;
}

export function savePrefs(prefs: Prefs) {
  saveJSON(PREFS_KEY, prefs);
  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(new CustomEvent("oddengine:prefs-changed", { detail: { prefs } }));
    } catch {
      // no-op
    }
  }
}
