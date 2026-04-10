import React, { useEffect, useMemo, useRef, useState } from "react";
import { buildMissions, buildMorningDigest, buildPanelHealth, getPanelMeta } from "../lib/brain";
import { COMMAND_SUGGESTIONS, executeCommand } from "../lib/commandCenter";
import {
  UPGRADE_PACKS_EVENT,
  getHomieUpgradeMessages,
  getUpgradePackSummaries,
  grantAllUpgradePackPermissions,
  installUpgradePack,
} from "../lib/plugins";
import { loadPrefs, savePrefs } from "../lib/prefs";
import { isDesktop, oddApi } from "../lib/odd";
import { updateVoiceEngineSnapshot } from "../lib/voice";
import { buildHomieCoreSnapshot, seedHomieDraft } from "../lib/homieCore";
import {
  clearCompanionMemoryState,
  clearCompanionMessages,
  getProviderLabel,
  loadCompanionMemoryState,
  loadCompanionMessages,
  loadHomieCompanionRuntime,
  loadHomieSettings,
  makeCompanionMessage,
  probeAllHomieProviders,
  saveCompanionMessages,
  saveHomieSettings,
  sendCompanionChat,
  syncCompanionMemoryFromMessages,
  type HomieProviderKind,
} from "../lib/homieCompanion";
import { addHomieMilestone, buildHomieRelationshipMemory, buildPanelCompanionMemory, loadHomieCompanionLaneMemory, noteHomieInteraction, pinHomieFact } from "../lib/homieMemory";
import { loadJSON, saveJSON } from "../lib/storage";
import fairlyOddLogo from "../assets/fairlyodd-logo.png";
import homieMascot from "../assets/homie-mascot.png";
import RiveHomie from "./RiveHomie";
import Homie3DActorShell from "./Homie3DActorShell";

declare global {
  interface Window {
    webkitSpeechRecognition?: any;
    SpeechRecognition?: any;
    SpeechRecognitionPhrase?: any;
  }
}

type VoiceDiagnostics = {
  recognitionAvailable: boolean;
  recognitionName: string;
  phrasesSupported: boolean;
  phraseBiasMode: "supported" | "optional" | "unsupported";
  microphoneApiAvailable: boolean;
  permissionState: "granted" | "prompt" | "denied" | "unknown";
  secureContext: boolean;
  audioInputCount: number;
  selectedAudioInputLabel: string;
  micTest: "idle" | "running" | "pass" | "fail";
  processLocallySupported: boolean;
  localPackApiAvailable: boolean;
  localAvailability: "unknown" | "checking" | "available" | "downloadable" | "downloading" | "installing" | "installed" | "unavailable" | "unsupported";
  localMessage: string;
  externalBridgeConfigured: boolean;
  externalBridgeBaseUrl: string;
  externalBridgeState: "disabled" | "configuring" | "ready" | "recording" | "transcribing" | "degraded" | "unavailable";
  externalBridgeMessage: string;
  externalBridgeModel: string;
  activeRecognitionMode: "idle" | "cloud" | "local" | "external";
  lastErrorCode: string;
  lastErrorMessage: string;
  lastTranscript: string;
};

type HearYouDoctorReport = {
  ready: boolean;
  tone: "good" | "warn";
  headline: string;
  detail: string;
  nextStep: string;
};

type ProviderHealthStatus = "idle" | "checking" | "ready" | "offline" | "fallback-ready" | "unavailable";

type ProviderHealth = {
  status: ProviderHealthStatus;
  selectedProvider: HomieProviderKind;
  selectedProviderLabel: string;
  activeProviderLabel: string;
  fallbackProviderLabel: string;
  detail: string;
  lastError: string;
  checkedAt: number;
};

type DetachedShellSnapshot = {
  conversationArc: string;
  sharedRoutine: string;
  providerDetail: string;
  transcriptPreview: string;
  replyPreview: string;
  stageLabel: string;
  heardAt: number;
  replyAt: number;
  providerBadge: string;
  providerTone: string;
  turnId: number;
  providerCheckId: number;
  transcriptId: number;
  memoryRefreshId: number;
};

type VoiceLaneTrace = {
  handoff: string;
  reply: string;
  promptMode: string;
  providerUsed: string;
  heardText: string;
  directRequest: string;
  supportMode: string;
  contextIncluded: string;
};

const STANDALONE_HYBRID_HERO_MIGRATION_KEY = "oddengine:homie:hybrid-hero-shell:v10.26.14x";
const STANDALONE_VOICE_PRIMER_KEY = "oddengine:homie:standalone-voice-primer:v10.26.14x";

const VOICE_BIAS_TERMS = [
  "Homie",
  "OddEngine",
  "Mission Control",
  "Trading",
  "Family Budget",
  "Grow",
  "Budget",
  "Brain",
  "News",
  "Family Health",
  "Grocery",
];

const ROOM_PRESETS = {
  trading: {
    label: "Trading",
    furnitureTheme: "fairlyodd-neon",
    wallItem: "chart-wall",
    deskItem: "trading-rig",
    moodLighting: "neon",
  },
  grow: {
    label: "Grow",
    furnitureTheme: "greenhouse-den",
    wallItem: "grow-calendar",
    deskItem: "grow-sensor",
    moodLighting: "forest",
  },
  chill: {
    label: "Chill",
    furnitureTheme: "studio-loft",
    wallItem: "family-wall",
    deskItem: "tea-notes",
    moodLighting: "golden",
  },
  "mission-control": {
    label: "Mission Control",
    furnitureTheme: "arcade-rig",
    wallItem: "mission-board",
    deskItem: "terminal-stack",
    moodLighting: "sunset",
  },
} as const;

type RoomPresetId = keyof typeof ROOM_PRESETS | "custom";

type RoomThemeId = "fairlyodd-neon" | "arcade-rig" | "studio-loft" | "greenhouse-den" | "cyber-noir" | "mission-ops";
type WallItemId = "mission-board" | "chart-wall" | "grow-calendar" | "family-wall";
type DeskItemId = "terminal-stack" | "trading-rig" | "grow-sensor" | "tea-notes";
type MoodLightingId = "neon" | "golden" | "forest" | "sunset";

type HomieGesture = "none" | "wink" | "wave" | "nod" | "tilt" | "spark";

const ROOM_LABELS = {
  furnitureTheme: {
    "fairlyodd-neon": "FairlyOdd neon",
    "arcade-rig": "Arcade rig",
    "studio-loft": "Studio loft",
    "greenhouse-den": "Greenhouse den",
    "cyber-noir": "Cyber noir",
    "mission-ops": "Mission ops",
  } as Record<RoomThemeId, string>,
  wallItem: {
    "mission-board": "Mission board",
    "chart-wall": "Chart wall",
    "grow-calendar": "Grow calendar",
    "family-wall": "Family wall",
  } as Record<WallItemId, string>,
  deskItem: {
    "terminal-stack": "Terminal stack",
    "trading-rig": "Trading rig",
    "grow-sensor": "Grow sensor",
    "tea-notes": "Tea + notes",
  } as Record<DeskItemId, string>,
  moodLighting: {
    neon: "Neon",
    golden: "Golden",
    forest: "Forest",
    sunset: "Sunset",
  } as Record<MoodLightingId, string>,
};

type RoomLayoutSlot = RoomPresetId;
type RoomItemId = "wallFeature" | "deskFeature" | "lamp" | "plant" | "sideTable" | "monitor" | "buddy";
type RoomItemDepth = 0 | 1 | 2;
const ROOM_ITEM_DEPTH_LABEL: Record<RoomItemDepth, string> = { 0: "Back", 1: "Mid", 2: "Front" };

type RoomItemOffset = { x: number; y: number; z?: number; depth?: RoomItemDepth };
type RoomLayout = Record<RoomItemId, RoomItemOffset>;

const ROOM_LAYOUTS_KEY_V1 = "oddengine:homie:room-layouts:v1";
const ROOM_LAYOUTS_KEY = "oddengine:homie:room-layouts:v2";

const DEFAULT_ROOM_LAYOUTS: Record<RoomLayoutSlot, RoomLayout> = {
  trading: {
    wallFeature: { x: 0, y: 0 },
    deskFeature: { x: 0, y: 0 },
    lamp: { x: 0, y: 0 },
    plant: { x: 0, y: 0 },
    sideTable: { x: 0, y: 0 },
    monitor: { x: 0, y: 0 },
    buddy: { x: 0, y: 0 },
  },
  grow: {
    wallFeature: { x: -0.03, y: 0.02 },
    deskFeature: { x: -0.02, y: 0.01 },
    lamp: { x: -0.03, y: 0.02 },
    plant: { x: 0.08, y: -0.02 },
    sideTable: { x: 0.04, y: 0.01 },
    monitor: { x: -0.03, y: 0 },
    buddy: { x: -0.01, y: 0 },
  },
  chill: {
    wallFeature: { x: 0.02, y: 0.01 },
    deskFeature: { x: 0.01, y: 0.01 },
    lamp: { x: 0.03, y: 0 },
    plant: { x: -0.04, y: 0.01 },
    sideTable: { x: 0.02, y: 0 },
    monitor: { x: 0.02, y: 0 },
    buddy: { x: 0, y: 0.01 },
  },
  "mission-control": {
    wallFeature: { x: 0.03, y: -0.01 },
    deskFeature: { x: 0.03, y: 0 },
    lamp: { x: 0.02, y: 0.01 },
    plant: { x: -0.06, y: 0.01 },
    sideTable: { x: 0.05, y: 0 },
    monitor: { x: 0.04, y: -0.01 },
    buddy: { x: 0.01, y: 0 },
  },
  custom: {
    wallFeature: { x: 0, y: 0 },
    deskFeature: { x: 0, y: 0 },
    lamp: { x: 0, y: 0 },
    plant: { x: 0, y: 0 },
    sideTable: { x: 0, y: 0 },
    monitor: { x: 0, y: 0 },
    buddy: { x: 0, y: 0 },
  },
};

const ROOM_ITEM_BOUNDS: Record<RoomItemId, { x: [number, number]; y: [number, number] }> = {
  wallFeature: { x: [-0.18, 0.2], y: [-0.1, 0.12] },
  deskFeature: { x: [-0.2, 0.2], y: [-0.06, 0.14] },
  lamp: { x: [-0.18, 0.12], y: [-0.12, 0.14] },
  plant: { x: [-0.08, 0.18], y: [-0.12, 0.12] },
  sideTable: { x: [-0.18, 0.12], y: [-0.08, 0.12] },
  monitor: { x: [-0.16, 0.12], y: [-0.1, 0.1] },
  buddy: { x: [-0.22, 0.22], y: [-0.08, 0.1] },
};

const ROOM_ITEM_DEFAULT_Z: Record<RoomItemId, number> = {
  wallFeature: 2,
  deskFeature: 5,
  lamp: 6,
  plant: 7,
  sideTable: 4,
  monitor: 8,
  buddy: 9,
};

const ROOM_ITEM_DEFAULT_DEPTH: Record<RoomItemId, RoomItemDepth> = {
  wallFeature: 0,
  deskFeature: 1,
  lamp: 1,
  plant: 2,
  sideTable: 1,
  monitor: 2,
  buddy: 2,
};

const ROOM_ITEM_DEPTH_SCALE: Record<RoomItemDepth, number> = { 0: 0.965, 1: 1.0, 2: 1.04 };

function normalizeOffset(itemId: RoomItemId, offset?: Partial<RoomItemOffset> | null): RoomItemOffset {
  return {
    x: typeof offset?.x === "number" ? offset!.x : 0,
    y: typeof offset?.y === "number" ? offset!.y : 0,
    z: typeof offset?.z === "number" ? offset!.z : ROOM_ITEM_DEFAULT_Z[itemId],
    depth: (typeof offset?.depth === "number" ? offset!.depth : ROOM_ITEM_DEFAULT_DEPTH[itemId]) as RoomItemDepth,
  };
}

function clampDepth(depth: any): RoomItemDepth {
  if (depth === 0 || depth === 1 || depth === 2) return depth;
  return 1;
}

function clampZ(z: any): number {
  const zi = Math.round(Number(z));
  if (!Number.isFinite(zi)) return 0;
  return Math.max(0, Math.min(99, zi));
}

function snap(value: number, step: number) {
  if (!step || step <= 0) return value;
  return Math.round(value / step) * step;
}

function clampRoomItem(itemId: RoomItemId, offset: RoomItemOffset) {
  const bounds = ROOM_ITEM_BOUNDS[itemId];
  return {
    x: clampRoomOffset(offset.x, bounds.x[0], bounds.x[1]),
    y: clampRoomOffset(offset.y, bounds.y[0], bounds.y[1]),
    z: clampZ(offset.z),
    depth: clampDepth(offset.depth),
  } as RoomItemOffset;
}

function cloneRoomLayout(layout: RoomLayout): RoomLayout {
  return {
    wallFeature: { ...layout.wallFeature },
    deskFeature: { ...layout.deskFeature },
    lamp: { ...layout.lamp },
    plant: { ...layout.plant },
    sideTable: { ...layout.sideTable },
    monitor: { ...layout.monitor },
    buddy: { ...layout.buddy },
  };
}

