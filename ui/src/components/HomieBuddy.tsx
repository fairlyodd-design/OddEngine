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
import { oddApi } from "../lib/odd";
import { updateVoiceEngineSnapshot } from "../lib/voice";
import fairlyOddLogo from "../assets/fairlyodd-logo.png";
import homieMascot from "../assets/homie-mascot.png";
import RiveHomie from "./RiveHomie";

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
  const [open, setOpen] = useState(mode === "standalone");
  const [status, setStatus] = useState("Homie is chilling and ready.");
  const [tick, setTick] = useState(0);
  const [voiceEnabled, setVoiceEnabled] = useState(prefs.ai.homieVoiceEnabled);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isHoldingToTalk, setIsHoldingToTalk] = useState(false);
  const [gesture, setGesture] = useState<HomieGesture>("none");
  const [memojiEmote, setMemojiEmote] = useState<"none" | "fistbump" | "celebrate" | "alert" | "facepalm">("none");
  const [memojiLook, setMemojiLook] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [talkLevel, setTalkLevel] = useState(0);
  const [mood, setMood] = useState<"idle" | "good" | "warn">("idle");
  const [diagnostics, setDiagnostics] = useState<VoiceDiagnostics>(() => createBaseDiagnostics());
  const [showDiagnostics, setShowDiagnostics] = useState(mode === "standalone");
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<any>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaChunksRef = useRef<BlobPart[]>([]);
  const activeVoicePathRef = useRef<"cloud" | "external">("cloud");
  const reduceMotion = useMemo(() => {
    try {
      return !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      return false;
    }
  }, []);

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
      if (action === "probe-external") {
        setOpen(true);
        void probeExternalVoice(false);
        return;
      }
      if (action === "listen") {
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

  useEffect(() => () => stopVoice(true), []);

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
        next.audioInputCount = devices.filter((device) => device.kind === "audioinput").length;
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
      setDiagnostics((prev) => ({ ...prev, externalBridgeState: "ready", externalBridgeMessage: result.detail || `External/local voice bridge ready at ${externalVoiceBaseUrl}.`, externalBridgeModel: result.model || prev.externalBridgeModel, lastTranscript: transcript || prev.lastTranscript, lastErrorCode: "", lastErrorMessage: "", activeRecognitionMode: "idle" }));
      updateVoiceEngineSnapshot({ externalState: "ready", engineMode: voiceEngineMode as any, externalBaseUrl: externalVoiceBaseUrl, externalAvailable: true, externalModel: result.model || "", source, message: result.detail || `External/local voice bridge ready at ${externalVoiceBaseUrl}.`, errorCode: "", listening: false });
      if (!transcript) {
        announce(message, "warn", true);
        return;
      }
      emitVoiceStatus({ source, status: "transcript", message, transcript, mode: "external" });
      announce(message, "good");
      run(transcript);
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
      mediaStreamRef.current = stream;
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
      stream.getTracks().forEach((track) => track.stop());
      const fresh = await refreshVoiceDiagnostics();
      setDiagnostics((prev) => ({ ...prev, ...fresh, micTest: "pass" }));
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

  function speak(text: string, force = false) {
    try {
      if (!force && !voiceEnabled) return;
      const utterance = new SpeechSynthesisUtterance(text.replace(/\*\*/g, ""));
      const voice = pickVoice(voiceProfile);
      if (voice) utterance.voice = voice;
      utterance.rate = 0.97;
      utterance.pitch = skin === "phoenix" ? 1.02 : skin === "terminal" ? 0.82 : 0.92;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    } catch {
      setIsSpeaking(false);
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

  function run(text: string) {
    const result = executeCommand({ text, activePanelId, onNavigate, onOpenHowTo, onStatus: (message) => announce(message, "good") });
    if (result?.message) announce(result.message, result.ok ? "good" : "warn");
  }

  function stopVoice(silent = false, source = "homie") {
    if (activeVoicePathRef.current === "external") {
      try {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") mediaRecorderRef.current.stop();
      } catch {}
      setIsListening(false);
      setIsHoldingToTalk(false);
      emitVoiceStatus({ source, status: "ended", message: "Stopped external/local recording.", mode: "external" });
      if (!silent) announce("Stopped external/local recording.", "idle");
      return;
    }
    try {
      recognitionRef.current?.stop?.();
    } catch {}
    setIsListening(false);
    setIsHoldingToTalk(false);
    emitVoiceStatus({ source, status: "ended", message: "Stopped listening.", mode: "cloud" });
    if (!silent) announce("Stopped listening.", "idle");
  }

  async function startVoice(pushToTalk = false, allowBias = true, _forceLocal = false, _networkRetryUsed = false, source = "homie") {
    const latest = await refreshVoiceDiagnostics();
    const useExternal = wantsExternalVoice() && (voiceEngineMode === "external-http" || (voiceEngineMode === "hybrid" && diagnostics.externalBridgeState === "ready"));
    if (useExternal) {
      activeVoicePathRef.current = "external";
      await startExternalVoice(pushToTalk, source);
      return;
    }
    activeVoicePathRef.current = "cloud";
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
        setIsListening(true);
        setDiagnostics((prev) => ({
          ...prev,
          phrasesSupported: prev.phrasesSupported || biased,
          phraseBiasMode: biased ? "supported" : prev.recognitionAvailable ? "optional" : "unsupported",
          activeRecognitionMode: usingLocal ? "local" : "cloud",
        }));
        const startedMessage = pushToTalk ? "Push-to-talk is live. Hold the button and speak." : "Listening for your command.";
        emitVoiceStatus({ source, status: "started", message: startedMessage, mode: "cloud" });
        announce(startedMessage, "good");
      };
      rec.onresult = (event: any) => {
        const transcript = String(event?.results?.[0]?.[0]?.transcript || "").trim();
        setIsListening(false);
        setIsHoldingToTalk(false);
        setDiagnostics((prev) => ({ ...prev, lastTranscript: transcript || prev.lastTranscript }));
        if (!transcript) {
          announce("Recognition started, but no transcript came back.", "warn", true);
          return;
        }
        emitVoiceStatus({ source, status: "transcript", message: `Heard: ${transcript}`, transcript });
        announce(`Heard: ${transcript}`, "good");
        run(transcript);
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
      width: 420,
      height: 720,
      alwaysOnTop: true,
      frame: false,
      transparent: true,
      skipTaskbar: false,
      resizable: true,
    });
    if (r.ok) announce("Launched the Homie companion window.", "good");
    else announce(r.error || "Could not launch the Homie companion window.", "warn", true);
  }

  const avatarState = `${isListening ? "listening" : ""} ${isSpeaking ? "speaking" : ""} ${mood} skin-${skin} gesture-${gesture}`.trim();
  const shellClass = mode === "standalone" ? "homieCompanion" : `homieBuddy ${open ? "open" : ""}`;
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
  const riveEnabled = !!prefs.ai.homieRiveEnabled;
  const riveSrc = (prefs.ai.homieRiveSrc || "/rive/homie.riv").trim() || "/rive/homie.riv";
  const riveArtboard = (prefs.ai.homieRiveArtboard || "Homie").trim() || "Homie";
  const riveStateMachine = (prefs.ai.homieRiveStateMachine || "State Machine 1").trim() || "State Machine 1";
  const rivePointerTracking = prefs.ai.homieRivePointerTracking !== false;

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
          </div>
        </div>
        {mode === "floating" ? <button className="tabBtn" onClick={() => setOpen(false)}>Hide</button> : <span className="badge good">Companion</span>}
      </div>
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
      <div className="small homieStatusLine">{status}</div>
      <div className="assistantChipWrap" style={{ marginTop: 10 }}>
        <span className={`badge ${isListening ? "warn" : isSpeaking ? "good" : mood === "warn" ? "warn" : "good"}`}>{isListening ? "Listening" : isSpeaking ? "Speaking" : "Ready"}</span>
        <span className={`badge ${diagnostics.recognitionAvailable ? "good" : "warn"}`}>{diagnostics.recognitionAvailable ? diagnostics.recognitionName : "SpeechRecognition unavailable"}</span>
        <span className={`badge ${diagnostics.permissionState === "granted" ? "good" : diagnostics.permissionState === "denied" ? "warn" : ""}`}>Mic {diagnostics.permissionState}</span>
        <span className={`badge ${voiceEngineMode === "cloud" ? "good" : voiceEngineMode === "hybrid" ? "warn" : "good"}`}>{voiceEngineMode === "cloud" ? "Cloud voice + push-to-talk" : voiceEngineMode === "hybrid" ? "Hybrid voice mode" : "External/local voice mode"}</span>
        <button className={`tabBtn ${voiceEnabled ? "active" : ""}`} onClick={() => { const next = !voiceEnabled; setVoiceEnabled(next); announce(next ? "Voice enabled." : "Voice muted.", next ? "good" : "idle", true); }}>{voiceEnabled ? "Voice on" : "Voice off"}</button>
        <button className={`tabBtn ${prefs.ai.homieRiveEnabled ? "active" : ""}`} onClick={() => { const next = !prefs.ai.homieRiveEnabled; updateHomieRoom({ homieRiveEnabled: next }); announce(next ? `Game buddy (Rive) enabled. Place a .riv at ${riveSrc} or set a URL in Preferences.` : "Game buddy disabled.", next ? "good" : "idle", true); }}>{prefs.ai.homieRiveEnabled ? "Game buddy: on" : "Game buddy: off"}</button>
        <button className="tabBtn" onClick={() => speak(status, true)}>Speak status</button>
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
        <button className="tabBtn" onClick={() => setShowDiagnostics((v) => !v)}>{showDiagnostics ? "Hide diagnostics" : "Voice diagnostics"}</button>
      </div>

      {skin === "memoji" && (
        <>
          <div className="assistantSectionTitle" style={{ marginTop: 14 }}>Hype emotes</div>
          <div className="assistantChipWrap" style={{ marginTop: 10 }}>
            <button className="tabBtn active" onClick={() => triggerMemojiEmote("fistbump")}>👊 Fist bump</button>
            <button className="tabBtn" onClick={() => triggerMemojiEmote("celebrate")}>🎉 Celebrate</button>
            <button className="tabBtn" onClick={() => { setMood("warn"); triggerMemojiEmote("alert"); window.setTimeout(() => setMood("idle"), 1600); }}>⚠️ Alert</button>
            <button className="tabBtn" onClick={() => triggerMemojiEmote("facepalm")}>🤦 Facepalm</button>
          </div>
        </>
      )}

      {showDiagnostics && (
        <div className="card" style={{ marginTop: 12, background: "rgba(18,24,30,0.85)" }}>
          <div className="assistantSectionTitle">Mic test / Voice diagnostics</div>
          <div className="assistantChipWrap" style={{ marginTop: 10 }}>
            <span className={`badge ${diagnostics.recognitionAvailable ? "good" : "warn"}`}>{diagnostics.recognitionAvailable ? "Recognition ready" : "Recognition missing"}</span>
            <span className={`badge ${diagnostics.phrasesSupported ? "good" : "warn"}`}>{diagnostics.phrasesSupported ? "Phrase boost on" : diagnostics.phraseBiasMode === "optional" ? "Phrase boost optional" : "Phrase boost unavailable"}</span>
            <span className={`badge ${diagnostics.microphoneApiAvailable ? "good" : "warn"}`}>{diagnostics.microphoneApiAvailable ? "Mic API ready" : "Mic API missing"}</span>
            <span className={`badge ${diagnostics.externalBridgeState === "ready" ? "good" : diagnostics.externalBridgeState === "recording" || diagnostics.externalBridgeState === "transcribing" ? "good" : diagnostics.externalBridgeState === "disabled" ? "" : "warn"}`}>External bridge {diagnostics.externalBridgeState}</span>
            <span className={`badge ${diagnostics.externalBridgeConfigured ? "good" : ""}`}>{diagnostics.externalBridgeConfigured ? "Bridge configured" : "Bridge not configured"}</span>
            <span className={`badge ${diagnostics.micTest === "pass" ? "good" : diagnostics.micTest === "fail" ? "warn" : ""}`}>Mic test: {diagnostics.micTest}</span>
            <span className="badge">Inputs: {diagnostics.audioInputCount}</span>
          </div>
          <div className="assistantStack" style={{ marginTop: 10, gap: 8 }}>
            <div className="small">Speech engine: <b>{diagnostics.recognitionName}</b></div>
            <div className="small">Microphone permission: <b>{diagnostics.permissionState}</b></div>
            <div className="small">Secure context: <b>{diagnostics.secureContext ? "yes" : "no"}</b></div>
            <div className="small">Last transcript: <b>{diagnostics.lastTranscript || "—"}</b></div>
            <div className="small">Phrase boost mode: <b>{diagnostics.phraseBiasMode}</b></div>
            <div className="small">Active recognition mode: <b>{diagnostics.activeRecognitionMode}</b></div>
            <div className="small">Browser on-device voice: <b>{diagnostics.localAvailability}</b> — {diagnostics.localMessage}</div>
            <div className="small">External/local bridge: <b>{diagnostics.externalBridgeState}</b> — {diagnostics.externalBridgeMessage}</div>
            <div className="small">External bridge URL: <b>{diagnostics.externalBridgeBaseUrl || "—"}</b>{diagnostics.externalBridgeModel ? <> • Model: <b>{diagnostics.externalBridgeModel}</b></> : null}</div>
            <div className="small">Last voice failure: <b>{diagnostics.lastErrorMessage || "none"}</b></div>
          </div>
          <div className="assistantChipWrap" style={{ marginTop: 10 }}>
            <button className="tabBtn active" onClick={() => void runMicTest()}>Run mic test</button>
            <button className="tabBtn" onClick={() => void refreshVoiceDiagnostics()}>Refresh diagnostics</button>
            <button className="tabBtn" onClick={() => void probeExternalVoice(false)}>Probe external bridge</button>
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
