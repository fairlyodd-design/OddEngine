import { loadJSON, saveJSON } from "./storage";

export type HomieCoreMode = "idle" | "assist" | "talk" | "observe" | "mission";
export type HomieEmotion =
  | "idle"
  | "listening"
  | "speaking"
  | "thinking"
  | "happy"
  | "concerned"
  | "focused";

export type HomieCoreState = {
  mode: HomieCoreMode;
  emotion: HomieEmotion;
  micEnabled: boolean;
  speakerEnabled: boolean;
  cameraEnabled: boolean;
  wakeWordEnabled: boolean;
  wakeWord: string;
  activePanel: string;
  lastHeard: string;
  lastReply: string;
  missionFocus: string;
  nextSuggestedAction: string;
  memoryNotes: string[];
  updatedAt: number;
};

const KEY = "oddengine:homie:realLifeCore:v1";

export const DEFAULT_HOMIE_CORE_STATE: HomieCoreState = {
  mode: "assist",
  emotion: "idle",
  micEnabled: false,
  speakerEnabled: true,
  cameraEnabled: false,
  wakeWordEnabled: false,
  wakeWord: "hey homie",
  activePanel: "Home",
  lastHeard: "",
  lastReply: "",
  missionFocus: "Keep the OS moving with one clean next action.",
  nextSuggestedAction: "Review the current panel and choose the highest-value next step.",
  memoryNotes: ["Homie should feel warm, calm, and family-safe."],
  updatedAt: 0,
};

export function loadHomieCoreState(): HomieCoreState {
  return loadJSON<HomieCoreState>(KEY, DEFAULT_HOMIE_CORE_STATE);
}

export function saveHomieCoreState(state: HomieCoreState) {
  saveJSON(KEY, { ...state, updatedAt: Date.now() });
}

export function updateHomieCoreState(patch: Partial<HomieCoreState>) {
  const current = loadHomieCoreState();
  const next = { ...current, ...patch, updatedAt: Date.now() };
  saveHomieCoreState(next);
  return next;
}

export function buildHomieStatusLine(state: HomieCoreState) {
  const mode = state.mode === "talk" ? "conversation" : state.mode;
  return `Mode: ${mode} • Mic ${state.micEnabled ? "on" : "off"} • Camera ${state.cameraEnabled ? "on" : "off"}`;
}

export function buildHomieQuickActions(state: HomieCoreState) {
  return [
    { id: "next", label: "What’s next?", note: state.nextSuggestedAction },
    { id: "mission", label: "Mission focus", note: state.missionFocus },
    { id: "mic", label: state.micEnabled ? "Mute mic" : "Enable mic", note: "Voice input" },
    { id: "cam", label: state.cameraEnabled ? "Disable camera" : "Enable camera", note: "Vision mode" },
    { id: "wake", label: state.wakeWordEnabled ? "Wake word on" : "Wake word off", note: state.wakeWord },
  ];
}

export function buildHomiePresenceFromCore(state: HomieCoreState): HomieEmotion {
  if (state.mode === "observe" && state.cameraEnabled) return "focused";
  if (state.mode === "talk" && state.micEnabled) return "speaking";
  if (state.micEnabled && !state.lastReply) return "listening";
  if (state.mode === "mission") return "thinking";
  if (state.nextSuggestedAction && state.nextSuggestedAction.toLowerCase().includes("block")) return "concerned";
  return state.emotion || "idle";
}