function clampRoomOffset(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function resolveRoomLayout(layouts: Partial<Record<RoomLayoutSlot, RoomLayout>>, slot: RoomLayoutSlot): RoomLayout {
  const base = cloneRoomLayout(DEFAULT_ROOM_LAYOUTS[slot] || DEFAULT_ROOM_LAYOUTS.trading);
  const saved = layouts?.[slot];
  if (!saved) return base;
  return {
    wallFeature: clampRoomItem("wallFeature", normalizeOffset("wallFeature", { ...base.wallFeature, ...(saved.wallFeature || {}) })),
    deskFeature: clampRoomItem("deskFeature", normalizeOffset("deskFeature", { ...base.deskFeature, ...(saved.deskFeature || {}) })),
    lamp: clampRoomItem("lamp", normalizeOffset("lamp", { ...base.lamp, ...(saved.lamp || {}) })),
    plant: clampRoomItem("plant", normalizeOffset("plant", { ...base.plant, ...(saved.plant || {}) })),
    sideTable: clampRoomItem("sideTable", normalizeOffset("sideTable", { ...base.sideTable, ...(saved.sideTable || {}) })),
    monitor: clampRoomItem("monitor", normalizeOffset("monitor", { ...base.monitor, ...(saved.monitor || {}) })),
    buddy: clampRoomItem("buddy", normalizeOffset("buddy", { ...base.buddy, ...(saved.buddy || {}) })),
  };
}

function loadRoomLayouts(): Partial<Record<RoomLayoutSlot, RoomLayout>> {
  try {
    const rawV2 = localStorage.getItem(ROOM_LAYOUTS_KEY);
    if (rawV2) return JSON.parse(rawV2) as Partial<Record<RoomLayoutSlot, RoomLayout>>;
    const rawV1 = localStorage.getItem(ROOM_LAYOUTS_KEY_V1);
    if (!rawV1) return {};
    const parsed = JSON.parse(rawV1) as any;
    const migrated: any = {};
    for (const slot of Object.keys(parsed || {})) {
      const layout = parsed[slot] || {};
      migrated[slot] = {
        wallFeature: normalizeOffset("wallFeature", layout.wallFeature),
        deskFeature: normalizeOffset("deskFeature", layout.deskFeature),
        lamp: normalizeOffset("lamp", layout.lamp),
        plant: normalizeOffset("plant", layout.plant),
        sideTable: normalizeOffset("sideTable", layout.sideTable),
        monitor: normalizeOffset("monitor", layout.monitor),
        buddy: normalizeOffset("buddy", layout.buddy),
      };
    }
    localStorage.setItem(ROOM_LAYOUTS_KEY, JSON.stringify(migrated));
    return migrated as Partial<Record<RoomLayoutSlot, RoomLayout>>;
  } catch {
    return {};
  }
}

function saveRoomLayouts(layouts: Partial<Record<RoomLayoutSlot, RoomLayout>>) {
  try {
    localStorage.setItem(ROOM_LAYOUTS_KEY, JSON.stringify(layouts));
  } catch {
    // ignore
  }
}

function titleCasePreset(id: RoomPresetId) {

  if (id === "custom") return "Custom";
  return ROOM_PRESETS[id].label;
}

function pickVoice(profile: "auto" | "warm" | "clear" | "bright") {
  try {
    const voices = window.speechSynthesis.getVoices() || [];
    const pools: Record<string, RegExp> = {
      warm: /Samantha|Jenny|Aria|zira|female|Google US English/i,
      clear: /David|Guy|clear|English|en-US|US English/i,
      bright: /Google|Jenny|Aria|Sonia|bright|cheer/i,
      auto: /Google US English|Microsoft David|Samantha|Jenny|en-US|English/i,
    };
    const pattern = pools[profile] || pools.auto;
    return voices.find((voice) => pattern.test(`${voice.name} ${voice.lang || ""}`)) || voices[0] || null;
  } catch {
    return null;
  }
}

function pickIdleStatus(activePanelId: string) {
  const upgrades = getHomieUpgradeMessages();
  if (upgrades.length) return { text: upgrades[0], mood: "warn" as const };
  const missions = buildMissions();
  if (missions.length) {
    const top = missions[0];
    return { text: `${getPanelMeta(top.panelId).title}: ${top.title}`, mood: top.level === "good" ? "good" as const : "warn" as const };
  }
  const health = buildPanelHealth().sort((a, b) => a.score - b.score)[0];
  if (health) return { text: `${health.title} health is ${health.score}/100. ${health.headline}`, mood: health.tone === "good" ? "good" as const : "warn" as const };
  return { text: `Watching ${getPanelMeta(activePanelId).title} and staying ready.`, mood: "idle" as const };
}

function getRecognitionCtor() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function createBaseDiagnostics(): VoiceDiagnostics {
  const Ctor = getRecognitionCtor();
  const probe = Ctor ? new Ctor() : null;
  const phrasesSupported = !!window.SpeechRecognition && !!window.SpeechRecognitionPhrase && !!probe && "phrases" in probe;
  const processLocallySupported = false;
  const localPackApiAvailable = false;
  try { probe?.abort?.(); } catch {}
  return {
    recognitionAvailable: !!Ctor,
    recognitionName: Ctor ? (window.SpeechRecognition ? "SpeechRecognition" : "webkitSpeechRecognition") : "Unavailable",
    phrasesSupported,
    phraseBiasMode: phrasesSupported ? "supported" : Ctor ? "optional" : "unsupported",
    microphoneApiAvailable: !!navigator.mediaDevices?.getUserMedia,
    permissionState: "unknown",
    secureContext: window.isSecureContext,
    audioInputCount: 0,
    selectedAudioInputLabel: "",
    micTest: "idle",
    processLocallySupported,
    localPackApiAvailable,
    localAvailability: "unsupported",
    localMessage: "Browser on-device speech stays disabled here to avoid Electron renderer crashes.",
    externalBridgeConfigured: false,
    externalBridgeBaseUrl: "http://127.0.0.1:8765",
    externalBridgeState: "disabled",
    externalBridgeMessage: "External/local voice bridge not configured.",
    externalBridgeModel: "",
    activeRecognitionMode: "idle",
    lastErrorCode: "",
    lastErrorMessage: "",
    lastTranscript: "",
  };
}

function createBaseProviderHealth(activePanelId = "Home"): ProviderHealth {
  const settings = loadHomieSettings(activePanelId);
  const label = getProviderLabel(settings.provider);
  return {
    status: isDesktop() ? "idle" : "unavailable",
    selectedProvider: settings.provider,
    selectedProviderLabel: label,
    activeProviderLabel: label,
    fallbackProviderLabel: "",
    detail: isDesktop() ? `${label} has not been checked yet.` : "Desktop mode is required for local provider checks.",
    lastError: "",
    checkedAt: 0,
  };
}

function buildProviderHealthFromRows(activePanelId: string, rows: Array<{ provider: HomieProviderKind; providerLabel: string; ok: boolean; error?: string; detail?: string; model?: string }>): ProviderHealth {
  const settings = loadHomieSettings(activePanelId);
  const selectedProvider = settings.provider;
  const selectedProviderLabel = getProviderLabel(selectedProvider);
  if (!isDesktop()) {
    return {
      status: "unavailable",
      selectedProvider,
      selectedProviderLabel,
      activeProviderLabel: selectedProviderLabel,
      fallbackProviderLabel: "",
      detail: "Desktop mode is required for local provider checks.",
      lastError: "",
      checkedAt: Date.now(),
    };
  }
  const selectedRow = rows.find((row) => row.provider === selectedProvider);
  const fallbackRow = rows.find((row) => row.ok && row.provider !== selectedProvider) || null;
  if (selectedRow?.ok) {
    return {
      status: "ready",
      selectedProvider,
      selectedProviderLabel,
      activeProviderLabel: selectedRow.providerLabel || selectedProviderLabel,
      fallbackProviderLabel: "",
      detail: selectedRow.detail || `${selectedRow.providerLabel || selectedProviderLabel} is online${selectedRow.model ? ` • ${selectedRow.model}` : ""}.`,
      lastError: "",
      checkedAt: Date.now(),
    };
  }
  if (fallbackRow) {
    const lastError = selectedRow?.error || selectedRow?.detail || `${selectedProviderLabel} is offline right now.`;
    return {
      status: "fallback-ready",
      selectedProvider,
      selectedProviderLabel,
      activeProviderLabel: fallbackRow.providerLabel,
      fallbackProviderLabel: fallbackRow.providerLabel,
      detail: `${selectedProviderLabel} is down, but Homie can fail over to ${fallbackRow.providerLabel}.`,
      lastError,
      checkedAt: Date.now(),
    };
  }
  const detail = selectedRow?.error || selectedRow?.detail || `${selectedProviderLabel} is not ready yet.`;
  return {
    status: "offline",
    selectedProvider,
    selectedProviderLabel,
    activeProviderLabel: selectedProviderLabel,
    fallbackProviderLabel: "",
    detail,
    lastError: detail,
    checkedAt: Date.now(),
  };
}

function providerBadgeLabel(providerHealth: ProviderHealth) {
  if (providerHealth.status === "ready") return `${providerHealth.activeProviderLabel} online`;
  if (providerHealth.status === "fallback-ready") return `Failover → ${providerHealth.activeProviderLabel}`;
  if (providerHealth.status === "checking") return "Checking provider";
  if (providerHealth.status === "unavailable") return "Desktop provider only";
  return "Provider offline";
}

function providerBadgeTone(providerHealth: ProviderHealth) {
  if (providerHealth.status === "ready") return "good";
  if (providerHealth.status === "checking") return "";
  return "warn";
}

function describePromptMode(mode: string, chatCleanMode: boolean) {
  const base = mode === "panel" ? "panel + memory" : mode === "memory" ? "memory only" : "clean chat";
  return chatCleanMode ? `${base} • clean mode` : base;
}

function previewText(text: string, max = 220) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  return clean.length <= max ? clean : `${clean.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function stableLineText(text: string, max = 220) {
  const raw = String(text || "").replace(/\s+/g, " ").trim();
  if (!raw) return "";
  let clean = raw
    .replace(/(?:conversation\s*arc|shared\s*routine|routine|arc|lately)\s*:\s*/ig, "")
    .replace(/(?:^|\s)(lately\s+){2,}/ig, " lately ")
    .replace(/\s*[•|]+\s*/g, " • ")
    .replace(/\s{2,}/g, " ")
    .trim();
  const fragments = clean
    .split(/\s*[•;]+\s*|\n+/)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const unique: string[] = [];
  for (const fragment of fragments) {
    const key = fragment.toLowerCase();
    if (unique.some((prev) => prev.toLowerCase() === key || prev.toLowerCase().includes(key) || key.includes(prev.toLowerCase()))) continue;
    unique.push(fragment);
    if (unique.length >= 3) break;
  }
  clean = unique.length ? unique.join(" • ") : clean;
  return previewText(clean, max);
}

function relativeTimeLabel(ts: number) {
  if (!ts) return "";
  const deltaSec = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (deltaSec < 5) return "just now";
  if (deltaSec < 60) return `${deltaSec}s ago`;
  const deltaMin = Math.round(deltaSec / 60);
  if (deltaMin < 60) return `${deltaMin}m ago`;
  const deltaHr = Math.round(deltaMin / 60);
  if (deltaHr < 24) return `${deltaHr}h ago`;
  return `${Math.round(deltaHr / 24)}d ago`;
}

function buildDetachedShellSnapshot(input: {
  conversationArc: string;
  sharedRoutine: string;
  providerDetail: string;
  transcriptPreview: string;
  replyPreview: string;
  stageLabel: string;
  heardAt: number;
  replyAt: number;
  providerBadge: string;
  providerTone: string;
  turnId: number;
  providerCheckId: number;
  transcriptId: number;
  memoryRefreshId: number;
}): DetachedShellSnapshot {
  return {
    conversationArc: stableLineText(input.conversationArc, 220),
    sharedRoutine: stableLineText(input.sharedRoutine, 220),
    providerDetail: stableLineText(input.providerDetail, 260),
    transcriptPreview: stableLineText(input.transcriptPreview, 220),
    replyPreview: stableLineText(input.replyPreview, 240),
    stageLabel: input.stageLabel,
    heardAt: input.heardAt || 0,
    replyAt: input.replyAt || 0,
    providerBadge: input.providerBadge,
    providerTone: input.providerTone,
    turnId: input.turnId || 0,
    providerCheckId: input.providerCheckId || 0,
    transcriptId: input.transcriptId || 0,
    memoryRefreshId: input.memoryRefreshId || 0,
  };
}

function mapRecognitionError(code: string) {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone permission was blocked. Check Windows microphone privacy and make sure desktop apps can use the mic.";
    case "audio-capture":
      return "Homie could not capture audio from the microphone. Check the default input device and try the Mic Test first.";
    case "no-speech":
      return "The microphone started, but no speech was detected before recognition ended.";
    case "network":
      return "Speech recognition hit a network or service problem. Try again in a moment, use push-to-talk, or type the command in the command bar.";
    case "aborted":
      return "Voice recognition was stopped before it finished.";
    case "language-not-supported":
      return "The runtime does not support the requested speech-recognition language.";
    default:
      return code ? `Voice command failed with: ${code}.` : "Voice command failed for an unknown reason.";
  }
}

function isPhraseBiasError(code: string, message = "") {
  const hay = `${code} ${message}`.toLowerCase();
  return hay.includes("phrase") || hay.includes("bias");
}

function classifyExternalBridgeError(errorLike: any, baseUrl: string) {
  const raw = String(errorLike || "Unknown bridge error.");
  const lower = raw.toLowerCase();
  if (lower.includes("fetch failed") || lower.includes("econnrefused") || lower.includes("failed to fetch") || lower.includes("socket hang up")) {
    return `External/local bridge is unreachable at ${baseUrl}. Start the bridge, then probe it again.`;
  }
  if (lower.includes("timeout") || lower.includes("timed out") || lower.includes("aborted")) {
    return `External/local bridge timed out at ${baseUrl}. It may still be loading the speech model.`;
  }
  if (lower.includes("404") || lower.includes("not found")) {
    return `External/local bridge answered, but the expected route was missing. Check that /health and /transcribe are available.`;
  }
  if (lower.includes("unexpected token") || lower.includes("json")) {
    return `External/local bridge replied with invalid JSON. Check the bridge logs and contract in voice_bridge/README.md.`;
  }
  return raw;
}

function applyRecognitionBias(recognition: any) {
  try {
    if (!window.SpeechRecognition) return false;
    if (!("phrases" in recognition)) return false;
    const PhraseCtor = window.SpeechRecognitionPhrase;
    if (!PhraseCtor) return false;
    recognition.phrases = VOICE_BIAS_TERMS.map((phrase, index) => new PhraseCtor(phrase, Math.max(1, 6 - Math.min(index, 4))));
    return true;
  } catch {
    return false;
  }
}

function estimateSpeechMs(text: string) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1200, Math.min(10000, 900 + words * 360));
}


function stageLabelForConversation(args: {
  presenceState: string;
  isListening: boolean;
  isSpeaking: boolean;
  isThinking: boolean;
  externalBridgeState: VoiceDiagnostics["externalBridgeState"];
}) {
  if (args.presenceState === "needs-provider") return "Needs provider";
  if (args.externalBridgeState === "transcribing") return "Transcribing";
  if (args.presenceState === "warming") return "Waiting for turn";
  if (args.presenceState === "thinking" || args.isThinking) return "Thinking";
  if (args.presenceState === "talking" || args.isSpeaking) return "Replying";
  if (args.presenceState === "listening" || args.isListening) return "Listening";
  if (args.presenceState === "celebrating") return "Settling reply";
  return "Waiting for turn";
}

function buildHearYouDoctorReport(args: {
  diagnostics: VoiceDiagnostics;
  voiceEnabled: boolean;
  voiceMode: string;
  voiceEngineMode: string;
  stageLabel: string;
}) : HearYouDoctorReport {
  const { diagnostics, voiceEnabled, voiceMode, voiceEngineMode, stageLabel } = args;
  if (!voiceEnabled) {
    return {
      ready: false,
      tone: "warn",
      headline: "Homie cannot hear you because voice is off.",
      detail: "Turn Voice on first, then run the voice path check.",
      nextStep: "Enable voice and start a test turn.",
    };
  }
  if (voiceMode === "commands") {
    return {
      ready: false,
      tone: "warn",
      headline: "Homie is hearing commands, not companion chat.",
      detail: "Voice is currently routed to commands, so spoken turns will behave more like control input than a conversation.",
      nextStep: "Switch Voice → companion for real back-and-forth.",
    };
  }
  if (diagnostics.permissionState === "denied") {
    return {
      ready: false,
      tone: "warn",
      headline: "Homie cannot hear you because microphone permission is blocked.",
      detail: "Windows or the browser runtime denied mic access.",
      nextStep: "Allow the microphone, then run Mic test again.",
    };
  }
  if (diagnostics.micTest === "fail") {
    return {
      ready: false,
      tone: "warn",
      headline: "Homie cannot hear you because the mic path failed.",
      detail: diagnostics.lastErrorMessage || "The mic test did not complete cleanly.",
      nextStep: "Fix the input device path, then re-run the mic test.",
    };
  }
  if (voiceEngineMode === "cloud" && !diagnostics.recognitionAvailable) {
    return {
      ready: false,
      tone: "warn",
      headline: "Homie cannot hear you because SpeechRecognition is missing here.",
      detail: "The browser/runtime does not expose the cloud speech path in this session.",
      nextStep: "Use the external bridge path or a runtime with Web Speech support.",
    };
  }
  if (voiceEngineMode === "external-http" && diagnostics.externalBridgeState !== "ready") {
    return {
      ready: false,
      tone: "warn",
      headline: "Homie cannot hear you because the external bridge is not ready.",
      detail: diagnostics.externalBridgeMessage || "The local HTTP voice bridge did not come up cleanly.",
      nextStep: "Start the bridge, then hit Probe external bridge again.",
    };
  }
  if (voiceEngineMode === "hybrid" && !diagnostics.recognitionAvailable && diagnostics.externalBridgeState !== "ready") {
    return {
      ready: false,
      tone: "warn",
      headline: "Homie cannot hear you because both voice lanes are cold.",
      detail: "Cloud recognition is unavailable and the external bridge is not ready yet.",
      nextStep: "Get either cloud recognition or the external bridge online.",
    };
  }
  return {
    ready: true,
    tone: "good",
    headline: `Homie is ready to hear you.`,
    detail: `${stageLabel} • ${diagnostics.selectedAudioInputLabel ? `Input: ${diagnostics.selectedAudioInputLabel}` : `${diagnostics.audioInputCount || 1} input${diagnostics.audioInputCount === 1 ? "" : "s"} detected`}.`,
    nextStep: "Use Start talking or one of the forced path tests below.",
  };
}

export default function HomieBuddy({
  activePanelId,
  onNavigate,
  onOpenHowTo,
  mode = "floating",
}: {
  activePanelId: string;
  onNavigate: (id: string) => void;
  onOpenHowTo?: () => void;
  mode?: "floating" | "standalone";
}) {
  const [prefs, setPrefs] = useState(() => loadPrefs());
  const [open, setOpen] = useState(mode === "standalone" || (prefs.ai as any).homieAlwaysReady !== false);
  const desktop = isDesktop();
  const [status, setStatus] = useState("Homie is chilling and ready.");
  const [chatDraft, setChatDraft] = useState("");
  const [companionBusy, setCompanionBusy] = useState(false);
  const [companionModel, setCompanionModel] = useState(() => loadHomieCompanionRuntime(activePanelId).model);
  const [companionProviderLabel, setCompanionProviderLabel] = useState(() => loadHomieCompanionRuntime(activePanelId).providerLabel);
  const [companionMessages, setCompanionMessages] = useState(() => loadCompanionMessages());
  const [companionMemory, setCompanionMemory] = useState(() => loadCompanionMemoryState());
  const [laneMemory, setLaneMemory] = useState(() => loadHomieCompanionLaneMemory());
  const companionScrollRef = useRef<HTMLDivElement | null>(null);
  const [tick, setTick] = useState(0);
  const [voiceEnabled, setVoiceEnabled] = useState(prefs.ai.homieVoiceEnabled);
  const [continuousVoice, setContinuousVoice] = useState<boolean>(() => {
    const saved:any = loadJSON("oddengine:homie:voice-loop:v1", null as any);
    return typeof saved === "boolean" ? saved : (prefs.ai as any).homieVoiceContinuous !== false;
  });
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [presenceState, setPresenceState] = useState<"ready" | "warming" | "listening" | "thinking" | "talking" | "celebrating" | "needs-provider">("ready");
  const [isHoldingToTalk, setIsHoldingToTalk] = useState(false);
  const [gesture, setGesture] = useState<HomieGesture>("none");
  const [memojiEmote, setMemojiEmote] = useState<"none" | "fistbump" | "celebrate" | "alert" | "facepalm">("none");
  const [memojiLook, setMemojiLook] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [talkLevel, setTalkLevel] = useState(0);
  const [mood, setMood] = useState<"idle" | "good" | "warn">("idle");
  const [diagnostics, setDiagnostics] = useState<VoiceDiagnostics>(() => createBaseDiagnostics());
  const [providerHealth, setProviderHealth] = useState<ProviderHealth>(() => createBaseProviderHealth(activePanelId));
  const [lastReplyPreview, setLastReplyPreview] = useState("");
  const [lastReplyProvider, setLastReplyProvider] = useState("");
  const [lastHeardAt, setLastHeardAt] = useState(0);
  const [lastReplyAt, setLastReplyAt] = useState(0);
  const [voiceLaneTrace, setVoiceLaneTrace] = useState<VoiceLaneTrace>({
    handoff: "idle",
    reply: "idle",
    promptMode: describePromptMode(loadHomieSettings(activePanelId).contextMode, loadHomieSettings(activePanelId).chatCleanMode),
    providerUsed: loadHomieCompanionRuntime(activePanelId).providerLabel,
    heardText: "",
    directRequest: "",
    supportMode: "",
    contextIncluded: "",
  });
  const isStandalone = mode === "standalone";
  const [standaloneSection, setStandaloneSection] = useState<"companion" | "house" | "tools">("companion");
  const standaloneDrawerOpen = isStandalone && standaloneSection !== "companion";
  const toggleStandaloneSection = (section: "house" | "tools") => {
    setStandaloneSection((prev) => (prev === section ? "companion" : section));
  };
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [toolsDrawerView, setToolsDrawerView] = useState<"main" | "doctor">("main");
  const [micLevel, setMicLevel] = useState(0);
  const providerCheckSeqRef = useRef(0);
  const latestProviderCheckRef = useRef(0);
  const conversationTurnSeqRef = useRef(0);
  const latestConversationTurnRef = useRef(0);
  const transcriptSeqRef = useRef(0);
  const memoryRefreshSeqRef = useRef(0);
  const detachedSnapshotTimerRef = useRef<number | null>(null);
  const standaloneToolsDoctorOpen = isStandalone && standaloneSection === "tools" && toolsDrawerView === "doctor";

  const [detachedSnapshot, setDetachedSnapshot] = useState<DetachedShellSnapshot>(() => buildDetachedShellSnapshot({
    conversationArc: "",
    sharedRoutine: "",
    providerDetail: createBaseProviderHealth(activePanelId).detail,
    transcriptPreview: "",
    replyPreview: "",
    stageLabel: "Ready",
    heardAt: 0,
    replyAt: 0,
    providerBadge: providerBadgeLabel(createBaseProviderHealth(activePanelId)),
    providerTone: providerBadgeTone(createBaseProviderHealth(activePanelId)),
    turnId: 0,
    providerCheckId: 0,
    transcriptId: 0,
    memoryRefreshId: 0,
  }));
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<any>(null);
  const manualStopRef = useRef(false);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaChunksRef = useRef<BlobPart[]>([]);
  const meterStreamRef = useRef<MediaStream | null>(null);
  const meterAudioContextRef = useRef<AudioContext | null>(null);
  const meterAnalyserRef = useRef<AnalyserNode | null>(null);
  const meterSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const meterFrameRef = useRef<number | null>(null);
  const activeVoicePathRef = useRef<"cloud" | "external">("cloud");
  const suppressVoiceLoopRestartRef = useRef(false);
  const pendingVoiceFollowupSourceRef = useRef<string | null>(null);
  const pendingVoiceResumeTimerRef = useRef<number | null>(null);
  useEffect(() => {
    if (!isStandalone || standaloneSection !== "tools") setToolsDrawerView("main");
  }, [isStandalone, standaloneSection]);
  useEffect(() => {
    saveJSON("oddengine:homie:voice-loop:v1", continuousVoice);
  }, [continuousVoice]);
  useEffect(() => {
    saveCompanionMessages(companionMessages as any);
    setCompanionMemory(syncCompanionMemoryFromMessages(companionMessages as any, activePanelId));
    setLaneMemory(loadHomieCompanionLaneMemory());
    memoryRefreshSeqRef.current += 1;
  }, [companionMessages, activePanelId]);

  useEffect(() => {
    const hydrateCompanionSettings = () => {
      const runtime = loadHomieCompanionRuntime(activePanelId);
      setCompanionModel(runtime.model);
      setCompanionProviderLabel(runtime.providerLabel);
      setCompanionMemory(loadCompanionMemoryState());
      setLaneMemory(loadHomieCompanionLaneMemory());
      setProviderHealth(createBaseProviderHealth(activePanelId));
    };
    hydrateCompanionSettings();
    window.addEventListener("oddengine:homie-settings-changed", hydrateCompanionSettings as EventListener);
    return () => window.removeEventListener("oddengine:homie-settings-changed", hydrateCompanionSettings as EventListener);
  }, [activePanelId, tick]);

  useEffect(() => {
    if (!desktop) {
      setProviderHealth(createBaseProviderHealth(activePanelId));
      return;
    }
    void refreshProviderHealth(true);
  }, [activePanelId, desktop, tick]);

  useEffect(() => {
    if (!companionScrollRef.current) return;
    companionScrollRef.current.scrollTop = companionScrollRef.current.scrollHeight;
  }, [companionMessages, companionBusy]);
  const reduceMotion = useMemo(() => {
    try {
      return !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      return false;
    }
  }, [activePanelId]);
  const lastCompanionWarning = useMemo(() => {
    return [...companionMessages].reverse().find((message) => message.role === "assistant" && String(message.content || "").trim().startsWith("⚠️")) || null;
  }, [companionMessages]);
  const companionTurnLabel = presenceState === "needs-provider" ? "Needs provider" : presenceState === "warming" ? "Warming up" : presenceState === "thinking" ? "Thinking" : presenceState === "listening" ? "Listening" : presenceState === "talking" ? "Talking" : presenceState === "celebrating" ? "Celebrating" : "Ready";

  function updateStatusOnly(nextStatus: string, nextMood: "idle" | "good" | "warn" = "good") {
    setStatus(nextStatus);
    setMood(nextMood);
  }

  function clearPendingVoiceResume() {
    if (pendingVoiceResumeTimerRef.current) {
      window.clearTimeout(pendingVoiceResumeTimerRef.current);
      pendingVoiceResumeTimerRef.current = null;
    }
  }

  function patchVoiceLaneTrace(partial: Partial<VoiceLaneTrace>) {
    setVoiceLaneTrace((prev) => ({ ...prev, ...partial }));
  }

  function scheduleVoiceResume(source = "homie", delayMs = 240) {
    clearPendingVoiceResume();
    pendingVoiceResumeTimerRef.current = window.setTimeout(() => {
      pendingVoiceResumeTimerRef.current = null;
      if (manualStopRef.current || !continuousVoice) return;
      void startVoice(false, true, false, false, source);
    }, Math.max(120, delayMs));
  }

  useEffect(() => {
    if (providerHealth.status === "offline") {
      setPresenceState("needs-provider");
      return;
    }
    if (companionBusy) {
      setPresenceState("thinking");
      return;
    }
    if (isSpeaking) {
      setPresenceState("talking");
      return;
    }
    if (isListening) {
      setPresenceState("listening");
      return;
    }
    setPresenceState((prev) => prev === "warming" ? "warming" : prev === "celebrating" ? "celebrating" : "ready");
  }, [providerHealth.status, companionBusy, isSpeaking, isListening]);

  // `skin` is referenced inside effects below, so it must be initialized before those hooks.
  // Otherwise we can hit the TDZ for a later `const skin = ...` and crash on first render.
  const skin = prefs.ai.homieAvatarSkin;


  const memojiAnimEnabled = skin === "memoji" && (prefs.ai as any).homieMascotAnimated !== false && !reduceMotion;
  const memojiEnergy = Math.max(0.3, Math.min(1, Number((prefs.ai as any).homieMascotEnergy ?? 0.85)));

  // Fortnite-mascot buddy: pointer tracking (no Rive needed)
  useEffect(() => {
    if (!memojiAnimEnabled) return;

    const handle = (e: PointerEvent) => {
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;
      const nx = (e.clientX / w) * 2 - 1;
      const ny = (e.clientY / h) * 2 - 1;
      const clamp = (v: number) => Math.max(-1, Math.min(1, v));
      const dx = clamp(nx) * (3 + memojiEnergy * 4);
      const dy = clamp(ny) * (2 + memojiEnergy * 3);
      setMemojiLook({ x: dx, y: dy });
    };

    window.addEventListener("pointermove", handle, { passive: true });
    return () => window.removeEventListener("pointermove", handle as any);
  }, [memojiAnimEnabled, memojiEnergy]);

  // Talk level pulse for the mascot (drives intensity when speaking).
  useEffect(() => {
    if (!memojiAnimEnabled) {
      setTalkLevel(0);
      return;
    }
    if (!isSpeaking) {
      setTalkLevel(0);
      return;
    }

    const tick = () => {
      // Quick hype pulse: 0.35..1.0
      const r = 0.35 + Math.random() * 0.65;
      setTalkLevel(r);
    };

    tick();
    const id = window.setInterval(tick, 90);
    return () => window.clearInterval(id);
  }, [memojiAnimEnabled, isSpeaking]);

  useEffect(() => {
    if (reduceMotion) return;

    // Only run idle gestures when Homie is not actively listening/speaking.
    if (isSpeaking || isListening) {
      setGesture("none");
      return;
    }

    let cancelled = false;
    let timer: number | null = null;
    let holdTimer: number | null = null;

    const schedule = () => {
      if (cancelled) return;
      const base = 5200;
      const jitter = 8200;
      const delay = base + Math.floor(Math.random() * jitter);
      timer = window.setTimeout(() => {
        if (cancelled) return;
        const pool: HomieGesture[] = skin === "lil-homie"
          ? ["wave", "nod", "tilt"]
          : skin === "memoji"
          ? ["wave", "nod", "tilt", "spark"]
          : ["wink", "nod", "tilt", "spark"];
        const next = pool[Math.floor(Math.random() * pool.length)] || "none";
        setGesture(next);
        const hold = next === "spark" ? 900 : 1200;
        holdTimer = window.setTimeout(() => setGesture("none"), hold);
        schedule();
      }, delay);
    };

    schedule();

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      if (holdTimer) window.clearTimeout(holdTimer);
    };
  }, [reduceMotion, isSpeaking, isListening, skin]);
  const roomRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{ itemId: RoomItemId; startX: number; startY: number; startOffset: RoomItemOffset } | null>(null);
  const activeTitle = useMemo(() => getPanelMeta(activePanelId).title, [activePanelId]);
  const panelCompanion = useMemo(() => buildPanelCompanionMemory(activePanelId) as any, [activePanelId, laneMemory.updatedAt, companionMemory.updatedAt, tick]);
  const relationshipMemory = useMemo(() => buildHomieRelationshipMemory(activePanelId), [activePanelId, laneMemory.updatedAt, companionMemory.updatedAt, tick]);
  const homieSnapshot = useMemo(() => buildHomieCoreSnapshot(activePanelId), [activePanelId, laneMemory.updatedAt, companionMemory.updatedAt, tick]);
  const stableConversationArc = useMemo(() => stableLineText(relationshipMemory.conversationArcLine, 220), [relationshipMemory.conversationArcLine]);
  const stableSharedRoutine = useMemo(() => stableLineText(relationshipMemory.sharedRoutineLine, 220), [relationshipMemory.sharedRoutineLine]);
  const stableProviderDetail = useMemo(() => stableLineText(providerHealth.detail, 260), [providerHealth.detail]);
  const stableTranscriptPreview = useMemo(() => stableLineText(diagnostics.lastTranscript, 220), [diagnostics.lastTranscript]);
  const stableReplyPreview = useMemo(() => stableLineText(lastReplyPreview, 240), [lastReplyPreview]);
  useEffect(() => {
    if (!diagnostics.lastTranscript) return;
    transcriptSeqRef.current += 1;
  }, [diagnostics.lastTranscript]);
  useEffect(() => {
    if (detachedSnapshotTimerRef.current) window.clearTimeout(detachedSnapshotTimerRef.current);
    detachedSnapshotTimerRef.current = window.setTimeout(() => {
      const stageLabel = stageLabelForConversation({
        presenceState,
        isListening,
        isSpeaking,
        isThinking: companionBusy,
        externalBridgeState: diagnostics.externalBridgeState,
      });
      const providerBadge = providerBadgeLabel(providerHealth);
      const providerTone = providerBadgeTone(providerHealth);
      setDetachedSnapshot(buildDetachedShellSnapshot({
        conversationArc: stableConversationArc,
        sharedRoutine: stableSharedRoutine,
        providerDetail: stableProviderDetail,
        transcriptPreview: stableTranscriptPreview,
        replyPreview: stableReplyPreview,
        stageLabel,
        heardAt: lastHeardAt,
        replyAt: lastReplyAt,
        providerBadge,
        providerTone,
        turnId: latestConversationTurnRef.current,
        providerCheckId: latestProviderCheckRef.current,
        transcriptId: transcriptSeqRef.current,
        memoryRefreshId: memoryRefreshSeqRef.current,
      }));
    }, mode === "standalone" ? 120 : 60);
    return () => {
      if (detachedSnapshotTimerRef.current) {
        window.clearTimeout(detachedSnapshotTimerRef.current);
        detachedSnapshotTimerRef.current = null;
      }
    };
  }, [stableConversationArc, stableSharedRoutine, stableProviderDetail, stableTranscriptPreview, stableReplyPreview, lastHeardAt, lastReplyAt, mode, presenceState, isListening, isSpeaking, companionBusy, diagnostics.externalBridgeState, providerHealth]);
  const autoLinkRoom = !!(prefs as any).ai?.homieRoomAutoLink;
  const upgradeMessages = useMemo(() => getHomieUpgradeMessages(), [tick]);
  const upgradePacks = useMemo(() => getUpgradePackSummaries(), [tick]);
  // Room packs should only unlock themes when the pack is ENABLED.
  // (Installed-but-disabled should behave as locked.)
  const isRoomPackInstalled = (packId: string) => !!upgradePacks.find((pack) => pack.id === packId && pack.enabled);
  const houseMode = skin === "lil-homie" || mode === "standalone";
  const voiceProfile = prefs.ai.homieVoiceProfile;
  const idleChatter = prefs.ai.homieIdleChatter;
  const voiceEngineMode = prefs.ai.homieVoiceEngineMode || "cloud";
  const externalVoiceBaseUrl = (prefs.ai.homieExternalVoiceBaseUrl || "http://127.0.0.1:8765").trim() || "http://127.0.0.1:8765";
  const externalVoiceTimeoutMs = Math.max(4000, Number(prefs.ai.homieExternalVoiceTimeoutMs || 20000));
  const preferLocalVoice = voiceEngineMode !== "cloud";
  const strictLocalVoice = voiceEngineMode === "external-http";
  const api = oddApi();
  const [layoutEditMode, setLayoutEditMode] = useState(false);
  const [savedRoomLayouts, setSavedRoomLayouts] = useState<Partial<Record<RoomLayoutSlot, RoomLayout>>>(() => loadRoomLayouts());
  const [draftRoomLayout, setDraftRoomLayout] = useState<RoomLayout>(() => resolveRoomLayout(loadRoomLayouts(), "trading"));
  const draftRoomLayoutRef = useRef<RoomLayout>(draftRoomLayout);
  const [roomSize, setRoomSize] = useState({ width: 320, height: 236 });
  const [draggingRoomItem, setDraggingRoomItem] = useState<RoomItemId | null>(null);
  const [selectedRoomItem, setSelectedRoomItem] = useState<RoomItemId | null>(null);
  const snapEnabled = !!(prefs as any).ai?.homieLayoutSnap;
  const gridPx = Math.max(8, Math.min(40, Number((prefs as any).ai?.homieLayoutGridPx || 16)));

  function updateHomieRoom(partial: Partial<typeof prefs.ai>) {
    const next = { ...prefs, ai: { ...prefs.ai, ...partial } };
    savePrefs(next);
    setPrefs(next);
    return next;
  }

  function patchCompanionSettings(partial: any) {
    saveHomieSettings(partial || {}, activePanelId);
    setTick((v) => v + 1);
  }

  function setVoiceEngineMode(nextMode: "cloud" | "external-http" | "hybrid") {
    updateHomieRoom({ homieVoiceEngineMode: nextMode } as any);
    announce(nextMode === "cloud" ? "Homie voice set to cloud mode." : nextMode === "hybrid" ? `Homie voice set to hybrid mode. I will prefer the local bridge at ${externalVoiceBaseUrl}.` : `Homie voice set to external/local mode at ${externalVoiceBaseUrl}.`, nextMode === "cloud" ? "idle" : "good", true);
    void probeExternalVoice(true);
  }

  function persistRoomLayout(slot: RoomLayoutSlot, layout: RoomLayout, silent = false) {
    const nextLayouts = { ...savedRoomLayouts, [slot]: cloneRoomLayout(layout) };
    setSavedRoomLayouts(nextLayouts);
    saveRoomLayouts(nextLayouts);
    if (!silent) announce(`${titleCasePreset(slot)} layout saved.`, "good", true);
  }

  function resetRoomLayout(slot: RoomLayoutSlot) {
    const nextLayouts = { ...savedRoomLayouts };
    delete nextLayouts[slot];
    setSavedRoomLayouts(nextLayouts);
    saveRoomLayouts(nextLayouts);
    const fallback = resolveRoomLayout({}, slot);
    setDraftRoomLayout(fallback);
    announce(`${titleCasePreset(slot)} layout reset to defaults.`, "good", true);
  }

  function copyLayoutToCustom() {
    const nextLayouts = { ...savedRoomLayouts, custom: cloneRoomLayout(draftRoomLayoutRef.current) };
    setSavedRoomLayouts(nextLayouts);
    saveRoomLayouts(nextLayouts);
    updateHomieRoom({ homieRoomPreset: "custom" });
    announce("Copied current room layout into Custom.", "good", true);
  }

  
  function updateSelectedRoomItem(partial: Partial<RoomItemOffset>) {
    if (!selectedRoomItem) return;
    const slot = (prefs.ai.homieRoomPreset || "trading") as RoomLayoutSlot;

    // NOTE: Persist the computed next layout directly.
    // Using draftRoomLayoutRef here can race against React state updates
    // (and occasionally saves the previous layout).
    let nextLayout: RoomLayout | null = null;
    setDraftRoomLayout((prev) => {
      const current = normalizeOffset(selectedRoomItem, prev[selectedRoomItem]);
      const next = clampRoomItem(selectedRoomItem, { ...current, ...partial });
      nextLayout = { ...prev, [selectedRoomItem]: next };
      return nextLayout;
    });
    window.setTimeout(() => {
      if (nextLayout) persistRoomLayout(slot, nextLayout, true);
    }, 0);
  }

  function bumpSelectedZ(delta: number) {
    if (!selectedRoomItem) return;
    const current = normalizeOffset(selectedRoomItem, draftRoomLayoutRef.current[selectedRoomItem]);
    updateSelectedRoomItem({ z: clampZ((current.z || 0) + delta) });
  }

  function cycleSelectedDepth(dir: -1 | 1) {
    if (!selectedRoomItem) return;
    const current = normalizeOffset(selectedRoomItem, draftRoomLayoutRef.current[selectedRoomItem]);
    const nextDepth = clampDepth(((current.depth ?? 1) + dir + 3) % 3);
    updateSelectedRoomItem({ depth: nextDepth });
  }

function getRoomItemStyle(itemId: RoomItemId, baseTransform = ""): React.CSSProperties {
    const offset = draftRoomLayout[itemId] || { x: 0, y: 0 };
    const dx = Math.round(offset.x * roomSize.width);
    const dy = Math.round(offset.y * roomSize.height);
    const z = typeof offset.z === "number" ? offset.z : ROOM_ITEM_DEFAULT_Z[itemId];
    const depth = (typeof offset.depth === "number" ? offset.depth : ROOM_ITEM_DEFAULT_DEPTH[itemId]) as RoomItemDepth;
    const scale = ROOM_ITEM_DEPTH_SCALE[depth] || 1;
    const zIndex = depth * 30 + clampZ(z);
    return {
      transform: `${baseTransform ? `${baseTransform} ` : ""}translate(${dx}px, ${dy}px) scale(${scale})`,
      pointerEvents: layoutEditMode ? "auto" : undefined,
      touchAction: layoutEditMode ? "none" : undefined,
      zIndex: draggingRoomItem === itemId ? 999 : zIndex,
    };
  }

  function beginRoomDrag(itemId: RoomItemId, event: React.PointerEvent<HTMLElement>) {
    if (!layoutEditMode || !roomRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    dragStateRef.current = {
      itemId,
      startX: event.clientX,
      startY: event.clientY,
      startOffset: draftRoomLayoutRef.current[itemId] || { x: 0, y: 0 },
    };
    setSelectedRoomItem(itemId);
    setDraggingRoomItem(itemId);
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    setVoiceEnabled(prefs.ai.homieVoiceEnabled);
  }, [prefs.ai.homieVoiceEnabled]);

  useEffect(() => {
    if (mode === "standalone") {
      setOpen(true);
      return;
    }
    if ((prefs.ai as any).homieAlwaysReady !== false) setOpen(true);
  }, [mode, (prefs.ai as any).homieAlwaysReady]);

  useEffect(() => {
    if (!isStandalone) return;
    if (!loadJSON(STANDALONE_HYBRID_HERO_MIGRATION_KEY, false as any)) {
      const nextPrefs = loadPrefs();
      if ((nextPrefs.ai as any).homieAvatarShellMode !== "hybrid-hero") {
        (nextPrefs.ai as any).homieAvatarShellMode = "hybrid-hero";
        savePrefs(nextPrefs);
        setPrefs(nextPrefs);
      }
      saveJSON(STANDALONE_HYBRID_HERO_MIGRATION_KEY, true);
    }
    if (!loadJSON(STANDALONE_VOICE_PRIMER_KEY, false as any)) {
      patchCompanionSettings({ voiceMode: "companion", autoSpeakReplies: true, autoFallback: true });
      setContinuousVoice(true);
      if (!(prefs.ai as any).homieVoiceEnabled) updateHomieRoom({ homieVoiceEnabled: true } as any);
      saveJSON(STANDALONE_VOICE_PRIMER_KEY, true);
    }
  }, [isStandalone, activePanelId]);

  useEffect(() => {
    void refreshVoiceDiagnostics();
  }, []);


  useEffect(() => {
    const syncPrefs = () => {
      const next = loadPrefs();
      setPrefs(next);
      setVoiceEnabled(next.ai.homieVoiceEnabled);
      setTick((v) => v + 1);
    };
    window.addEventListener("oddengine:prefs-changed", syncPrefs as EventListener);
    window.addEventListener("storage", syncPrefs as EventListener);
    return () => {
      window.removeEventListener("oddengine:prefs-changed", syncPrefs as EventListener);
      window.removeEventListener("storage", syncPrefs as EventListener);
    };
  }, []);

  useEffect(() => {
    draftRoomLayoutRef.current = draftRoomLayout;
  }, [draftRoomLayout]);

  useEffect(() => {
    if (!autoLinkRoom) return;
    if (layoutEditMode) return;
    // If user is in Custom mode, don't override their room.
    if ((prefs.ai.homieRoomPreset || "trading") === "custom") return;

    const panel = String(activePanelId || "");
    let nextPreset: RoomPresetId = "chill";
    if (panel === "Trading" || panel === "OptionsSaaS" || panel === "Money" || panel === "Mining") nextPreset = "trading";
    else if (panel === "Grow" || panel === "Cannabis") nextPreset = "grow";
    else if (panel === "DevEngine" || panel === "Builder" || panel === "Autopilot" || panel === "Security") nextPreset = "mission-control";

    if ((prefs.ai.homieRoomPreset || "trading") === nextPreset) return;

    const config = nextPreset === "custom" ? null : ROOM_PRESETS[nextPreset as Exclude<RoomPresetId, "custom">];
    if (!config) return;
    updateHomieRoom({
      homieRoomPreset: nextPreset,
      homieFurnitureTheme: config.furnitureTheme,
      homieWallItem: config.wallItem,
      homieDeskItem: config.deskItem,
      homieMoodLighting: config.moodLighting,
    } as any);
    announce(`Linked room → ${ROOM_PRESETS[nextPreset as any].label}.`, "good", true);
  }, [activePanelId, autoLinkRoom, layoutEditMode]);

  useEffect(() => {
    const slot = (prefs.ai.homieRoomPreset || "trading") as RoomLayoutSlot;
    setDraftRoomLayout(resolveRoomLayout(savedRoomLayouts, slot));
  }, [prefs.ai.homieRoomPreset, savedRoomLayouts]);

  useEffect(() => {
    const el = roomRef.current;
    if (!el) return;
    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width && rect.height) {
        setRoomSize({ width: rect.width, height: rect.height });
      }
    };
    updateSize();
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(() => updateSize());
      observer.observe(el);
      return () => observer.disconnect();
    }
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, [open, mode, prefs.ai.homieRoomPreset]);

  useEffect(() => {
    if (!draggingRoomItem) return;
    const handlePointerMove = (event: PointerEvent) => {
      const drag = dragStateRef.current;
      const roomEl = roomRef.current;
      if (!drag || !roomEl) return;
      const rect = roomEl.getBoundingClientRect();
      const bounds = ROOM_ITEM_BOUNDS[drag.itemId];
      const stepX = snapEnabled ? (gridPx / Math.max(rect.width, 1)) : 0;
      const stepY = snapEnabled ? (gridPx / Math.max(rect.height, 1)) : 0;
      const rawX = drag.startOffset.x + (event.clientX - drag.startX) / Math.max(rect.width, 1);
      const rawY = drag.startOffset.y + (event.clientY - drag.startY) / Math.max(rect.height, 1);
      const nextX = clampRoomOffset(snap(rawX, stepX), bounds.x[0], bounds.x[1]);
      const nextY = clampRoomOffset(snap(rawY, stepY), bounds.y[0], bounds.y[1]);
      const prevOffset = draftRoomLayoutRef.current[drag.itemId] || normalizeOffset(drag.itemId, null);
      setDraftRoomLayout((prev) => ({ ...prev, [drag.itemId]: { ...prevOffset, x: nextX, y: nextY } }));
    };
    const handlePointerUp = () => {
      dragStateRef.current = null;
      setDraggingRoomItem(null);
      const slot = (prefs.ai.homieRoomPreset || "trading") as RoomLayoutSlot;
      persistRoomLayout(slot, draftRoomLayoutRef.current, true);
    };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [draggingRoomItem, prefs.ai.homieRoomPreset, savedRoomLayouts]);

  useEffect(() => {
    const handler = () => {
      setTick((v) => v + 1);
      refreshVoiceDiagnostics();
    };
    const voiceHandler = (event: Event) => {
      const detail = (event as CustomEvent<{ action?: string; source?: string }>).detail || {};
      const action = detail.action;
      if (action === "install" || action === "probe") {
        const message = "Browser on-device voice stays disabled here to avoid Electron renderer crashes. Use the external/local voice bridge instead.";
        setDiagnostics((prev) => ({ ...prev, localAvailability: "unsupported", localMessage: message, lastErrorCode: "local-voice-disabled", lastErrorMessage: message }));
        announce(message, "warn", true);
        emitVoiceStatus({ source: detail.source || "homie", status: "error", message, errorCode: "local-voice-disabled" });
        return;
      }
      if (action === "toggle-continuous") {
        setOpen(true);
        setContinuousVoice((prev) => {
          const next = !prev;
          announce(next ? "Continuous back-and-forth voice is on." : "Continuous back-and-forth voice is off.", next ? "good" : "idle", true);
          return next;
        });
        return;
      }
      if (action === "screen-read") {
        setOpen(true);
        const snap = buildHomieCoreSnapshot(activePanelId);
        const summary = `${snap.operatorHeadline} ${snap.briefing}`;
        noteHomieInteraction("voice", `screen-read:${activePanelId}`, activePanelId);
        announce(summary, "good", true);
        return;
      }
      if (action === "probe-external") {
        setOpen(true);
        void probeExternalVoice(false);
        return;
      }
      if (action === "listen" || action === "start") {
        setOpen(true);
        void startVoice(false, true, false, false, detail.source || "homie");
        return;
      }
      if (action === "stop") {
        stopVoice(true, detail.source || "homie");
      }
    };
    window.addEventListener(UPGRADE_PACKS_EVENT, handler as EventListener);
    window.addEventListener("storage", handler as EventListener);
    window.addEventListener("oddengine:homie-voice-action", voiceHandler as EventListener);
    window.addEventListener("oddengine:voice-request", voiceHandler as EventListener);
    return () => {
      window.removeEventListener(UPGRADE_PACKS_EVENT, handler as EventListener);
      window.removeEventListener("storage", handler as EventListener);
      window.removeEventListener("oddengine:homie-voice-action", voiceHandler as EventListener);
      window.removeEventListener("oddengine:voice-request", voiceHandler as EventListener);
    };
  }, []);

  useEffect(() => {
    const hydrateVoices = () => setTick((v) => v + 1);
    try {
      window.speechSynthesis.onvoiceschanged = hydrateVoices;
    } catch {}
    return () => {
      try {
        window.speechSynthesis.onvoiceschanged = null;
      } catch {}
    };
  }, []);

  useEffect(() => {
    if (upgradeMessages.length) {
      setStatus(upgradeMessages[0]);
      setMood(upgradeMessages[0].includes("permissions") || upgradeMessages[0].includes("Install") ? "warn" : "good");
    }
  }, [tick]);

  useEffect(() => {
    if (!idleChatter) return;
    const id = window.setInterval(() => {
      if (isListening || isSpeaking) return;
      const next = pickIdleStatus(activePanelId);
      setStatus(next.text);
      setMood(next.mood);
      if (mode === "standalone" && voiceEnabled) speak(next.text, true);
    }, 70000);
    return () => window.clearInterval(id);
  }, [activePanelId, idleChatter, isListening, isSpeaking, mode, voiceEnabled]);

  useEffect(() => () => {
    clearPendingVoiceResume();
    try { window.speechSynthesis?.cancel?.(); } catch {}
    stopVoice(true);
    stopMicMeter();
  }, []);

  function stopMicMeter() {
    if (meterFrameRef.current) {
      window.cancelAnimationFrame(meterFrameRef.current);
      meterFrameRef.current = null;
    }
    try { meterSourceRef.current?.disconnect(); } catch {}
    try { meterAnalyserRef.current?.disconnect(); } catch {}
    try { meterAudioContextRef.current?.close?.(); } catch {}
    meterSourceRef.current = null;
    meterAnalyserRef.current = null;
    meterAudioContextRef.current = null;
    try { meterStreamRef.current?.getTracks?.().forEach((track) => track.stop()); } catch {}
    meterStreamRef.current = null;
    setMicLevel(0);
  }

  async function startMicMeter() {
    if (!showDiagnostics || !navigator.mediaDevices?.getUserMedia || meterStreamRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      meterStreamRef.current = stream;
      const track = stream.getAudioTracks?.()[0] || null;
      const label = String(track?.label || "").trim();
      if (label) {
        setDiagnostics((prev) => ({ ...prev, selectedAudioInputLabel: label }));
      }
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.82;
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
      meterAudioContextRef.current = ctx;
      meterAnalyserRef.current = analyser;
      meterSourceRef.current = source;
      const data = new Uint8Array(analyser.fftSize);
      const tickMeter = () => {
        const activeAnalyser = meterAnalyserRef.current;
        if (!activeAnalyser) return;
        activeAnalyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i += 1) {
          const centered = (data[i] - 128) / 128;
          sum += centered * centered;
        }
        const rms = Math.sqrt(sum / data.length);
        const normalized = Math.max(0, Math.min(1, rms * 4.8));
        setMicLevel((prev) => (Math.abs(prev - normalized) < 0.01 ? prev : normalized));
        meterFrameRef.current = window.requestAnimationFrame(tickMeter);
      };
      tickMeter();
    } catch (error: any) {
      const code = String(error?.name || error?.code || "mic-meter-failed");
      const message = `${code}: ${String(error?.message || "Could not start the live mic meter.")}`;
      setDiagnostics((prev) => ({ ...prev, lastErrorCode: code, lastErrorMessage: message }));
    }
  }

  useEffect(() => {
    if (showDiagnostics) {
      void startMicMeter();
      return () => stopMicMeter();
    }
    stopMicMeter();
  }, [showDiagnostics]);

  function wantsExternalVoice() {
    return voiceEngineMode === "external-http" || voiceEngineMode === "hybrid";
  }

  async function probeExternalVoice(silent = false, baseState?: VoiceDiagnostics) {
    const current = baseState || diagnostics;
    if (!api.voiceBridgeProbe || !wantsExternalVoice()) {
      const message = voiceEngineMode === "cloud"
        ? "External/local voice bridge is idle because Homie is set to cloud mode."
        : "External/local voice bridge probing is only available in desktop mode.";
      const nextState = voiceEngineMode === "cloud" ? "disabled" : "unavailable";
      setDiagnostics((prev) => ({ ...prev, externalBridgeConfigured: wantsExternalVoice(), externalBridgeBaseUrl: externalVoiceBaseUrl, externalBridgeState: nextState, externalBridgeMessage: message, externalBridgeModel: "" }));
      updateVoiceEngineSnapshot({ externalState: nextState, engineMode: voiceEngineMode as any, externalAvailable: false, externalBaseUrl: externalVoiceBaseUrl, externalModel: "", message, source: "homie" });
      if (!silent) announce(message, nextState === "ready" ? "good" : "warn", true);
      return { ok: false, status: nextState, message };
    }
    setDiagnostics((prev) => ({ ...prev, externalBridgeConfigured: true, externalBridgeBaseUrl: externalVoiceBaseUrl, externalBridgeState: "configuring", externalBridgeMessage: `Checking ${externalVoiceBaseUrl}…` }));
    updateVoiceEngineSnapshot({ externalState: "configuring", engineMode: voiceEngineMode as any, externalBaseUrl: externalVoiceBaseUrl, source: "homie", message: `Checking ${externalVoiceBaseUrl}…` });
    const result = await api.voiceBridgeProbe({ baseUrl: externalVoiceBaseUrl, timeoutMs: Math.min(externalVoiceTimeoutMs, 8000) });
    if (result?.ok) {
      const message = result.detail || `External/local voice bridge is ready at ${externalVoiceBaseUrl}.`;
      setDiagnostics((prev) => ({ ...prev, ...current, externalBridgeConfigured: true, externalBridgeBaseUrl: externalVoiceBaseUrl, externalBridgeState: "ready", externalBridgeMessage: message, externalBridgeModel: result.model || "" }));
      updateVoiceEngineSnapshot({ externalState: "ready", engineMode: voiceEngineMode as any, externalAvailable: true, externalBaseUrl: externalVoiceBaseUrl, externalModel: result.model || "", source: "homie", message, errorCode: "" });
      if (!silent) announce(message, "good", true);
      return { ok: true, status: "ready", message };
    }
    const message = classifyExternalBridgeError(result?.error || `External/local voice bridge did not respond at ${externalVoiceBaseUrl}.`, externalVoiceBaseUrl);
    setDiagnostics((prev) => ({ ...prev, ...current, externalBridgeConfigured: true, externalBridgeBaseUrl: externalVoiceBaseUrl, externalBridgeState: "degraded", externalBridgeMessage: message, externalBridgeModel: "", lastErrorCode: prev.lastErrorCode || "external-bridge-unreachable", lastErrorMessage: prev.lastErrorMessage || message }));
    updateVoiceEngineSnapshot({ externalState: "degraded", engineMode: voiceEngineMode as any, externalAvailable: false, externalBaseUrl: externalVoiceBaseUrl, externalModel: "", source: "homie", message, errorCode: "external-bridge-unreachable" });
    if (!silent) announce(message, "warn", true);
    return { ok: false, status: "degraded", message };
  }

  async function refreshVoiceDiagnostics() {
    const next = createBaseDiagnostics();
    next.externalBridgeConfigured = wantsExternalVoice();
    next.externalBridgeBaseUrl = externalVoiceBaseUrl;
    next.externalBridgeState = wantsExternalVoice() ? "configuring" : "disabled";
    next.externalBridgeMessage = wantsExternalVoice() ? `Checking ${externalVoiceBaseUrl}…` : "External/local voice bridge is idle because Homie is set to cloud mode.";
    try {
      if (navigator.permissions?.query) {
        const res = await navigator.permissions.query({ name: "microphone" as PermissionName });
        next.permissionState = (res.state as VoiceDiagnostics["permissionState"]) || "unknown";
      }
    } catch {
      next.permissionState = "unknown";
    }
    try {
      if (navigator.mediaDevices?.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter((device) => device.kind === "audioinput");
        next.audioInputCount = audioInputs.length;
        next.selectedAudioInputLabel = audioInputs.find((device) => device.label)?.label || diagnostics.selectedAudioInputLabel || "";
      }
    } catch {}
    setDiagnostics((prev) => ({ ...prev, ...next }));
    updateVoiceEngineSnapshot({
      cloudState: next.recognitionAvailable && next.permissionState !== "denied" ? "ready" : next.recognitionAvailable ? "degraded" : "unavailable",
      pushToTalkState: next.microphoneApiAvailable ? "ready" : "unavailable",
      typedState: "ready",
      localState: "disabled",
      externalState: next.externalBridgeState,
      engineMode: voiceEngineMode as any,
      externalAvailable: false,
      externalBaseUrl: externalVoiceBaseUrl,
      externalModel: "",
      recognitionAvailable: next.recognitionAvailable,
      microphoneApiAvailable: next.microphoneApiAvailable,
      permissionState: next.permissionState,
      secureContext: next.secureContext,
      audioInputCount: next.audioInputCount,
      listening: false,
      source: "homie",
      message: wantsExternalVoice() ? next.externalBridgeMessage : next.localMessage || "Cloud speech, push-to-talk, and typed commands are ready.",
      errorCode: next.lastErrorCode || "",
    });
    if (wantsExternalVoice()) await probeExternalVoice(true, next);
    return next;
  }

  async function probeLocalVoice(_autoInstall = false) {
    const message = "Browser on-device voice stays disabled here to avoid Electron renderer crashes. Use the external/local voice bridge instead.";
    setDiagnostics((prev) => ({
      ...prev,
      processLocallySupported: false,
      localPackApiAvailable: false,
      localAvailability: "unsupported",
      localMessage: message,
      lastErrorCode: "local-voice-disabled",
      lastErrorMessage: message,
    }));
    updateVoiceEngineSnapshot({ cloudState: "degraded", localState: "disabled", message, errorCode: "local-voice-disabled", source: "homie" });
    return { ok: false, status: "unsupported", message };
  }


  async function blobToBase64(blob: Blob) {
    const buf = await blob.arrayBuffer();
    let binary = "";
    const bytes = new Uint8Array(buf);
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return window.btoa(binary);
  }

  async function transcribeExternalBlob(blob: Blob, source = "homie") {
    if (!api.voiceBridgeTranscribe) {
      const message = "External/local voice bridge transcription is only available in desktop mode.";
      setDiagnostics((prev) => ({ ...prev, externalBridgeState: "unavailable", externalBridgeMessage: message, lastErrorCode: "external-bridge-unavailable", lastErrorMessage: message, activeRecognitionMode: "idle" }));
      updateVoiceEngineSnapshot({ externalState: "unavailable", message, errorCode: "external-bridge-unavailable", source, listening: false });
      announce(message, "warn", true);
      return;
    }
    try {
      setDiagnostics((prev) => ({ ...prev, externalBridgeState: "transcribing", externalBridgeMessage: `Transcribing with ${externalVoiceBaseUrl}…`, activeRecognitionMode: "external" }));
      updateVoiceEngineSnapshot({ externalState: "transcribing", engineMode: voiceEngineMode as any, externalBaseUrl: externalVoiceBaseUrl, source, listening: false, message: `Transcribing with ${externalVoiceBaseUrl}…` });
      const audioBase64 = await blobToBase64(blob);
      const result = await api.voiceBridgeTranscribe({ baseUrl: externalVoiceBaseUrl, timeoutMs: externalVoiceTimeoutMs, mimeType: blob.type || "audio/webm", audioBase64 });
      if (!result?.ok || !result.text) {
        const message = result?.error || "External/local voice bridge returned no transcript.";
        setDiagnostics((prev) => ({ ...prev, externalBridgeState: "degraded", externalBridgeMessage: message, lastErrorCode: "external-transcribe-failed", lastErrorMessage: message, activeRecognitionMode: "idle" }));
        updateVoiceEngineSnapshot({ externalState: "degraded", engineMode: voiceEngineMode as any, externalBaseUrl: externalVoiceBaseUrl, externalAvailable: false, message, errorCode: "external-transcribe-failed", source, listening: false });
        announce(message, "warn", true);
        return;
      }
      const transcript = String(result.text || "").trim();
      const message = transcript ? `Heard: ${transcript}` : "External/local voice bridge returned an empty transcript.";
      if (transcript) {
        setLastHeardAt(Date.now());
        patchVoiceLaneTrace({ heardText: transcript, handoff: looksConversational(transcript) ? "heard → companion" : "heard → command lane", reply: "routing transcript" });
      }

      setDiagnostics((prev) => ({ ...prev, externalBridgeState: "ready", externalBridgeMessage: result.detail || `External/local voice bridge ready at ${externalVoiceBaseUrl}.`, externalBridgeModel: result.model || prev.externalBridgeModel, lastTranscript: transcript || prev.lastTranscript, lastErrorCode: "", lastErrorMessage: "", activeRecognitionMode: "idle" }));
      updateVoiceEngineSnapshot({ externalState: "ready", engineMode: voiceEngineMode as any, externalBaseUrl: externalVoiceBaseUrl, externalAvailable: true, externalModel: result.model || "", source, message: result.detail || `External/local voice bridge ready at ${externalVoiceBaseUrl}.`, errorCode: "", listening: false });
      if (!transcript) {
        announce(message, "warn", true);
        return;
      }
      emitVoiceStatus({ source, status: "transcript", message, transcript, mode: "external" });
      announce(message, "good");
      run(transcript, { fromVoice: true, source });
    } catch (error: any) {
      const code = String(error?.name || "external-transcribe-error");
      const message = classifyExternalBridgeError(`${code}: ${String(error?.message || "External/local transcription failed.")}`, externalVoiceBaseUrl);
      setDiagnostics((prev) => ({ ...prev, externalBridgeState: "degraded", externalBridgeMessage: message, lastErrorCode: code, lastErrorMessage: message, activeRecognitionMode: "idle" }));
      updateVoiceEngineSnapshot({ externalState: "degraded", engineMode: voiceEngineMode as any, externalBaseUrl: externalVoiceBaseUrl, externalAvailable: false, source, message, errorCode: code, listening: false });
      announce(message, "warn", true);
    }
  }

  async function startExternalVoice(pushToTalk = false, source = "homie") {
    const latest = await refreshVoiceDiagnostics();
    if (!navigator.mediaDevices?.getUserMedia) {
      const message = "Microphone access is unavailable because getUserMedia is missing in this runtime.";
      setDiagnostics((prev) => ({ ...prev, ...latest, lastErrorCode: "getusermedia-unavailable", lastErrorMessage: message }));
      updateVoiceEngineSnapshot({ externalState: "unavailable", message, errorCode: "getusermedia-unavailable", source, listening: false });
      announce(message, "warn", true);
      return;
    }
    const probe = await probeExternalVoice(true, latest);
    if (!probe.ok && strictLocalVoice) {
      const message = `${probe.message} External/local mode is strict, so Homie will not fall back to cloud speech. Open Preferences → External Bridge Setup Assistant for the guided startup flow.`;
      setDiagnostics((prev) => ({ ...prev, lastErrorCode: "external-bridge-required", lastErrorMessage: message, activeRecognitionMode: "idle" }));
      announce(message, "warn", true);
      return;
    }
    if (!probe.ok && !strictLocalVoice) {
      announce(`${probe.message} Falling back to cloud speech for this attempt.`, "warn", true);
      await startVoice(pushToTalk, true, false, false, source);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const activeTrack = stream.getAudioTracks?.()[0] || null;
      const activeInputLabel = String(activeTrack?.label || "").trim();
      mediaStreamRef.current = stream;
      if (activeInputLabel) {
        setDiagnostics((prev) => ({ ...prev, selectedAudioInputLabel: activeInputLabel }));
      }
      mediaChunksRef.current = [];
      const recorder = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm" });
      mediaRecorderRef.current = recorder;
      activeVoicePathRef.current = "external";
      recorder.ondataavailable = (event: any) => {
        if (event?.data && event.data.size > 0) mediaChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const type = recorder.mimeType || "audio/webm";
        const blob = new Blob(mediaChunksRef.current, { type });
        mediaChunksRef.current = [];
        try { mediaStreamRef.current?.getTracks()?.forEach((track) => track.stop()); } catch {}
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;
        setIsListening(false);
        setIsHoldingToTalk(false);
        if (blob.size <= 0) {
          const message = "No audio was captured before the external/local voice bridge stopped.";
          setDiagnostics((prev) => ({ ...prev, externalBridgeState: "degraded", externalBridgeMessage: message, lastErrorCode: "external-empty-audio", lastErrorMessage: message, activeRecognitionMode: "idle" }));
          updateVoiceEngineSnapshot({ externalState: "degraded", message, errorCode: "external-empty-audio", source, listening: false });
          announce(message, "warn", true);
          return;
        }
        void transcribeExternalBlob(blob, source);
      };
      recorder.onerror = (event: any) => {
        const message = String(event?.error?.message || event?.message || "External/local recording failed.");
        setDiagnostics((prev) => ({ ...prev, externalBridgeState: "degraded", externalBridgeMessage: message, lastErrorCode: "external-recorder-error", lastErrorMessage: message, activeRecognitionMode: "idle" }));
        updateVoiceEngineSnapshot({ externalState: "degraded", message, errorCode: "external-recorder-error", source, listening: false });
        announce(message, "warn", true);
      };
      recorder.start();
      patchVoiceLaneTrace({ handoff: pushToTalk ? "recording push-to-talk clip" : "recording external clip", reply: "idle" });
      setPresenceState("warming");
      window.setTimeout(() => setPresenceState("listening"), 180);
      setIsListening(true);
      if (pushToTalk) setIsHoldingToTalk(true);
      setDiagnostics((prev) => ({ ...prev, externalBridgeState: "recording", externalBridgeMessage: pushToTalk ? "Hold to talk is recording for the external/local voice bridge." : "Recording for the external/local voice bridge. Tap again to finish.", activeRecognitionMode: "external", lastErrorCode: "", lastErrorMessage: "" }));
      updateVoiceEngineSnapshot({ externalState: "recording", engineMode: voiceEngineMode as any, externalBaseUrl: externalVoiceBaseUrl, externalAvailable: true, source, listening: true, message: pushToTalk ? "Hold to talk is recording for the external/local voice bridge." : "Recording for the external/local voice bridge. Tap again to finish." });
      announce(pushToTalk ? "Hold to talk is recording through the external/local voice bridge." : "Recording through the external/local voice bridge. Tap again to finish.", "good");
    } catch (error: any) {
      const code = String(error?.name || "external-start-failed");
      const message = `${code}: ${String(error?.message || "Could not start external/local voice recording.")}`;
      setDiagnostics((prev) => ({ ...prev, externalBridgeState: "degraded", externalBridgeMessage: message, lastErrorCode: code, lastErrorMessage: message, activeRecognitionMode: "idle" }));
      updateVoiceEngineSnapshot({ externalState: "degraded", message, errorCode: code, source, listening: false });
      announce(message, "warn", true);
    }
  }
  async function runMicTest() {
    setDiagnostics((prev) => ({ ...prev, micTest: "running", lastErrorCode: "", lastErrorMessage: "" }));
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("getUserMedia is unavailable in this runtime.");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const track = stream.getAudioTracks?.()[0] || null;
      const selectedAudioInputLabel = String(track?.label || "").trim();
      stream.getTracks().forEach((track) => track.stop());
      const fresh = await refreshVoiceDiagnostics();
      setDiagnostics((prev) => ({ ...prev, ...fresh, micTest: "pass", selectedAudioInputLabel: selectedAudioInputLabel || fresh.selectedAudioInputLabel || prev.selectedAudioInputLabel }));
      updateVoiceEngineSnapshot({ pushToTalkState: "ready", audioInputCount: fresh.audioInputCount, permissionState: fresh.permissionState, message: `Mic test passed. ${fresh.audioInputCount || 1} audio input${fresh.audioInputCount === 1 ? "" : "s"} detected.`, source: "homie" });
      announce(`Mic test passed. ${fresh.audioInputCount || 1} audio input${fresh.audioInputCount === 1 ? "" : "s"} detected.`, "good", true);
    } catch (error: any) {
      const code = String(error?.name || error?.code || "mic-test-failed");
      const message = `${code}: ${String(error?.message || "Microphone test failed.")}`;
      setDiagnostics((prev) => ({ ...prev, micTest: "fail", lastErrorCode: code, lastErrorMessage: message }));
      updateVoiceEngineSnapshot({ pushToTalkState: "degraded", message: `Mic test failed. ${message}`, errorCode: code, source: "homie" });
      announce(`Mic test failed at the microphone-access step. ${message}`, "warn", true);
    }
  }

  function speak(text: string, force = false, opts?: { onDone?: () => void }) {
    try {
      if (!force && !voiceEnabled) {
        opts?.onDone?.();
        return;
      }
      const spoken = text.replace(/\*\*/g, "").trim();
      if (!spoken) {
        opts?.onDone?.();
        return;
      }
      const utterance = new SpeechSynthesisUtterance(spoken);
      const voice = pickVoice(voiceProfile);
      if (voice) utterance.voice = voice;
      utterance.rate = 0.97;
      utterance.pitch = skin === "phoenix" ? 1.02 : skin === "terminal" ? 0.82 : 0.92;
      const finish = () => {
        setIsSpeaking(false);
        setPresenceState((prev) => prev === "needs-provider" ? "needs-provider" : "ready");
        opts?.onDone?.();
      };
      utterance.onstart = () => {
        clearPendingVoiceResume();
        setIsSpeaking(true);
        setPresenceState("talking");
      };
      utterance.onend = finish;
      utterance.onerror = finish;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    } catch {
      setIsSpeaking(false);
      opts?.onDone?.();
    }
  }

  function announce(nextStatus: string, nextMood: "idle" | "good" | "warn" = "good", force = false) {
    setStatus(nextStatus);
    setMood(nextMood);
    speak(nextStatus, force);
  }

  function emitVoiceStatus(detail: Record<string, any>) {
    const mode = String(detail.mode || activeVoicePathRef.current || "cloud");
    const nextCloudState = mode === "cloud"
      ? (detail.status === "started" ? "listening" : detail.status === "error" ? "degraded" : diagnostics.recognitionAvailable ? "ready" : "unavailable")
      : (diagnostics.recognitionAvailable ? "ready" : "degraded");
    const nextExternalState = mode === "external"
      ? (detail.status === "started" ? "recording" : detail.status === "error" ? "degraded" : detail.status === "transcribing" ? "transcribing" : diagnostics.externalBridgeState)
      : diagnostics.externalBridgeState;
    updateVoiceEngineSnapshot({
      cloudState: nextCloudState as any,
      pushToTalkState: diagnostics.microphoneApiAvailable ? "ready" : "unavailable",
      typedState: "ready",
      localState: "disabled",
      externalState: nextExternalState as any,
      engineMode: voiceEngineMode as any,
      externalAvailable: diagnostics.externalBridgeState === "ready" || diagnostics.externalBridgeState === "recording" || diagnostics.externalBridgeState === "transcribing",
      externalBaseUrl: diagnostics.externalBridgeBaseUrl || externalVoiceBaseUrl,
      externalModel: diagnostics.externalBridgeModel || "",
      recognitionAvailable: diagnostics.recognitionAvailable,
      microphoneApiAvailable: diagnostics.microphoneApiAvailable,
      permissionState: diagnostics.permissionState,
      secureContext: diagnostics.secureContext,
      audioInputCount: diagnostics.audioInputCount,
      listening: detail.status === "started",
      source: detail.source || "homie",
      message: detail.message || diagnostics.lastErrorMessage || diagnostics.externalBridgeMessage || diagnostics.localMessage,
      errorCode: detail.errorCode || "",
    });
    try {
      window.dispatchEvent(new CustomEvent("oddengine:voice-status", { detail }));
    } catch {}
  }

  function run(text: string, opts?: { fromVoice?: boolean; source?: string }) {
    const msg = String(text || "").trim();
    if (!msg) return;
    noteHomieInteraction(opts?.fromVoice ? "voice" : "action", msg, activePanelId);
    if (looksConversational(msg)) {
      clearPendingVoiceResume();
      try { if (window.speechSynthesis?.speaking) { window.speechSynthesis.cancel(); setIsSpeaking(false); } } catch {}
      if (opts?.fromVoice && continuousVoice) {
        suppressVoiceLoopRestartRef.current = true;
        pendingVoiceFollowupSourceRef.current = opts.source || "homie";
      }
      patchVoiceLaneTrace({ handoff: opts?.fromVoice ? "heard → companion" : "typed → companion" });
      void sendRealCompanion(msg, { forceVoice: !!opts?.fromVoice, voiceSource: opts?.source });
      return;
    }
    patchVoiceLaneTrace({ handoff: opts?.fromVoice ? "heard → command lane" : "typed → command lane", reply: "command handled" });
    const result = executeCommand({ text: msg, activePanelId, onNavigate, onOpenHowTo, onStatus: (message) => announce(message, "good") });
    if (result?.message) announce(result.message, result.ok ? "good" : "warn");
  }

  function openFullHomie(text?: string) {
    const msg = String(text || "").trim();
    if (msg) seedHomieDraft(msg, { source: "homie-buddy", panelId: activePanelId });
    setChatDraft("");
    onNavigate("Homie");
  }

  function looksConversational(text: string) {
    const settings = loadHomieSettings(activePanelId);
    if (settings.voiceMode === "companion") return true;
    if (settings.voiceMode === "commands") return false;
    const clean = String(text || "").trim().toLowerCase();
    if (!clean) return false;
    if (clean.endsWith("?")) return true;
    if (/^(what|why|how|can|could|should|would|help|i\b|i'm\b|im\b|my\b|stay\b|talk\b|listen\b|check in\b|sort\b)/.test(clean)) return true;
    if (/\b(feel|thinking|stuck|overwhelmed|calm|plan|next step|money move|stay with me)\b/.test(clean)) return true;
    return clean.split(/\s+/).length >= 7 && !/^(open|go to|switch to|run|build|launch|focus|install|grant|refresh)\b/.test(clean);
  }


  async function sendRealCompanion(text: string, opts?: { forceVoice?: boolean; voiceSource?: string }) {
    const msg = String(text || "").trim();
    if (!msg || companionBusy) return;
    const turnId = conversationTurnSeqRef.current + 1;
    conversationTurnSeqRef.current = turnId;
    latestConversationTurnRef.current = turnId;
    const userMsg = makeCompanionMessage("user", msg);
    const next = [...companionMessages, userMsg].slice(-40);
    const settings = loadHomieSettings(activePanelId);
    setCompanionMessages(next);
    setChatDraft("");
    noteHomieInteraction("action", msg, activePanelId);
    if (!desktop) {
      const fallback = makeCompanionMessage("assistant", "Real companion chat needs Desktop mode so Homie can reach your configured provider safely. Open the desktop build, or tap Open Homie for the full panel.");
      setCompanionMessages((prev) => [...prev, fallback].slice(-40));
      patchVoiceLaneTrace({ reply: "desktop required" });
      announce(fallback.content, "warn", true);
      return;
    }
    setPresenceState("thinking");
    setCompanionBusy(true);
    patchVoiceLaneTrace({
      handoff: opts?.forceVoice ? "live utterance → companion" : "typed/direct → companion",
      reply: "waiting on provider",
      promptMode: describePromptMode(settings.contextMode, settings.chatCleanMode),
    });
    try {
      const runtime = loadHomieCompanionRuntime(activePanelId);
      setCompanionModel(runtime.model);
      setCompanionProviderLabel(runtime.providerLabel);
      const res = await sendCompanionChat({
        activePanelId,
        messages: next,
        model: runtime.model,
        temperature: runtime.temperature,
        system: runtime.system,
        autoFallback: settings.autoFallback,
        includeContext: settings.includeContext,
        contextMode: settings.contextMode,
        chatCleanMode: settings.chatCleanMode,
        rememberCompanionFacts: settings.rememberCompanionFacts,
      });
      if (turnId !== latestConversationTurnRef.current) return;
      if (!res.ok) {
        const tried = res.tried?.length ? ` Tried: ${res.tried.join(" → ")}.` : "";
        const body = (res.error || `Homie could not reach ${runtime.providerLabel} (${runtime.model}). Check the provider settings in the Homie panel.`) + tried;
        const errMsg = makeCompanionMessage("assistant", `⚠️ ${body}`);
        setCompanionMessages((prev) => [...prev, errMsg].slice(-40));
        const quickVoiceHelp = /ollama/i.test(body)
          ? `I can't reach Ollama yet. Open full Homie, use Provider setup wizard, start Ollama, then pull ${runtime.model || "llama3.1:8b"}.`
          : `I can't reach ${runtime.providerLabel} yet. Open full Homie and run the provider setup wizard.`;
        setLastReplyPreview(`No reply — ${previewText(body, 240)}`);
        setLastReplyProvider(runtime.providerLabel);
        setLastReplyAt(Date.now());
        patchVoiceLaneTrace({ reply: "provider failed", providerUsed: runtime.providerLabel, promptMode: describePromptMode(res.promptMode || settings.contextMode, settings.chatCleanMode), directRequest: res.directRequestDetected ? "yes" : "no", supportMode: res.supportModeApplied ? "yes" : "no", contextIncluded: res.contextIncluded || "none" });
        setProviderHealth((prev) => ({
          ...prev,
          status: prev.status === "fallback-ready" ? "fallback-ready" : "offline",
          selectedProvider: runtime.provider,
          selectedProviderLabel: runtime.providerLabel,
          activeProviderLabel: runtime.providerLabel,
          detail: body,
          lastError: body,
          checkedAt: Date.now(),
        }));
        setPresenceState("needs-provider");
        clearPendingVoiceResume();
        void refreshProviderHealth(true);
        if (!!opts?.forceVoice && continuousVoice) setContinuousVoice(false);
        announce(!!opts?.forceVoice ? quickVoiceHelp : body, "warn", true);
        suppressVoiceLoopRestartRef.current = false;
        pendingVoiceFollowupSourceRef.current = null;
        return;
      }
      if (turnId !== latestConversationTurnRef.current) return;
      const replyText = (res.reply || "").trim() || "I'm here with you. Give me one more detail and I'll help sort it out.";
      const reply = makeCompanionMessage("assistant", replyText);
      setCompanionModel(res.model || runtime.model);
      setCompanionProviderLabel(res.providerLabel || runtime.providerLabel);
      setLastReplyPreview(previewText(replyText, 240));
      setLastReplyProvider(res.providerLabel || runtime.providerLabel);
      setLastReplyAt(Date.now());
      patchVoiceLaneTrace({ reply: "reply ready", providerUsed: res.providerLabel || runtime.providerLabel, promptMode: describePromptMode(res.promptMode || settings.contextMode, settings.chatCleanMode), directRequest: res.directRequestDetected ? "yes" : "no", supportMode: res.supportModeApplied ? "yes" : "no", contextIncluded: res.contextIncluded || "none" });
      setProviderHealth({
        status: res.provider && res.provider !== runtime.provider ? "fallback-ready" : "ready",
        selectedProvider: runtime.provider,
        selectedProviderLabel: runtime.providerLabel,
        activeProviderLabel: res.providerLabel || runtime.providerLabel,
        fallbackProviderLabel: res.provider && res.provider !== runtime.provider ? (res.providerLabel || runtime.providerLabel) : "",
        detail: res.provider && res.provider !== runtime.provider
          ? `${runtime.providerLabel} was down, so Homie answered through ${res.providerLabel || runtime.providerLabel}.`
          : `${res.providerLabel || runtime.providerLabel} answered cleanly.`,
        lastError: "",
        checkedAt: Date.now(),
      });
      setCompanionMessages((prev) => {
        const merged = [...prev, reply].slice(-40);
        setCompanionMemory(syncCompanionMemoryFromMessages(merged as any, activePanelId));
        return merged;
      });
      const shouldSpeak = !!opts?.forceVoice || mode === "standalone" || settings.autoSpeakReplies;
      const voiceSource = opts?.voiceSource || pendingVoiceFollowupSourceRef.current || "homie";
      const replyPreview = replyText.length > 180 ? `${replyText.slice(0, 177)}…` : replyText;
      updateStatusOnly(replyPreview, "good");
      if (/nice|great|awesome|win|done|ready|hell yes|let's go/i.test(replyText)) {
        setPresenceState("celebrating");
        window.setTimeout(() => setPresenceState(shouldSpeak ? "talking" : "ready"), 950);
      }
      if (shouldSpeak) {
        speak(replyText, true, {
          onDone: () => {
            if (!!opts?.forceVoice && continuousVoice && !manualStopRef.current) {
              suppressVoiceLoopRestartRef.current = false;
              pendingVoiceFollowupSourceRef.current = null;
              scheduleVoiceResume(voiceSource, 240);
              return;
            }
            suppressVoiceLoopRestartRef.current = false;
            pendingVoiceFollowupSourceRef.current = null;
          },
        });
      } else {
        setPresenceState("ready");
        if (!!opts?.forceVoice && continuousVoice && !manualStopRef.current) {
          suppressVoiceLoopRestartRef.current = false;
          pendingVoiceFollowupSourceRef.current = null;
          scheduleVoiceResume(voiceSource, 360);
        } else {
          suppressVoiceLoopRestartRef.current = false;
          pendingVoiceFollowupSourceRef.current = null;
        }
      }
    } catch (error: any) {
      const body = String(error?.message || error || "Homie companion chat failed.");
      const errMsg = makeCompanionMessage("assistant", `⚠️ ${body}`);
      setCompanionMessages((prev) => [...prev, errMsg].slice(-40));
      setLastReplyPreview(`No reply — ${previewText(body, 240)}`);
      setLastReplyProvider(companionProviderLabel || createBaseProviderHealth(activePanelId).selectedProviderLabel);
      setLastReplyAt(Date.now());
      setProviderHealth((prev) => ({
        ...prev,
        status: prev.status === "fallback-ready" ? "fallback-ready" : "offline",
        detail: body,
        lastError: body,
        checkedAt: Date.now(),
      }));
      setPresenceState("needs-provider");
      clearPendingVoiceResume();
      void refreshProviderHealth(true);
      if (!!opts?.forceVoice && continuousVoice) setContinuousVoice(false);
      announce(!!opts?.forceVoice ? "Homie hit a provider problem. Open full Homie and run the provider setup wizard." : body, "warn", true);
      suppressVoiceLoopRestartRef.current = false;
      pendingVoiceFollowupSourceRef.current = null;
    } finally {
      setCompanionBusy(false);
    }
  }

  function stopVoice(silent = false, source = "homie") {
    manualStopRef.current = true;
    clearPendingVoiceResume();
    if (activeVoicePathRef.current === "external") {
      try {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") mediaRecorderRef.current.stop();
      } catch {}
      setIsListening(false);
      setIsHoldingToTalk(false);
      setPresenceState("ready");
      emitVoiceStatus({ source, status: "ended", message: "Stopped external/local recording.", mode: "external" });
      if (!silent) updateStatusOnly("Stopped external/local recording.", "idle");
      return;
    }
    try {
      recognitionRef.current?.stop?.();
    } catch {}
    setIsListening(false);
    setIsHoldingToTalk(false);
    patchVoiceLaneTrace({ handoff: "stopped", reply: "idle" });
    setPresenceState("ready");
    emitVoiceStatus({ source, status: "ended", message: "Stopped listening.", mode: "cloud" });
    if (!silent) updateStatusOnly("Stopped listening.", "idle");
  }

  async function startVoice(pushToTalk = false, allowBias = true, _forceLocal = false, _networkRetryUsed = false, source = "homie") {
    manualStopRef.current = false;
    clearPendingVoiceResume();
    try { if (window.speechSynthesis?.speaking) { window.speechSynthesis.cancel(); setIsSpeaking(false); } } catch {}
    const latest = await refreshVoiceDiagnostics();
    const forceCloud = source.includes("doctor-cloud");
    const forceExternal = source.includes("doctor-external");
    const useExternal = forceExternal ? true : forceCloud ? false : (wantsExternalVoice() && (voiceEngineMode === "external-http" || (voiceEngineMode === "hybrid" && diagnostics.externalBridgeState === "ready")));
    if (useExternal) {
      activeVoicePathRef.current = "external";
      await startExternalVoice(pushToTalk, source);
      return;
    }
    activeVoicePathRef.current = "cloud";
    setPresenceState("warming");
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      const message = "SpeechRecognition is unavailable in this runtime. Homie can still speak status, but voice commands need Web Speech recognition support.";
      setDiagnostics((prev) => ({ ...prev, ...latest, lastErrorCode: "unsupported", lastErrorMessage: message }));
      updateVoiceEngineSnapshot({ cloudState: "unavailable", message, errorCode: "unsupported", source, recognitionAvailable: false, microphoneApiAvailable: latest.microphoneApiAvailable, permissionState: latest.permissionState, audioInputCount: latest.audioInputCount, secureContext: latest.secureContext, localState: "disabled", typedState: "ready", pushToTalkState: latest.microphoneApiAvailable ? "ready" : "unavailable", listening: false });
      emitVoiceStatus({ source, status: "error", message, errorCode: "unsupported" });
      announce(message, "warn", true);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      const message = "Microphone access is unavailable because getUserMedia is missing in this runtime.";
      setDiagnostics((prev) => ({ ...prev, ...latest, lastErrorCode: "getusermedia-unavailable", lastErrorMessage: message }));
      updateVoiceEngineSnapshot({ cloudState: latest.recognitionAvailable ? "degraded" : "unavailable", pushToTalkState: "unavailable", message, errorCode: "getusermedia-unavailable", source, recognitionAvailable: latest.recognitionAvailable, microphoneApiAvailable: false, permissionState: latest.permissionState, audioInputCount: latest.audioInputCount, secureContext: latest.secureContext, localState: "disabled", typedState: "ready", listening: false });
      emitVoiceStatus({ source, status: "error", message, errorCode: "getusermedia-unavailable" });
      announce(message, "warn", true);
      return;
    }
    try {
      const rec = new Ctor();
      recognitionRef.current = rec;
      rec.lang = "en-US";
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      const usingLocal = false;
      const biased = allowBias ? applyRecognitionBias(rec) : false;
      if (pushToTalk) setIsHoldingToTalk(true);
      rec.onstart = () => {
        patchVoiceLaneTrace({ handoff: pushToTalk ? "listening (push-to-talk)" : "listening for speech", reply: "idle" });
        setIsListening(true);
        setDiagnostics((prev) => ({
          ...prev,
          phrasesSupported: prev.phrasesSupported || biased,
          phraseBiasMode: biased ? "supported" : prev.recognitionAvailable ? "optional" : "unsupported",
          activeRecognitionMode: usingLocal ? "local" : "cloud",
        }));
        const startedMessage = pushToTalk ? "Push-to-talk is live. Hold the button and speak." : "Listening for your command.";
        setPresenceState("listening");
        emitVoiceStatus({ source, status: "started", message: startedMessage, mode: "cloud" });
        updateStatusOnly(startedMessage, "good");
      };
      rec.onresult = (event: any) => {
        const transcript = String(event?.results?.[0]?.[0]?.transcript || "").trim();
        setIsListening(false);
        setIsHoldingToTalk(false);
        if (transcript) {
          setLastHeardAt(Date.now());
          patchVoiceLaneTrace({ heardText: transcript, handoff: looksConversational(transcript) ? "heard → companion" : "heard → command lane", reply: "routing transcript" });
        }
        setDiagnostics((prev) => ({ ...prev, lastTranscript: transcript || prev.lastTranscript }));
        if (!transcript) {
          announce("Recognition started, but no transcript came back.", "warn", true);
          return;
        }
        emitVoiceStatus({ source, status: "transcript", message: `Heard: ${transcript}`, transcript });
        updateStatusOnly(`Heard: ${transcript}`, "good");
        run(transcript, { fromVoice: true, source });
      };
      rec.onerror = (event: any) => {
        const code = String(event?.error || "unknown");
        const rawMessage = String(event?.message || event?.error || "");
        if (biased && allowBias && isPhraseBiasError(code, rawMessage)) {
          try { rec.abort?.(); } catch {}
          setIsListening(false);
          setIsHoldingToTalk(false);
          setDiagnostics((prev) => ({
            ...prev,
            phraseBiasMode: "optional",
            phrasesSupported: false,
            lastErrorCode: "phrase-bias-unsupported",
            lastErrorMessage: "Phrase biasing is unsupported in this runtime. Retrying with standard voice recognition.",
          }));
          announce("Phrase boost is unsupported here. Retrying with standard voice recognition.", "warn", true);
          window.setTimeout(() => {
            void startVoice(pushToTalk, false, false, false, source);
          }, 80);
          return;
        }
        if (code === "network") {
          const fallbackMessage = `${mapRecognitionError(code)} External/local bridge mode can stay available separately through Homie diagnostics if you have a local HTTP bridge running.`;
          setIsListening(false);
          setIsHoldingToTalk(false);
          setDiagnostics((prev) => ({ ...prev, activeRecognitionMode: "idle", lastErrorCode: code, lastErrorMessage: fallbackMessage }));
          emitVoiceStatus({ source, status: "error", message: fallbackMessage, errorCode: code });
          announce(fallbackMessage, "warn", true);
          return;
        }
        const message = mapRecognitionError(code);
        setIsListening(false);
        setIsHoldingToTalk(false);
        setDiagnostics((prev) => ({ ...prev, activeRecognitionMode: "idle", lastErrorCode: code, lastErrorMessage: message }));
        emitVoiceStatus({ source, status: "error", message, errorCode: code });
        announce(message, "warn", true);
      };
      rec.onend = () => {
        setIsListening(false);
        setIsHoldingToTalk(false);
        setDiagnostics((prev) => ({ ...prev, activeRecognitionMode: "idle" }));
        emitVoiceStatus({ source, status: "ended", message: "Voice session ended." });
        if (continuousVoice && !pushToTalk && !manualStopRef.current && !suppressVoiceLoopRestartRef.current) {
          scheduleVoiceResume(source, 280);
        }
      };
      rec.start();
    } catch (error: any) {
      const code = String(error?.name || "recognition-start-failed");
      const rawMessage = String(error?.message || "Voice recognition could not start.");
      if (allowBias && isPhraseBiasError(code, rawMessage)) {
        setDiagnostics((prev) => ({
          ...prev,
          phraseBiasMode: "optional",
          phrasesSupported: false,
          lastErrorCode: "phrase-bias-unsupported",
          lastErrorMessage: "Phrase biasing is unsupported in this runtime. Retrying with standard voice recognition.",
        }));
        announce("Phrase boost is unsupported here. Retrying with standard voice recognition.", "warn", true);
        window.setTimeout(() => {
          void startVoice(pushToTalk, false, false, false, source);
        }, 80);
        return;
      }
      const message = `${code}: ${rawMessage}`;
      setDiagnostics((prev) => ({ ...prev, activeRecognitionMode: "idle", lastErrorCode: code, lastErrorMessage: message }));
      setIsListening(false);
      setIsHoldingToTalk(false);
      emitVoiceStatus({ source, status: "error", message: `Voice recognition failed during startup. ${message}`, errorCode: code });
      announce(`Voice recognition failed during startup. ${message}`, "warn", true);
    }
  }


  async function refreshProviderHealth(silent = false) {
    const checkId = providerCheckSeqRef.current + 1;
    providerCheckSeqRef.current = checkId;
    latestProviderCheckRef.current = checkId;
    if (!desktop) {
      const next = createBaseProviderHealth(activePanelId);
      setProviderHealth(next);
      if (!silent) announce(next.detail, "warn", true);
      return next;
    }
    const checking = (() => {
      const base = createBaseProviderHealth(activePanelId);
      return { ...base, status: "checking" as const, detail: `Checking ${base.selectedProviderLabel}…` };
    })();
    if (!silent) setProviderHealth(checking);
    try {
      const rows = await probeAllHomieProviders(activePanelId);
      if (checkId !== latestProviderCheckRef.current) return providerHealth;
      const next = buildProviderHealthFromRows(activePanelId, rows as any);
      setProviderHealth((prev) => {
        if (silent && prev.status === "checking") return { ...next, status: next.status, detail: next.detail };
        return next;
      });
      if (next.status === "ready" && presenceState === "needs-provider" && !companionBusy && !isListening && !isSpeaking) {
        setPresenceState("ready");
      }
      if (!silent) announce(next.detail, next.status === "ready" ? "good" : "warn", true);
      return next;
    } catch (error: any) {
      if (checkId !== latestProviderCheckRef.current) return providerHealth;
      const base = createBaseProviderHealth(activePanelId);
      const detail = String(error?.message || error || `Could not check ${base.selectedProviderLabel}.`);
      const next: ProviderHealth = {
        ...base,
        status: "offline",
        detail,
        lastError: detail,
        checkedAt: Date.now(),
      };
      setProviderHealth(next);
      if (!silent) announce(detail, "warn", true);
      return next;
    }
  }

  async function runTypedReplySmokeTest() {
    if (companionBusy) return;
    const turnId = conversationTurnSeqRef.current + 1;
    conversationTurnSeqRef.current = turnId;
    latestConversationTurnRef.current = turnId;
    setShowDiagnostics(true);
    const settings = loadHomieSettings(activePanelId);
    const runtime = loadHomieCompanionRuntime(activePanelId);
    setCompanionModel(runtime.model);
    setCompanionProviderLabel(runtime.providerLabel);
    setProviderHealth((prev) => ({ ...prev, status: "checking", detail: `Checking ${runtime.providerLabel} with a typed ping…` }));
    patchVoiceLaneTrace({ handoff: "typed smoke test", reply: "waiting on provider", promptMode: "smoke test • clean chat", providerUsed: runtime.providerLabel, directRequest: "yes", supportMode: "no", contextIncluded: "none" });
    try {
      const res = await sendCompanionChat({
        activePanelId,
        messages: [makeCompanionMessage("user", "Give me a six-word readiness ping.")],
        model: runtime.model,
        temperature: runtime.temperature,
        system: runtime.system,
        autoFallback: settings.autoFallback,
        includeContext: false,
        contextMode: "clean",
        chatCleanMode: true,
        rememberCompanionFacts: false,
      });
      if (turnId !== latestConversationTurnRef.current) return;
      if (!res.ok) {
        const body = (res.error || `${runtime.providerLabel} did not answer.`) + (res.tried?.length ? ` Tried: ${res.tried.join(" → ")}.` : "");
        setLastReplyPreview(`No reply — ${previewText(body, 240)}`);
        setLastReplyProvider(runtime.providerLabel);
        setLastReplyAt(Date.now());
        patchVoiceLaneTrace({ reply: "provider failed", providerUsed: runtime.providerLabel, promptMode: describePromptMode(res.promptMode || settings.contextMode, settings.chatCleanMode), directRequest: res.directRequestDetected ? "yes" : "no", supportMode: res.supportModeApplied ? "yes" : "no", contextIncluded: res.contextIncluded || "none" });
        setProviderHealth((prev) => ({
          ...prev,
          status: prev.status === "fallback-ready" ? "fallback-ready" : "offline",
          activeProviderLabel: runtime.providerLabel,
          detail: body,
          lastError: body,
          checkedAt: Date.now(),
        }));
        void refreshProviderHealth(true);
        announce(`Typed smoke test failed. ${body}`, "warn", true);
        return;
      }
      if (turnId !== latestConversationTurnRef.current) return;
      const replyText = (res.reply || "Ready and here with you.").trim();
      const preview = previewText(replyText, 240);
      setLastReplyPreview(preview);
      setLastReplyProvider(res.providerLabel || runtime.providerLabel);
      setLastReplyAt(Date.now());
      patchVoiceLaneTrace({ reply: "smoke test reply ready", providerUsed: res.providerLabel || runtime.providerLabel, promptMode: `smoke test • ${describePromptMode(res.promptMode || "clean", true)}`, directRequest: res.directRequestDetected ? "yes" : "no", supportMode: res.supportModeApplied ? "yes" : "no", contextIncluded: res.contextIncluded || "none" });
      setProviderHealth({
        status: res.provider && res.provider !== runtime.provider ? "fallback-ready" : "ready",
        selectedProvider: runtime.provider,
        selectedProviderLabel: runtime.providerLabel,
        activeProviderLabel: res.providerLabel || runtime.providerLabel,
        fallbackProviderLabel: res.provider && res.provider !== runtime.provider ? (res.providerLabel || runtime.providerLabel) : "",
        detail: res.provider && res.provider !== runtime.provider
          ? `${runtime.providerLabel} was down, so Homie answered through ${res.providerLabel || runtime.providerLabel}.`
          : `${res.providerLabel || runtime.providerLabel} answered cleanly.`,
        lastError: "",
        checkedAt: Date.now(),
      });
      announce(`Typed smoke test passed through ${res.providerLabel || runtime.providerLabel}.`, "good", true);
    } catch (error: any) {
      if (turnId !== latestConversationTurnRef.current) return;
      const body = String(error?.message || error || "Typed smoke test failed.");
      setLastReplyPreview(`No reply — ${previewText(body, 240)}`);
      setLastReplyProvider(runtime.providerLabel);
      setLastReplyAt(Date.now());
      patchVoiceLaneTrace({ reply: "smoke test failed", providerUsed: runtime.providerLabel });
      setProviderHealth((prev) => ({
        ...prev,
        status: prev.status === "fallback-ready" ? "fallback-ready" : "offline",
        activeProviderLabel: runtime.providerLabel,
        detail: body,
        lastError: body,
        checkedAt: Date.now(),
      }));
      void refreshProviderHealth(true);
      announce(`Typed smoke test failed. ${body}`, "warn", true);
    }
  }

  async function runVoicePathCheck() {
    setShowDiagnostics(true);
    const fresh = await refreshVoiceDiagnostics();
    let micOk = fresh.micTest === "pass";
    if (!micOk) {
      try {
        await runMicTest();
        micOk = true;
      } catch {
        micOk = false;
      }
    }
    const latest = await refreshVoiceDiagnostics();
    if (wantsExternalVoice()) {
      await probeExternalVoice(true, latest);
    }
    const finalState = await refreshVoiceDiagnostics();
    await refreshProviderHealth(true);
    const stage = stageLabelForConversation({
      presenceState,
      isListening,
      isSpeaking,
      isThinking: companionBusy,
      externalBridgeState: finalState.externalBridgeState,
    });
    const report = buildHearYouDoctorReport({
      diagnostics: { ...finalState, micTest: micOk ? "pass" : finalState.micTest },
      voiceEnabled,
      voiceMode: homieSettings.voiceMode,
      voiceEngineMode,
      stageLabel: stage,
    });
    announce(`${report.headline} ${report.nextStep}`, report.tone, true);
  }

  async function forceVoicePathTest(path: "cloud" | "external") {
    setShowDiagnostics(true);
    clearPendingVoiceResume();
    if (path === "cloud") {
      await startVoice(false, true, false, false, "doctor-cloud");
      return;
    }
    await startVoice(false, true, false, false, "doctor-external");
  }

  function triggerMemojiEmote(kind: "none" | "fistbump" | "celebrate" | "alert" | "facepalm") {
    if (reduceMotion) return;
    setMemojiEmote(kind);
    window.setTimeout(() => setMemojiEmote("none"), kind === "celebrate" ? 1200 : 900);
  }

  async function launchCompanion() {
    if (!api.openWindow) {
      announce("Companion pop-out is only available in desktop mode.", "warn", true);
      return;
    }
    const r = await api.openWindow({
      title: "Homie Buddy",
      query: { buddy: "1" },
      windowType: "homie-buddy",
      width: 480,
      height: 820,
      frame: false,
      transparent: true,
      skipTaskbar: false,
      resizable: true,
    });
    if (r.ok) announce("Launched the Homie companion window.", "good");
    else announce(r.error || "Could not launch the Homie companion window.", "warn", true);
  }

  function pinCurrentFocus() {
    const text = companionMemory.lastUserNeed || companionMemory.currentFocus || activeTitle;
    pinHomieFact(text, activePanelId);
    setLaneMemory(loadHomieCompanionLaneMemory());
    announce(`Pinned for Homie memory: ${text}`, "good", true);
  }

  function markMilestone(text?: string) {
    const label = String(text || `${activeTitle} steady step logged`).trim();
    addHomieMilestone(label, activePanelId);
    setLaneMemory(loadHomieCompanionLaneMemory());
    announce(`Relationship milestone saved: ${label}`, "good", true);
  }

  const avatarState = `${isListening ? "listening" : ""} ${isSpeaking ? "speaking" : ""} ${mood} skin-${skin} gesture-${gesture}`.trim();
  const homieSettings = loadHomieSettings(activePanelId);
  const shellClass = mode === "standalone" ? "homieCompanion" : `homieBuddy ${open ? "open" : ""} ${((prefs.ai as any).homieAlwaysReady !== false) ? "alwaysReady" : ""}`;
  const selectedPreset = (prefs.ai.homieRoomPreset || "trading") as RoomPresetId;
  const presetConfig = selectedPreset === "custom" ? null : ROOM_PRESETS[selectedPreset];
  const rawFurnitureTheme = (presetConfig?.furnitureTheme || prefs.ai.homieFurnitureTheme || "fairlyodd-neon") as RoomThemeId;
  const furnitureTheme = (rawFurnitureTheme === "cyber-noir" && !isRoomPackInstalled("homie-room-pack-cyber-noir"))
    ? ("fairlyodd-neon" as RoomThemeId)
    : (rawFurnitureTheme === "mission-ops" && !isRoomPackInstalled("homie-room-pack-mission-ops"))
    ? ("arcade-rig" as RoomThemeId)
    : rawFurnitureTheme;
  const wallItem = (presetConfig?.wallItem || prefs.ai.homieWallItem || "chart-wall") as WallItemId;
  const deskItem = (presetConfig?.deskItem || prefs.ai.homieDeskItem || "trading-rig") as DeskItemId;
  const moodLighting = (presetConfig?.moodLighting || prefs.ai.homieMoodLighting || "neon") as MoodLightingId;
  const houseSummary = `${titleCasePreset(selectedPreset)} • ${ROOM_LABELS.furnitureTheme[furnitureTheme]} • ${ROOM_LABELS.moodLighting[moodLighting]}`;
  const roomTheme = `${skin === "phoenix" ? "phoenix" : skin === "terminal" ? "terminal" : skin === "lil-homie" ? "cozy" : "orb"} theme-${furnitureTheme} wall-${wallItem} desk-${deskItem} light-${moodLighting} preset-${selectedPreset.replace(/[^a-z-]/g, "")}`;
  const roomLayoutSlot = selectedPreset as RoomLayoutSlot;
  const layoutHint = layoutEditMode
    ? "Drag the wall piece, desk setup, lamp, plant, monitor, side table, or Homie. Changes auto-save to this preset."
    : `${titleCasePreset(roomLayoutSlot)} layout is ready. Turn on Edit layout to place items and auto-save the setup.`;
  const bridgeTone = diagnostics.externalBridgeState === "ready" ? "good" : strictLocalVoice ? "warn" : voiceEngineMode === "hybrid" ? "warn" : "";
  const bridgeChipLabel = diagnostics.externalBridgeState === "ready"
    ? "Bridge reachable"
    : strictLocalVoice
    ? "Bridge required"
    : voiceEngineMode === "hybrid"
    ? "Bridge optional"
    : "Cloud mode";
  const conversationStageLabel = stageLabelForConversation({
    presenceState,
    isListening,
    isSpeaking,
    isThinking: companionBusy,
    externalBridgeState: diagnostics.externalBridgeState,
  });
  const browserSttTrace = !diagnostics.recognitionAvailable
    ? "unsupported"
    : activeVoicePathRef.current === "cloud" && isListening
      ? "listening"
      : diagnostics.lastErrorCode && /unsupported|getusermedia|not-allowed|audio-capture|no-speech|network|phrase/i.test(diagnostics.lastErrorCode)
        ? "needs attention"
        : "ready";
  const recordingTrace = diagnostics.externalBridgeState === "recording"
    ? "recording"
    : diagnostics.externalBridgeState === "transcribing"
      ? "transcribing"
      : "idle";
  const hearYouDoctor = buildHearYouDoctorReport({
    diagnostics,
    voiceEnabled,
    voiceMode: homieSettings.voiceMode,
    voiceEngineMode,
    stageLabel: conversationStageLabel,
  });
  const providerStatusBadge = providerBadgeLabel(providerHealth);
  const providerStatusTone = providerBadgeTone(providerHealth);
  const riveEnabled = !!prefs.ai.homieRiveEnabled;
  const riveSrc = (prefs.ai.homieRiveSrc || "/rive/homie.riv").trim() || "/rive/homie.riv";
  const riveArtboard = (prefs.ai.homieRiveArtboard || "Homie").trim() || "Homie";
  const riveStateMachine = (prefs.ai.homieRiveStateMachine || "State Machine 1").trim() || "State Machine 1";
  const rivePointerTracking = prefs.ai.homieRivePointerTracking !== false;
  const avatarShellMode = (((prefs.ai as any).homieAvatarShellMode || "hybrid-hero") as "house-2d" | "actor-3d" | "hybrid-hero");
  const homie3DModelUrl = ((((prefs.ai as any).homie3DModelUrl || "/models/lilhomie.glb") as string).trim() || "/models/lilhomie.glb");

  const lilFallbackBody = (
    <>
      <span className="homieHair" />
      <span className="homieHood" />
      <span className="homieLilHead">
        <span className="homieEye left" />
        <span className="homieEye right" />
        <span className="homieBrow left" />
        <span className="homieBrow right" />
        <span className="homieMouth" />
        <span className="homieBlush left" />
        <span className="homieBlush right" />
      </span>
      <span className="homieLilNeck" />
      <span className="homieLilTorso">
        <span className="homieDrawstring left" />
        <span className="homieDrawstring right" />
        <span className="homieLilPocket" />
      </span>
      <span className="homieLilArm left"><span className="homieLilHand" /></span>
      <span className="homieLilArm right"><span className="homieLilHand" /></span>
      <span className="homieLilLeg left"><span className="homieLilShoe" /></span>
      <span className="homieLilLeg right"><span className="homieLilShoe" /></span>
    </>
  );

  const orbFallbackFace = (
    <span className="homieOrbFace">
      <span className="homieOrbBrow left" />
      <span className="homieOrbBrow right" />
      <span className="homieEye left" />
      <span className="homieEye right" />
      <span className="homieMouth" />
      <span className="homieOrbCheek left" />
      <span className="homieOrbCheek right" />
    </span>
  );

  const memojiFx = memojiEmote === "fistbump" ? "👊" : memojiEmote === "celebrate" ? "🎉" : memojiEmote === "alert" ? "⚠️" : memojiEmote === "facepalm" ? "🤦" : "";
  const memojiHopPx = `${(2 + memojiEnergy * 6).toFixed(1)}px`;
  const memojiWiggleDeg = 1.2 + memojiEnergy * 1.4;
  const memojiOuterStyle: React.CSSProperties = memojiAnimEnabled
    ? ({
        ["--homie-look-x" as any]: `${memojiLook.x.toFixed(1)}px`,
        ["--homie-look-y" as any]: `${memojiLook.y.toFixed(1)}px`,
        ["--homie-hop" as any]: memojiHopPx,
        ["--homie-wiggle-a" as any]: `${(-memojiWiggleDeg).toFixed(2)}deg`,
        ["--homie-wiggle-b" as any]: `${(memojiWiggleDeg).toFixed(2)}deg`,
      } as any)
    : ({} as any);
  const memojiScale = Math.min(1.12, (isListening ? 1.04 : 1) * (isSpeaking ? (1 + talkLevel * 0.09) : 1));

  const memojiFallbackFace = (
    <span className="homieMemojiWrap">
      <span
        className={`homieMemojiOuter ${memojiAnimEnabled ? "anim hype" : ""} ${memojiEmote !== "none" ? `emote-${memojiEmote}` : ""}`.trim()}
        style={memojiOuterStyle}
      >
        <span className="homieMemojiInner" style={{ transform: `scale(${memojiScale.toFixed(3)})` }}>
          <img src={homieMascot} alt="Homie" className="homieMemojiImg" draggable={false} />
          {!!memojiFx && <span className="homieMemojiFx" aria-hidden="true">{memojiFx}</span>}
        </span>
      </span>
    </span>
  );

  const avatarContents = skin === "lil-homie" ? (
    <span className="homieLilBody">
      <RiveHomie
        enabled={riveEnabled}
        src={riveSrc}
        artboard={riveArtboard}
        stateMachine={riveStateMachine}
        pointerTracking={rivePointerTracking}
        mood={mood}
        isSpeaking={isSpeaking}
        isListening={isListening}
        gesture={gesture}
        reduceMotion={reduceMotion}
        fallback={lilFallbackBody}
      />
      <span className="homieOrbLabel">Homie</span>
    </span>
  ) : (
    <span className="homieOrbCore">
      <RiveHomie
        enabled={riveEnabled}
        src={riveSrc}
        artboard={riveArtboard}
        stateMachine={riveStateMachine}
        pointerTracking={rivePointerTracking}
        mood={mood}
        isSpeaking={isSpeaking}
        isListening={isListening}
        gesture={gesture}
        reduceMotion={reduceMotion}
        fallback={skin === "memoji" ? memojiFallbackFace : orbFallbackFace}
      />
      <span className="homieOrbLabel">Homie</span>
    </span>
  );


  const panel = (
    <div className={`homieBuddyPanel card softCard ${mode === "standalone" ? "standalone" : ""}`}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <img src={fairlyOddLogo} alt="FairlyOdd" style={{ width: 34, height: 34, objectFit: "contain", borderRadius: 10, boxShadow: "0 0 18px rgba(94,234,242,0.18)" }} />
          <div>
            <div className="assistantTitle">Homie Buddy</div>
            <div className="small">Watching {activeTitle}</div>
            <div className="small homieCompanionMiniLine">Grounded companion • sorts thoughts • tiny-step coaching</div>
          </div>
        </div>
        {mode === "floating" ? <button className="tabBtn" onClick={() => setOpen(false)}>{((prefs.ai as any).homieAlwaysReady !== false) ? "Minimize" : "Hide"}</button> : <span className="badge good">Companion</span>}
      </div>
      <>
      {mode === "standalone" && (
        avatarShellMode === "actor-3d" || avatarShellMode === "hybrid-hero" ? (
          <Homie3DActorShell
            mood={mood}
            isListening={isListening}
            isSpeaking={isSpeaking}
            isThinking={companionBusy}
            presenceState={presenceState}
            activeTitle={activeTitle}
            panelLabel={panelCompanion.current?.mood || homieSnapshot.companionMode}
            companionBrief={panelCompanion.current?.context || homieSnapshot.companionBrief}
            currentNeed={panelCompanion.current?.lastNeed || companionMemory.lastUserNeed || companionMemory.currentFocus || "Stay steady and keep moving."}
            latestMilestone={laneMemory.milestones?.[0]?.text}
            conversationArc={detachedSnapshot.conversationArc}
            sharedRoutine={detachedSnapshot.sharedRoutine}
            modelUrl={homie3DModelUrl}
            renderMode={avatarShellMode === "actor-3d" ? "3d" : "hybrid"}
          />
        ) : (
          <div className="card homieAvatarStageCard">
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div className="assistantSectionTitle">Avatar stage</div>
                <div className="small" style={{ marginTop: 6 }}>Detached by default, animated like a game buddy, and tuned to the mood of <b>{activeTitle}</b>.</div>
              </div>
              <div className="assistantChipWrap">
                <span className={`badge ${mood === "warn" ? "warn" : "good"}`}>{panelCompanion.current?.mood || homieSnapshot.companionMode}</span>
                <span className="badge">{isListening ? "Listening" : isSpeaking ? "Talking" : "Idle"}</span>
                <span className="badge">{skin === "lil-homie" ? "Avatar body" : "Orb avatar"}</span>
              </div>
            </div>
            <div className="homieAvatarStageWrap">
              <div className={`homieAvatarStage ${mood}`}>
                <div className="homieAvatarStageGlow" />
                <div className="homieAvatarStagePedestal" />
                <div className={`homieAvatarStageOrb homieOrb ${avatarState}`}>
                  {avatarContents}
                </div>
              </div>
              <div className="homieAvatarStageMeta">
                <div className="small shellEyebrow">Panel memory</div>
                <div style={{ fontWeight: 800, marginTop: 4 }}>{panelCompanion.current?.panelTitle || activeTitle}</div>
                <div className="small" style={{ marginTop: 6 }}>{panelCompanion.current?.context || homieSnapshot.companionBrief}</div>
                <div className="small" style={{ marginTop: 6 }}>
                  Need: <b>{panelCompanion.current?.lastNeed || companionMemory.lastUserNeed || companionMemory.currentFocus || "Stay steady and keep moving."}</b>
                </div>
                <div className="small homieDetachedStableLine" style={{ marginTop: 6 }}>{detachedSnapshot.conversationArc}</div>
                <div className="small homieDetachedStableLine" style={{ marginTop: 6 }}>{detachedSnapshot.sharedRoutine}</div>
                {!!laneMemory.milestones?.[0] && <div className="small" style={{ marginTop: 6 }}>Latest milestone: {laneMemory.milestones[0].text}</div>}
                <div className="assistantChipWrap" style={{ marginTop: 10 }}>
                  <button className="tabBtn" onClick={pinCurrentFocus}>Pin current focus</button>
                  <button className="tabBtn" onClick={() => markMilestone(`${activeTitle} check-in completed`)}>Mark milestone</button>
                  <button className="tabBtn" onClick={() => void sendRealCompanion(`Stay present with me in ${activeTitle}. Keep it calm and real.`)}>Stay present</button>
                </div>
              </div>
            </div>
          </div>
        )
      )}
      <div className="card homieReadyChatCard homieCompanionCard">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div>
            <div className="assistantSectionTitle">Real companion lane</div>
            <div className="small" style={{ marginTop: 6 }}>Homie now talks through the local AI runtime in desktop mode, with panel context, recovery context, and relationship memory folded in.</div>
          </div>
          <div className="assistantChipWrap homieCompanionChipRow">
            <span className={`badge ${desktop ? "good" : "warn"}`}>{desktop ? `${companionProviderLabel} • ${companionModel}` : "Desktop AI required"}</span>
            <span className={`badge ${detachedSnapshot.providerTone}`}>{detachedSnapshot.providerBadge}</span>
            <span className={`badge ${((companionBusy || providerHealth.status === "offline" || presenceState === "warming" || diagnostics.externalBridgeState === "transcribing") ? "warn" : "good")}`}>{detachedSnapshot.stageLabel}</span>
            <span className="badge">{homieSettings.voiceMode === "companion" ? "Voice → companion" : homieSettings.voiceMode === "commands" ? "Voice → commands" : "Voice → smart"}</span>
            <button className="tabBtn" onClick={() => { clearCompanionMessages(); clearCompanionMemoryState(); setCompanionMessages([]); setCompanionMemory(loadCompanionMemoryState()); announce("Cleared Homie companion chat.", "idle", true); }}>Clear</button>
            <button className="tabBtn" onClick={() => openFullHomie(chatDraft)}>{desktop ? "Open full Homie" : "Open Homie"}</button>
          </div>
        </div>
        <div className="small homieCompanionMiniLine" style={{ marginBottom: 8 }}>
          Focus: <b>{companionMemory.lastUserNeed || companionMemory.currentFocus || "Stay steady and keep moving."}</b>
          {companionMemory.rememberedFacts?.[0] ? ` • Remembers: ${companionMemory.rememberedFacts[0]}` : ""}
        </div>
        <div className="small homieCompanionMiniLine homieDetachedStableLine" style={{ marginBottom: 8 }}>{detachedSnapshot.conversationArc}</div>
        <div className="small homieCompanionMiniLine homieDetachedStableLine" style={{ marginBottom: 8 }}>{detachedSnapshot.sharedRoutine}</div>
        <div className="small homieCompanionMiniLine homieDetachedProviderLine" style={{ marginBottom: 8 }}>
          Provider: <b>{detachedSnapshot.providerDetail}</b>
        </div>
        {!!laneMemory.pinnedFacts?.length && (
          <div className="assistantChipWrap" style={{ marginBottom: 8 }}>
            {laneMemory.pinnedFacts.slice(0, 3).map((fact) => (
              <span key={fact.id} className="badge">📌 {fact.text}</span>
            ))}
          </div>
        )}
        <div className="assistantChipWrap homieVoiceQuickRow" style={{ marginBottom: 10 }}>
          <button
            className={`tabBtn ${isListening ? "active" : ""}`.trim()}
            onClick={() => {
              if (isListening) {
                stopVoice();
                return;
              }
              if (!voiceEnabled) {
                setVoiceEnabled(true);
                updateHomieRoom({ homieVoiceEnabled: true } as any);
              }
              void startVoice(false);
            }}
          >
            {isListening ? (activeVoicePathRef.current === "external" ? "Finish clip" : "Stop listening") : "Start talking"}
          </button>
          <button className={`tabBtn ${continuousVoice ? "active" : ""}`.trim()} onClick={() => setContinuousVoice((prev) => !prev)}>{continuousVoice ? "Back-and-forth on" : "Back-and-forth off"}</button>
          <button className={`tabBtn ${homieSettings.voiceMode === "companion" ? "active" : ""}`.trim()} onClick={() => patchCompanionSettings({ voiceMode: homieSettings.voiceMode === "companion" ? "smart" : "companion" })}>{homieSettings.voiceMode === "companion" ? "Voice to Homie" : "Route voice to Homie"}</button>
          <button className={`tabBtn ${homieSettings.autoSpeakReplies ? "active" : ""}`.trim()} onClick={() => patchCompanionSettings({ autoSpeakReplies: !homieSettings.autoSpeakReplies })}>{homieSettings.autoSpeakReplies ? "Replies speak" : "Replies silent"}</button>
          <button className={`tabBtn ${homieSettings.chatCleanMode ? "active" : ""}`.trim()} onClick={() => patchCompanionSettings({ chatCleanMode: !homieSettings.chatCleanMode })}>{homieSettings.chatCleanMode ? "Chat clean on" : "Chat clean off"}</button>
          <button className="tabBtn" onClick={() => void refreshProviderHealth(false)}>{providerHealth.status === "checking" ? "Checking provider" : "Check provider"}</button>
          <button className="tabBtn" onClick={() => void runTypedReplySmokeTest()}>Typed smoke test</button>
        </div>
        {isStandalone && (
          <div className="small" style={{ marginBottom: 8, opacity: 0.88 }}>
            Prompt mode: <b>{describePromptMode(homieSettings.contextMode, homieSettings.chatCleanMode)}</b>.
            {homieSettings.voiceMode !== "companion" ? <> Tip: switch voice to <b>Homie</b> for a more natural back-and-forth loop.</> : null}
          </div>
        )}
        {!!lastCompanionWarning && (
          <div className="small" style={{ marginBottom: 8, padding: 10, borderRadius: 12, border: "1px solid rgba(248,113,113,0.28)", background: "rgba(127,29,29,0.18)" }}>
            Provider help: {String(lastCompanionWarning.content || "").replace(/^⚠️\s*/, "").slice(0, 220)}
          </div>
        )}
        <div className="homieCompanionMsgs" ref={companionScrollRef}>
          {companionMessages.length ? companionMessages.slice(isStandalone ? -4 : -6).map((message) => (
            <div key={message.id} className={`homieCompanionMsg ${message.role}`}>
              <div className="homieCompanionBubble">{message.content}</div>
            </div>
          )) : (
            <div className="small" style={{ opacity: 0.84 }}>
              Start here: ask for a grounded check-in, a tiny next step, a money move, or just say what is heavy right now.
            </div>
          )}
          {companionBusy && (
            <div className="homieCompanionMsg assistant">
              <div className="homieCompanionBubble">Thinking…</div>
            </div>
          )}
        </div>
        <div className="row" style={{ marginTop: 10, gap: 8 }}>
          <input
            value={chatDraft}
            onChange={(event) => setChatDraft(event.target.value)}
            placeholder={`Talk to Homie about ${activeTitle}, money moves, recovery mode, or what is on your mind…`}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void sendRealCompanion(chatDraft);
              }
            }}
          />
          <button className="tabBtn active" onClick={() => void sendRealCompanion(chatDraft)} disabled={!chatDraft.trim() || companionBusy}>{companionBusy ? "Thinking…" : "Talk"}</button>
        </div>
        <div className="assistantChipWrap" style={{ marginTop: 10 }}>
          <button className="tabBtn" onClick={() => void sendRealCompanion(`What should I do next in ${activeTitle}?`)}>What now?</button>
          <button className="tabBtn" onClick={() => void sendRealCompanion("Give me the best legit money move from home right now.")}>Money move</button>
          <button className="tabBtn" onClick={() => void sendRealCompanion("Plan my next 30 minutes around my current energy level.")}>Plan 30m</button>
          <button className="tabBtn" onClick={() => void sendRealCompanion(`Check in with me about ${activeTitle}. Keep it grounded and real.`)}>Check in</button>
          <button className="tabBtn" onClick={() => void sendRealCompanion(`Help me sort my thoughts about ${activeTitle} before I make a move.`)}>Sort thoughts</button>
          <button className="tabBtn" onClick={() => void sendRealCompanion(`Stay with me while I do the next step in ${activeTitle}. Keep me calm and focused.`)}>Stay with me</button>
        </div>
      </div>
      </>

      {isStandalone && (
        <div className={`homieHeroDockBar ${standaloneDrawerOpen ? "drawerOpen" : ""}`.trim()}>
          <div className="assistantChipWrap">
            <button className={`tabBtn ${standaloneSection === "house" ? "active" : ""}`} onClick={() => toggleStandaloneSection("house")}>{standaloneSection === "house" ? "Hide house" : "House"}</button>
            <button className={`tabBtn ${standaloneSection === "tools" ? "active" : ""}`} onClick={() => toggleStandaloneSection("tools")}>{standaloneSection === "tools" ? "Hide tools" : "Tools"}</button>
            <button className="tabBtn" onClick={pinCurrentFocus}>Pin focus</button>
            <button className="tabBtn" onClick={() => void sendRealCompanion(`What should I do next in ${activeTitle}?`)}>Ask next move</button>
            <span className="badge">Hero layout</span>
            <span className="badge">Slide-out drawer</span>
            <span className="badge">Voice-first</span>
          </div>
        </div>
      )}

      {(!isStandalone || standaloneSection === "house") && (
      <div className={`homieStandaloneDrawer ${isStandalone ? "standalone" : "inline"} ${isStandalone && standaloneSection === "house" ? "open" : ""}`.trim()}>
        {isStandalone && (
          <div className="homieStandaloneDrawerHead">
            <div>
              <div className="assistantSectionTitle">House</div>
              <div className="small">Room presets, layout edits, and mood lighting live here now.</div>
            </div>
            <button className="tabBtn" onClick={() => setStandaloneSection("companion")}>Close</button>
          </div>
        )}
      <div className="homieStandaloneDrawerBody">
      <div className={`homieHouseScene ${roomTheme}`}>
        <div className="homieHouseTopbar">
          <span className="badge good">Homie House</span>
          <span className="small homieHouseMoodLabel">{ROOM_LABELS.moodLighting[moodLighting]} glow</span>
        </div>
        <div className="assistantChipWrap homiePresetButtons">
          {(["trading", "grow", "chill", "mission-control", "custom"] as RoomPresetId[]).map((presetId) => (
            <button
              key={presetId}
              className={`tabBtn ${selectedPreset === presetId ? "active" : ""}`}
              onClick={() => {
                if (presetId === "custom") {
                  updateHomieRoom({ homieRoomPreset: "custom" });
                  announce("Custom room mode enabled.", "good");
                  return;
                }
                const config = ROOM_PRESETS[presetId];
                updateHomieRoom({
                  homieRoomPreset: presetId,
                  homieFurnitureTheme: config.furnitureTheme,
                  homieWallItem: config.wallItem,
                  homieDeskItem: config.deskItem,
                  homieMoodLighting: config.moodLighting,
                });
                announce(`${ROOM_PRESETS[presetId].label} room preset loaded.`, "good");
              }}
            >
              {titleCasePreset(presetId)}
            </button>
          ))}
        </div>
        <div className="assistantChipWrap homieLayoutButtons">
          <button className={`tabBtn ${layoutEditMode ? "active" : ""}`} onClick={() => setLayoutEditMode((value) => !value)}>
            {layoutEditMode ? "Layout mode on" : "Edit layout"}
          </button>
          <button className={`tabBtn ${snapEnabled ? "active" : ""}`} onClick={() => updateHomieRoom({ homieLayoutSnap: !snapEnabled } as any)} title="Snap items to a grid while dragging">
            {snapEnabled ? "Snap on" : "Snap off"}
          </button>
          <button className="tabBtn" onClick={() => updateHomieRoom({ homieLayoutGridPx: gridPx === 12 ? 16 : gridPx === 16 ? 24 : 12 } as any)} title="Cycle grid size (fine / normal / coarse)">
            Grid {gridPx}px
          </button>
          <button className="tabBtn" onClick={() => copyLayoutToCustom()}>Copy to Custom</button>
          <button className="tabBtn" onClick={() => resetRoomLayout(roomLayoutSlot)}>Reset layout</button>
          {layoutEditMode && selectedRoomItem && (
            <>
              <span className="badge">Selected: {selectedRoomItem} • {ROOM_ITEM_DEPTH_LABEL[(draftRoomLayout[selectedRoomItem]?.depth ?? 1) as any] || "Mid"}</span>
              <button className="tabBtn" onClick={() => bumpSelectedZ(-1)} title="Send backward">Back</button>
              <button className="tabBtn" onClick={() => bumpSelectedZ(1)} title="Bring forward">Front</button>
              <button className="tabBtn" onClick={() => cycleSelectedDepth(1)} title="Cycle depth layer">Depth</button>
            </>
          )}
          <span className="badge">{titleCasePreset(roomLayoutSlot)} auto-saves</span>
        </div>
        <div className={`homieHouseRoom ${layoutEditMode ? "layoutMode" : ""} ${layoutEditMode && snapEnabled ? "gridOn" : ""}`} ref={roomRef} style={{ ...({ "--grid-size": `${gridPx}px` } as any) }} onPointerDown={() => { if(layoutEditMode) setSelectedRoomItem(null); }}>
          <div className="houseBackdropGrain" />
          <div className="houseAtmosGlow" />
          <div className="houseCeilingGlow" />
          <div className="houseWindow"><span className="windowGlow" /></div>
          <div className="houseCurtain left" />
          <div className="houseCurtain right" />
          <div className="houseWallDecor mission">Mission board</div>
          <div className="houseWallDecor screen">Control screen</div>
          <div className="housePoster" />
          <div className="housePictureFrame" />
          <div className="houseShelf">
            <span className="shelfBook one" />
            <span className="shelfBook two" />
            <span className="shelfBook three" />
            <span className="shelfPlant" />
          </div>
          <div className={`houseWallFeature feature-mission-board draggableRoomItem ${layoutEditMode ? "layoutEditable" : ""} ${draggingRoomItem === "wallFeature" ? "dragging" : ""}`} style={getRoomItemStyle("wallFeature")} onPointerDown={(event) => beginRoomDrag("wallFeature", event)}><span className="featurePin one" /><span className="featurePin two" /><span className="featureString" /></div>
          <div className={`houseWallFeature feature-chart-wall draggableRoomItem ${layoutEditMode ? "layoutEditable" : ""} ${draggingRoomItem === "wallFeature" ? "dragging" : ""}`} style={getRoomItemStyle("wallFeature")} onPointerDown={(event) => beginRoomDrag("wallFeature", event)}><span className="featureScreen one" /><span className="featureScreen two" /></div>
          <div className={`houseWallFeature feature-grow-calendar draggableRoomItem ${layoutEditMode ? "layoutEditable" : ""} ${draggingRoomItem === "wallFeature" ? "dragging" : ""}`} style={getRoomItemStyle("wallFeature")} onPointerDown={(event) => beginRoomDrag("wallFeature", event)}><span className="featureSheet one" /><span className="featureSheet two" /></div>
          <div className={`houseWallFeature feature-family-wall draggableRoomItem ${layoutEditMode ? "layoutEditable" : ""} ${draggingRoomItem === "wallFeature" ? "dragging" : ""}`} style={getRoomItemStyle("wallFeature")} onPointerDown={(event) => beginRoomDrag("wallFeature", event)}><span className="featureFrame one" /><span className="featureFrame two" /><span className="featureFrame three" /></div>
          <div className={`houseMonitor draggableRoomItem ${layoutEditMode ? "layoutEditable" : ""} ${draggingRoomItem === "monitor" ? "dragging" : ""}`} style={getRoomItemStyle("monitor")} onPointerDown={(event) => beginRoomDrag("monitor", event)}><span className="monitorGraph" /></div>
          <div className={`houseLamp draggableRoomItem ${layoutEditMode ? "layoutEditable" : ""} ${draggingRoomItem === "lamp" ? "dragging" : ""}`} style={getRoomItemStyle("lamp")} onPointerDown={(event) => beginRoomDrag("lamp", event)} />
          <div className={`houseSideTable draggableRoomItem ${layoutEditMode ? "layoutEditable" : ""} ${draggingRoomItem === "sideTable" ? "dragging" : ""}`} style={getRoomItemStyle("sideTable")} onPointerDown={(event) => beginRoomDrag("sideTable", event)}><span className="sideTableCup" /></div>
          <div className={`housePlant draggableRoomItem ${layoutEditMode ? "layoutEditable" : ""} ${draggingRoomItem === "plant" ? "dragging" : ""}`} style={getRoomItemStyle("plant")} onPointerDown={(event) => beginRoomDrag("plant", event)} />
          <div className="houseCouch" />
          <div className="houseDesk" />
          <div className="houseDeskChair" />
          <div className={`houseDeskSurface houseDeskSurface-terminal-stack draggableRoomItem ${layoutEditMode ? "layoutEditable" : ""} ${draggingRoomItem === "deskFeature" ? "dragging" : ""}`} style={getRoomItemStyle("deskFeature")} onPointerDown={(event) => beginRoomDrag("deskFeature", event)}><span className="deskTerminal one" /><span className="deskTerminal two" /><span className="deskCable" /></div>
          <div className={`houseDeskSurface houseDeskSurface-trading-rig draggableRoomItem ${layoutEditMode ? "layoutEditable" : ""} ${draggingRoomItem === "deskFeature" ? "dragging" : ""}`} style={getRoomItemStyle("deskFeature")} onPointerDown={(event) => beginRoomDrag("deskFeature", event)}><span className="deskMonitor left" /><span className="deskMonitor center" /><span className="deskMonitor right" /></div>
          <div className={`houseDeskSurface houseDeskSurface-grow-sensor draggableRoomItem ${layoutEditMode ? "layoutEditable" : ""} ${draggingRoomItem === "deskFeature" ? "dragging" : ""}`} style={getRoomItemStyle("deskFeature")} onPointerDown={(event) => beginRoomDrag("deskFeature", event)}><span className="deskProbe" /><span className="deskGauge" /><span className="deskLeaf" /></div>
          <div className={`houseDeskSurface houseDeskSurface-tea-notes draggableRoomItem ${layoutEditMode ? "layoutEditable" : ""} ${draggingRoomItem === "deskFeature" ? "dragging" : ""}`} style={getRoomItemStyle("deskFeature")} onPointerDown={(event) => beginRoomDrag("deskFeature", event)}><span className="deskNotebook" /><span className="deskTea" /><span className="deskSteam" /></div>
          <div className={`houseBuddySpot ${skin === "lil-homie" ? "buddy-large" : ""} draggableRoomItem ${layoutEditMode ? "layoutEditable" : ""} ${draggingRoomItem === "buddy" ? "dragging" : ""}`} style={getRoomItemStyle("buddy", "translateX(-50%)")} onPointerDown={(event) => beginRoomDrag("buddy", event)}>
            <span className={`homieOrb houseAvatar ${avatarState}`} title="Homie House avatar">
              {avatarContents}
              <span className="homieOrbRing ringOne" />
              <span className="homieOrbRing ringTwo" />
            </span>
          </div>
          <div className="houseShadow" style={{ ...getRoomItemStyle("buddy", "translateX(-50%)"), pointerEvents: "none" }} />
          <div className="houseRug" />
          <div className="houseFloorGlow" />
        </div>
        <div className="homieHouseFooter">
          <span className={`badge ${bridgeTone}`}>{bridgeChipLabel}</span>
          <span className="small homieHouseSummary">{houseSummary}</span>
          <span className="small homieHouseLayoutHint">{layoutHint}</span>
        </div>
      </div>
      </div>
      </div>
      )}
      {(!isStandalone || standaloneSection === "tools") && (
      <div className={`homieStandaloneDrawer ${isStandalone ? "standalone" : "inline"} ${isStandalone && standaloneSection === "tools" ? "open" : ""}`.trim()}>
      {isStandalone && (
        <div className="homieStandaloneDrawerHead">
          <div>
            <div className="assistantSectionTitle">{standaloneToolsDoctorOpen ? "Hear-You Doctor" : "Tools"}</div>
            <div className="small">{standaloneToolsDoctorOpen ? "Diagnostics, transcript/reply previews, and provider truth stay locked in this drawer." : "Voice, diagnostics, quick actions, and mission steering slide out here."}</div>
          </div>
          <div className="assistantChipWrap homieDrawerHeadControls">
            {standaloneToolsDoctorOpen && <button className="tabBtn" onClick={() => setToolsDrawerView("main")}>Back</button>}
            <button className="tabBtn" onClick={() => setStandaloneSection("companion")}>Close</button>
          </div>
        </div>
      )}
      <div className="homieStandaloneDrawerBody">
      <>
      {(!isStandalone || toolsDrawerView === "main") && (
        <>
          <div className="small homieStatusLine">{status}</div>
          <div className="assistantChipWrap homieStandaloneQuickRow" style={{ marginTop: 10 }}>
            <span className={`badge ${hearYouDoctor.ready ? "good" : "warn"}`}>{conversationStageLabel}</span>
            <span className={`badge ${diagnostics.recognitionAvailable ? "good" : "warn"}`}>{diagnostics.recognitionAvailable ? diagnostics.recognitionName : "SpeechRecognition unavailable"}</span>
            <span className={`badge ${diagnostics.permissionState === "granted" ? "good" : diagnostics.permissionState === "denied" ? "warn" : ""}`}>Mic {diagnostics.permissionState}</span>
            <span className={`badge ${voiceEngineMode === "cloud" ? "good" : voiceEngineMode === "hybrid" ? "warn" : "good"}`}>{voiceEngineMode === "cloud" ? "Cloud voice + push-to-talk" : voiceEngineMode === "hybrid" ? "Hybrid voice mode" : "External/local voice mode"}</span>
            <button className={`tabBtn ${voiceEnabled ? "active" : ""}`} onClick={() => { const next = !voiceEnabled; setVoiceEnabled(next); announce(next ? "Voice enabled." : "Voice muted.", next ? "good" : "idle", true); }}>{voiceEnabled ? "Voice on" : "Voice off"}</button>
            <button className={`tabBtn ${prefs.ai.homieRiveEnabled ? "active" : ""}`} onClick={() => { const next = !prefs.ai.homieRiveEnabled; updateHomieRoom({ homieRiveEnabled: next }); announce(next ? `Game buddy (Rive) enabled. Place a .riv at ${riveSrc} or set a URL in Preferences.` : "Game buddy disabled.", next ? "good" : "idle", true); }}>{prefs.ai.homieRiveEnabled ? "Game buddy: on" : "Game buddy: off"}</button>
            <button className="tabBtn" onClick={() => speak(status, true)}>Speak status</button>
            <button className={`tabBtn ${continuousVoice ? "active" : ""}`} onClick={() => setContinuousVoice((prev) => { const next = !prev; announce(next ? "Continuous back-and-forth voice is on." : "Continuous back-and-forth voice is off.", next ? "good" : "idle", true); return next; })}>{continuousVoice ? "Loop on" : "Loop off"}</button>
            <button className={`tabBtn ${voiceEngineMode === "external-http" ? "active" : ""}`.trim()} onClick={() => setVoiceEngineMode("external-http")}>Use local bridge</button>
            <button className={`tabBtn ${voiceEngineMode === "hybrid" ? "active" : ""}`.trim()} onClick={() => setVoiceEngineMode("hybrid")}>Use hybrid voice</button>
            <button className={`tabBtn ${voiceEngineMode === "cloud" ? "active" : ""}`.trim()} onClick={() => setVoiceEngineMode("cloud")}>Use cloud voice</button>
            <button className="tabBtn" onClick={() => { const snap = buildHomieCoreSnapshot(activePanelId); announce(`${snap.operatorHeadline} ${snap.briefing}`, "good", true); }}>Read screen</button>
            <button className="tabBtn" onClick={() => { if (isListening && activeVoicePathRef.current === "external") stopVoice(); else void startVoice(false); }}>{isListening && activeVoicePathRef.current === "external" ? "Finish external clip" : "Voice command"}</button>
            <button
              className={`tabBtn ${isHoldingToTalk ? "active" : ""}`}
              onMouseDown={(event) => { event.preventDefault(); void startVoice(true); }}
              onMouseUp={() => stopVoice()}
              onMouseLeave={() => { if (isHoldingToTalk) stopVoice(true); }}
              onTouchStart={(event) => { event.preventDefault(); void startVoice(true); }}
              onTouchEnd={() => stopVoice()}
              title="Hold to talk"
            >
              {isHoldingToTalk ? "Release to stop" : "Hold to talk"}
            </button>
            <button
              className={`tabBtn ${(isStandalone ? standaloneToolsDoctorOpen : showDiagnostics) ? "active" : ""}`.trim()}
              onClick={() => {
                if (isStandalone) {
                  setToolsDrawerView("doctor");
                  return;
                }
                setShowDiagnostics((v) => !v);
              }}
            >
              {isStandalone ? (standaloneToolsDoctorOpen ? "Doctor open" : "Voice diagnostics") : showDiagnostics ? "Hide diagnostics" : "Voice diagnostics"}
            </button>
          </div>

          {isStandalone && (
            <div className="card homieDrawerLockCard" style={{ marginTop: 12 }}>
              <div className="assistantSectionTitle">Locked detached drawer</div>
              <div className="small" style={{ marginTop: 8 }}>Diagnostics, provider truth, transcript preview, and reply preview stay inside this slide-over lane now so the main detached shell stops reflowing.</div>
              <div className="assistantChipWrap homieStandaloneQuickRow" style={{ marginTop: 10 }}>
                <span className={`badge ${hearYouDoctor.tone}`}>{hearYouDoctor.ready ? "Hear-you ready" : "Needs doctor"}</span>
                <span className={`badge ${providerHealth.status === "ready" ? "good" : providerHealth.status === "offline" ? "warn" : ""}`}>{detachedSnapshot.providerBadge}</span>
                <span className="badge">Transcript {detachedSnapshot.transcriptPreview ? "captured" : "waiting"}</span>
                <button className="tabBtn active" onClick={() => setToolsDrawerView("doctor")}>Open Hear-You Doctor</button>
              </div>
            </div>
          )}

          {skin === "memoji" && (
            <>
              <div className="assistantSectionTitle" style={{ marginTop: 14 }}>Hype emotes</div>
              <div className="assistantChipWrap homieStandaloneQuickRow" style={{ marginTop: 10 }}>
                <button className="tabBtn active" onClick={() => triggerMemojiEmote("fistbump")}>👊 Fist bump</button>
                <button className="tabBtn" onClick={() => triggerMemojiEmote("celebrate")}>🎉 Celebrate</button>
                <button className="tabBtn" onClick={() => { setMood("warn"); triggerMemojiEmote("alert"); window.setTimeout(() => setMood("idle"), 1600); }}>⚠️ Alert</button>
                <button className="tabBtn" onClick={() => triggerMemojiEmote("facepalm")}>🤦 Facepalm</button>
              </div>
            </>
          )}
        </>
      )}

      {(!isStandalone ? showDiagnostics : standaloneToolsDoctorOpen) && (
        <div className="card homieDoctorCard" style={{ marginTop: 12, background: "rgba(18,24,30,0.85)" }}>
          <div className="assistantSectionTitle">Hear-You Doctor lane</div>
          <div className="assistantChipWrap homieDoctorQuickRow" style={{ marginTop: 10 }}>
            <span className={`badge ${hearYouDoctor.tone}`}>{hearYouDoctor.ready ? "Ready to hear you" : "Why Homie can't hear you"}</span>
            <span className={`badge ${diagnostics.recognitionAvailable ? "good" : "warn"}`}>{diagnostics.recognitionAvailable ? "Recognition ready" : "Recognition missing"}</span>
            <span className={`badge ${diagnostics.phrasesSupported ? "good" : "warn"}`}>{diagnostics.phrasesSupported ? "Phrase boost on" : diagnostics.phraseBiasMode === "optional" ? "Phrase boost optional" : "Phrase boost unavailable"}</span>
            <span className={`badge ${diagnostics.microphoneApiAvailable ? "good" : "warn"}`}>{diagnostics.microphoneApiAvailable ? "Mic API ready" : "Mic API missing"}</span>
            <span className={`badge ${diagnostics.externalBridgeState === "ready" ? "good" : diagnostics.externalBridgeState === "recording" || diagnostics.externalBridgeState === "transcribing" ? "good" : diagnostics.externalBridgeState === "disabled" ? "" : "warn"}`}>External bridge {diagnostics.externalBridgeState}</span>
            <span className={`badge ${diagnostics.micTest === "pass" ? "good" : diagnostics.micTest === "fail" ? "warn" : ""}`}>Mic test: {diagnostics.micTest}</span>
            <span className="badge">{conversationStageLabel}</span>
          </div>
          <div className="assistantStack" style={{ marginTop: 10, gap: 10 }}>
            <div className="small"><b>{hearYouDoctor.headline}</b></div>
            <div className="small">{hearYouDoctor.detail}</div>
            <div className="small">Next: <b>{hearYouDoctor.nextStep}</b></div>
            <div className="small">Selected input: <b>{diagnostics.selectedAudioInputLabel || "Waiting for a mic capture to reveal the device label"}</b></div>
            <div className="small">Voice lane trace: browser STT <b>{browserSttTrace}</b> • recording <b>{recordingTrace}</b> • handoff <b>{voiceLaneTrace.handoff || "idle"}</b> • reply <b>{voiceLaneTrace.reply || "idle"}</b></div>
            <div className="small">Transcript-to-reply trace: heard <b>{voiceLaneTrace.heardText || detachedSnapshot.transcriptPreview || "—"}</b> • prompt <b>{voiceLaneTrace.promptMode || describePromptMode(homieSettings.contextMode, homieSettings.chatCleanMode)}</b> • provider <b>{voiceLaneTrace.providerUsed || lastReplyProvider || providerHealth.activeProviderLabel}</b></div>
            <div className="small">Final prompt recipe: direct request <b>{voiceLaneTrace.directRequest || "—"}</b> • support mode <b>{voiceLaneTrace.supportMode || "—"}</b> • context included <b>{voiceLaneTrace.contextIncluded || "—"}</b></div>
            <div className="small homieDetachedStableLine">Last transcript preview: <b>{detachedSnapshot.transcriptPreview || "—"}</b>{detachedSnapshot.heardAt ? <> • <b>{relativeTimeLabel(detachedSnapshot.heardAt)}</b></> : null}</div>
            <div className="small homieDetachedProviderLine">Last reply preview: <b>{detachedSnapshot.replyPreview || "—"}</b>{lastReplyProvider ? <> • via <b>{lastReplyProvider}</b></> : null}{detachedSnapshot.replyAt ? <> • <b>{relativeTimeLabel(detachedSnapshot.replyAt)}</b></> : null}</div>
            <div className="small homieDetachedStableLine">Conversation arc memory: <b>{detachedSnapshot.conversationArc}</b></div>
            <div className="small homieDetachedStableLine">Shared routine memory: <b>{detachedSnapshot.sharedRoutine}</b></div>
            <div className="small homieDetachedProviderLine">Provider status: <b>{detachedSnapshot.providerDetail}</b></div>
            <div className="small homieDetachedDebugStamp">Detached shell stamp: turn <b>#{detachedSnapshot.turnId}</b> • provider <b>#{detachedSnapshot.providerCheckId}</b> • transcript <b>#{detachedSnapshot.transcriptId}</b> • memory <b>#{detachedSnapshot.memoryRefreshId}</b></div>
            <div style={{ marginTop: 2 }}>
              <div className="small" style={{ marginBottom: 6 }}>Live mic level meter</div>
              <div style={{ height: 12, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ width: `${Math.max(4, Math.round(micLevel * 100))}%`, height: "100%", borderRadius: 999, background: micLevel > 0.55 ? "rgba(110,255,180,0.95)" : "rgba(110,190,255,0.9)", transition: "width 80ms linear" }} />
              </div>
            </div>
            <div className="small">Speech engine: <b>{diagnostics.recognitionName}</b></div>
            <div className="small">Microphone permission: <b>{diagnostics.permissionState}</b></div>
            <div className="small">Secure context: <b>{diagnostics.secureContext ? "yes" : "no"}</b></div>
            <div className="small">Phrase boost mode: <b>{diagnostics.phraseBiasMode}</b></div>
            <div className="small">Active recognition mode: <b>{diagnostics.activeRecognitionMode}</b></div>
            <div className="small">Browser on-device voice: <b>{diagnostics.localAvailability}</b> — {diagnostics.localMessage}</div>
            <div className="small">External/local bridge: <b>{diagnostics.externalBridgeState}</b> — {diagnostics.externalBridgeMessage}</div>
            <div className="small">Voice engine mode: <b>{voiceEngineMode}</b>{voiceEngineMode === "cloud" ? <> — Local bridge is available but idle until you switch modes.</> : voiceEngineMode === "hybrid" ? <> — Homie will prefer the local bridge when it is ready.</> : <> — Homie should route voice through the local bridge.</>}</div>
            <div className="small">External bridge URL: <b>{diagnostics.externalBridgeBaseUrl || "—"}</b>{diagnostics.externalBridgeModel ? <> • Model: <b>{diagnostics.externalBridgeModel}</b></> : null}</div>
            <div className="small">Last voice failure: <b>{diagnostics.lastErrorMessage || "none"}</b></div>
          </div>
          <div className="assistantChipWrap homieDoctorQuickRow" style={{ marginTop: 10 }}>
            <button className="tabBtn active" onClick={() => void runVoicePathCheck()}>Voice path check</button>
            <button className="tabBtn" onClick={() => void runMicTest()}>Run mic test</button>
            <button className="tabBtn" onClick={() => void refreshVoiceDiagnostics()}>Refresh diagnostics</button>
            <button className="tabBtn" onClick={() => void refreshProviderHealth(false)}>{providerHealth.status === "checking" ? "Checking provider" : "Check provider"}</button>
            <button className="tabBtn" onClick={() => void runTypedReplySmokeTest()}>Typed smoke test</button>
            <button className={`tabBtn ${homieSettings.chatCleanMode ? "active" : ""}`.trim()} onClick={() => patchCompanionSettings({ chatCleanMode: !homieSettings.chatCleanMode })}>{homieSettings.chatCleanMode ? "Chat clean on" : "Chat clean off"}</button>
            <button className="tabBtn" onClick={() => void probeExternalVoice(false)}>Probe external bridge</button>
            <button className={`tabBtn ${voiceEngineMode === "external-http" ? "active" : ""}`.trim()} onClick={() => setVoiceEngineMode("external-http")}>Use local bridge</button>
            <button className={`tabBtn ${voiceEngineMode === "hybrid" ? "active" : ""}`.trim()} onClick={() => setVoiceEngineMode("hybrid")}>Use hybrid</button>
            <button className={`tabBtn ${voiceEngineMode === "cloud" ? "active" : ""}`.trim()} onClick={() => setVoiceEngineMode("cloud")}>Use cloud</button>
            <button className="tabBtn" onClick={() => void forceVoicePathTest("cloud")}>{isListening && activeVoicePathRef.current === "cloud" ? "Cloud test live" : "Force cloud test"}</button>
            <button className="tabBtn" onClick={() => void forceVoicePathTest("external")}>{isListening && activeVoicePathRef.current === "external" ? "External test live" : "Force external test"}</button>
            <button className="tabBtn" onClick={() => announce("Browser on-device voice stays disabled here to avoid Electron renderer crashes. External/local HTTP bridge is the safe local path in this build.", "warn", true)}>Why no local voice?</button>
            <button className="tabBtn" onClick={() => announce("If voice fails, I will tell you whether the block was recognition support, microphone access, a cloud network/service issue, or the external/local bridge path.", "good", true)}>What failed?</button>
          </div>
          {!!diagnostics.lastErrorMessage && (
            <div className="small" style={{ marginTop: 10 }}>
              Homie sees the failure at: <b>{diagnostics.lastErrorCode || "unknown"}</b> — {diagnostics.lastErrorMessage}
            </div>
          )}
        </div>
      )}

      {!!upgradeMessages.length && (
        <div className="card" style={{ marginTop: 12, background: "rgba(18,24,30,0.85)" }}>
          <div className="assistantSectionTitle">Upgrade chatter</div>
          <div className="small" style={{ marginTop: 10 }}>{upgradeMessages[0]}</div>
          <div className="assistantChipWrap" style={{ marginTop: 10 }}>
            {upgradePacks.filter((pack) => !pack.installed).slice(0, 2).map((pack) => (
              <button key={pack.id} className="tabBtn active" onClick={() => { installUpgradePack(pack.id); announce(`${pack.name} installed.`, "good"); setTick((v) => v + 1); }}>{pack.installPrompt || `Install ${pack.name}`}</button>
            ))}
            {upgradePacks.filter((pack) => pack.installed && pack.missingPermissions.length).slice(0, 2).map((pack) => (
              <button key={pack.id} className="tabBtn" onClick={() => { grantAllUpgradePackPermissions(pack.id); announce(`${pack.name} permissions granted.`, "good"); setTick((v) => v + 1); }}>{`Grant ${pack.name} permissions`}</button>
            ))}
          </div>
        </div>
      )}

      <div className="assistantChipWrap" style={{ marginTop: 10 }}>
        <button className="tabBtn active" onClick={() => { const digest = buildMorningDigest(); announce("Reading the morning digest.", "good"); speak(digest, true); }}>Read digest</button>
        <button className="tabBtn" onClick={() => run("open mission control")}>Mission Control</button>
        <button className="tabBtn" onClick={() => run("homie")}>Open Homie</button>
        <button className="tabBtn" onClick={() => window.dispatchEvent(new CustomEvent("oddengine:focus-commandbar"))}>Focus command bar</button>
        {mode === "floating" && <button className="tabBtn" onClick={launchCompanion}>Pop out</button>}
      </div>
      <div className="assistantSectionTitle" style={{ marginTop: 14 }}>Quick steering</div>
      <div className="assistantChipWrap" style={{ marginTop: 10 }}>
        {COMMAND_SUGGESTIONS.slice(0, 8).map((cmd) => <button key={cmd} className="tabBtn" onClick={() => run(cmd)}>{cmd}</button>)}
      </div>
      <div className="timelineCard" style={{ marginTop: 14 }}>
        <div className="small">Mission pulse</div>
        {buildMissions().slice(0, 3).map((mission) => (
          <div key={`${mission.panelId}-${mission.title}`} className="small" style={{ marginTop: 6 }}>
            • {getPanelMeta(mission.panelId).title}: {mission.title}
          </div>
        ))}
      </div>
      </>
      </div>
      </div>
      )}
    </div>
  );

  return (
    <div className={shellClass}>
      <button className={`homieOrb ${avatarState}`} onClick={() => mode === "standalone" ? announce(pickIdleStatus(activePanelId).text, mood, true) : setOpen((v) => !v)} title="Homie Buddy">
        {avatarContents}
        <span className="homieOrbRing ringOne" />
        <span className="homieOrbRing ringTwo" />
      </button>
      {(open || mode === "standalone") && panel}
    </div>
  );
}
