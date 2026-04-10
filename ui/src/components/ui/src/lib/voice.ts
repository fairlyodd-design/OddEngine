import { loadJSON, saveJSON } from "./storage";

export const VOICE_ENGINE_STATUS_KEY = "oddengine:voice:engine-status:v1";
export const VOICE_ENGINE_EVENT = "oddengine:voice-engine-changed";

export type VoiceEngineState = "ready" | "listening" | "recording" | "transcribing" | "degraded" | "unavailable" | "disabled" | "configuring";
export type ExternalVoiceState = "disabled" | "ready" | "recording" | "transcribing" | "degraded" | "unavailable" | "configuring";
export type VoiceEngineMode = "cloud" | "external-http" | "hybrid";

export type VoiceEngineSnapshot = {
  updatedAt: number;
  cloudState: VoiceEngineState;
  pushToTalkState: VoiceEngineState;
  typedState: "ready";
  localState: "disabled" | "experimental" | "unavailable";
  externalState: ExternalVoiceState;
  engineMode: VoiceEngineMode;
  externalAvailable: boolean;
  externalBaseUrl: string;
  externalModel: string;
  recognitionAvailable: boolean;
  microphoneApiAvailable: boolean;
  permissionState: "granted" | "prompt" | "denied" | "unknown";
  secureContext: boolean;
  audioInputCount: number;
  listening: boolean;
  source: string;
  message: string;
  errorCode: string;
};

export function createVoiceEngineSnapshot(): VoiceEngineSnapshot {
  return {
    updatedAt: 0,
    cloudState: "unavailable",
    pushToTalkState: "unavailable",
    typedState: "ready",
    localState: "disabled",
    externalState: "disabled",
    engineMode: "cloud",
    externalAvailable: false,
    externalBaseUrl: "http://127.0.0.1:8765",
    externalModel: "",
    recognitionAvailable: false,
    microphoneApiAvailable: false,
    permissionState: "unknown",
    secureContext: false,
    audioInputCount: 0,
    listening: false,
    source: "homie",
    message: "Voice status not initialized yet.",
    errorCode: "",
  };
}

export function loadVoiceEngineSnapshot() {
  return { ...createVoiceEngineSnapshot(), ...(loadJSON<Partial<VoiceEngineSnapshot>>(VOICE_ENGINE_STATUS_KEY, {}) || {}) } as VoiceEngineSnapshot;
}

export function saveVoiceEngineSnapshot(snapshot: VoiceEngineSnapshot) {
  saveJSON(VOICE_ENGINE_STATUS_KEY, snapshot);
  try {
    window.dispatchEvent(new CustomEvent(VOICE_ENGINE_EVENT, { detail: snapshot }));
  } catch {}
  return snapshot;
}

export function updateVoiceEngineSnapshot(patch: Partial<VoiceEngineSnapshot>) {
  const current = loadVoiceEngineSnapshot();
  const next: VoiceEngineSnapshot = {
    ...current,
    ...patch,
    updatedAt: Date.now(),
  };
  return saveVoiceEngineSnapshot(next);
}

export function getVoiceEngineBadges(snapshot: VoiceEngineSnapshot) {
  return [
    { label: `Cloud ${snapshot.cloudState}`, tone: snapshot.cloudState === "ready" || snapshot.cloudState === "listening" ? "good" : snapshot.cloudState === "degraded" ? "warn" : "bad" },
    { label: `External ${snapshot.externalState}`, tone: snapshot.externalState === "ready" || snapshot.externalState === "recording" || snapshot.externalState === "transcribing" ? "good" : snapshot.externalState === "disabled" ? "muted" : snapshot.externalState === "configuring" ? "warn" : snapshot.externalState === "degraded" ? "warn" : "bad" },
    { label: `Push-to-talk ${snapshot.pushToTalkState}`, tone: snapshot.pushToTalkState === "ready" ? "good" : snapshot.pushToTalkState === "degraded" ? "warn" : "bad" },
    { label: "Typed ready", tone: "good" },
  ] as const;
}

export function summarizeVoiceEngine(snapshot: VoiceEngineSnapshot) {
  if (snapshot.externalState === "recording") return "Homie is recording for the external/local voice bridge.";
  if (snapshot.externalState === "transcribing") return snapshot.message || "Homie is waiting for the external/local voice bridge to transcribe the clip.";
  if (snapshot.cloudState === "listening") return "Homie is listening for a command.";
  if (snapshot.engineMode !== "cloud" && snapshot.externalState === "ready") return snapshot.message || `External/local voice bridge is ready at ${snapshot.externalBaseUrl}.`;
  if (snapshot.cloudState === "degraded") return snapshot.message || "Cloud speech is degraded. Push-to-talk and typed commands stay ready.";
  if (snapshot.cloudState === "ready") return snapshot.message || "Cloud speech, push-to-talk, and typed commands are ready.";
  return snapshot.message || "Voice is unavailable right now. Typed commands stay ready.";
}
