import React, { useEffect, useMemo, useRef, useState } from "react";
import { buildMorningDigest, getPanelMeta } from "../lib/brain";
import { executeCommand } from "../lib/commandCenter";
import {
  buildHomieCompanionCheckIn,
  buildHomieCompanionReply,
  buildHomieLegacyArtifactDraft,
  buildHomieLegacyPromptArtifact,
  createHomieMessage,
  exportHomieLegacyArtifactText,
  getHomieCompanionMemorySnapshot,
  getHomieLegacyArtifactSummaries,
  loadHomieCompanionHistory,
  saveHomieCompanionHistory,
  shouldHomieCompanionAnswer,
  type HomieCompanionMessage,
} from "../lib/homieCompanionCoach";
import { loadPrefs, savePrefs } from "../lib/prefs";
import { oddApi } from "../lib/odd";
import { updateVoiceEngineSnapshot } from "../lib/voice";
import fairlyOddLogo from "../assets/fairlyodd-logo.png";
import RiveHomie from "./RiveHomie";
import "./homieRebuild.css";

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
  localAvailability: "unsupported";
  localMessage: string;
  externalBridgeConfigured: boolean;
  externalBridgeBaseUrl: string;
  externalBridgeState: "disabled" | "configuring" | "ready" | "recording" | "transcribing" | "degraded" | "unavailable";
  externalBridgeMessage: string;
  externalBridgeModel: string;
  activeRecognitionMode: "idle" | "cloud" | "external";
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

function getRecognitionCtor() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function createBaseDiagnostics(): VoiceDiagnostics {
  const Ctor = getRecognitionCtor();
  const probe = Ctor ? new Ctor() : null;
  const phrasesSupported = !!window.SpeechRecognition && !!window.SpeechRecognitionPhrase && !!probe && "phrases" in probe;
  try {
    probe?.abort?.();
  } catch {
    // ignore
  }
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
      return "Microphone permission was blocked. Check Windows microphone privacy and allow desktop apps to use the mic.";
    case "audio-capture":
      return "Homie could not capture audio from the microphone. Check the default input device and try the mic test.";
    case "no-speech":
      return "The microphone started, but no speech was detected before recognition ended.";
    case "network":
      return "Speech recognition hit a network or service issue. Try again, type instead, or use the external/local voice bridge.";
    case "aborted":
      return "Voice recognition was stopped before it finished.";
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
    return `External/local bridge is unreachable at ${baseUrl}. Start the bridge, then try again.`;
  }
  if (lower.includes("timeout") || lower.includes("timed out") || lower.includes("aborted")) {
    return `External/local bridge timed out at ${baseUrl}. It may still be loading the speech model.`;
  }
  if (lower.includes("404") || lower.includes("not found")) {
    return `External/local bridge answered, but the expected route was missing. Check that /health and /transcribe are available.`;
  }
  if (lower.includes("json") || lower.includes("unexpected token")) {
    return `External/local bridge replied with invalid JSON. Check the bridge logs and contract.`;
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

function trimForSpeech(text: string) {
  const compact = text
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .replace(/\bBody:\s*/g, "First, ")
    .replace(/\bMind:\s*/g, "Here’s the thought: ")
    .replace(/\bFamily:\s*/g, "For the family lane, ")
    .replace(/\bNext move:\s*/g, "Next, ")
    .replace(/\bLast thread I remember:\s*/g, "One thing I still remember: ")
    .trim();

  if (!compact) return "I’m here.";

  const pieces = compact.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [compact];
  const spoken = pieces
    .map((piece) => piece.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  const warm = spoken || compact;
  if (warm.length <= 210) return warm;
  return warm.slice(0, 207) + "...";
}

function downloadTextFile(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 250);
}


// ===== v10.36.20 Homie true presence helpers =====
type HomiePresenceEmotion = "calm" | "warm" | "focused" | "listening" | "speaking" | "concerned" | "celebrating";

function getHomiePresenceEmotion(args: {
  isListening: boolean;
  isSpeaking: boolean;
  mood: "idle" | "good" | "warn";
  status: string;
  memory: { recentThemeText?: string };
}): HomiePresenceEmotion {
  const status = String(args.status || "").toLowerCase();
  const themes = String(args.memory?.recentThemeText || "").toLowerCase();
  if (args.isListening) return "listening";
  if (args.isSpeaking) return "speaking";
  if (args.mood === "warn" || /overwhelm|stress|panic|scared|tired|sad|health|pain|warn|fail|blocked/.test((status + " " + themes))) return "concerned";
  if (/win|celebration|passed|clean|green|done|worked/.test((status + " " + themes))) return "celebrating";
  if (/focus|next move|mission|trading|build|chain|work/.test((status + " " + themes))) return "focused";
  if (args.mood === "good" || /family|legacy|check-in|check in|ground/.test((status + " " + themes))) return "warm";
  return "calm";
}

function getHomiePresenceLine(emotion: HomiePresenceEmotion, activeTitle: string) {
  switch (emotion) {
    case "listening": return "I’m listening — take your time and say it messy if you need to.";
    case "speaking": return "Answering softly first, then we can go deeper.";
    case "concerned": return "I’m staying steady with you. Smaller, slower, one next move.";
    case "celebrating": return "That one counts. We lock the win and keep the room calm.";
    case "focused": return "Focused with you on " + activeTitle + ". No extra noise.";
    case "warm": return "Warm lane open — body, mind, family, next move.";
    default: return "Calm companion mode — present, grounded, and ready.";
  }
}
// ===== v10.36.20 Homie true presence helpers END =====

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
  const [status, setStatus] = useState("Homie is here with you.");
  const [voiceEnabled, setVoiceEnabled] = useState(prefs.ai.homieVoiceEnabled);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isHoldingToTalk, setIsHoldingToTalk] = useState(false);
  const [gesture, setGesture] = useState<"none" | "wink" | "wave" | "nod" | "tilt" | "spark">("none");
  const [mood, setMood] = useState<"idle" | "good" | "warn">("idle");
  const [diagnostics, setDiagnostics] = useState<VoiceDiagnostics>(() => createBaseDiagnostics());
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [companionMode, setCompanionMode] = useState(() => (prefs.ai as any).homieCompanionMode !== false);
  const [companionInput, setCompanionInput] = useState("");
  const [companionMessages, setCompanionMessages] = useState<HomieCompanionMessage[]>(() => loadHomieCompanionHistory());
  const [companionMemory, setCompanionMemory] = useState(() => getHomieCompanionMemorySnapshot());
  const [legacyArtifactSummaries, setLegacyArtifactSummaries] = useState(() => getHomieLegacyArtifactSummaries(4));

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

  const activeTitle = useMemo(() => getPanelMeta(activePanelId).title, [activePanelId]);
  const api = oddApi();
  const skin = prefs.ai.homieAvatarSkin || "phoenix";
  const voiceProfile = prefs.ai.homieVoiceProfile;
  const voiceEngineMode = prefs.ai.homieVoiceEngineMode || "cloud";
  const externalVoiceBaseUrl = (prefs.ai.homieExternalVoiceBaseUrl || "http://127.0.0.1:8765").trim() || "http://127.0.0.1:8765";
  const externalVoiceTimeoutMs = Math.max(4000, Number(prefs.ai.homieExternalVoiceTimeoutMs || 20000));
  const strictLocalVoice = voiceEngineMode === "external-http";
  const riveEnabled = !!prefs.ai.homieRiveEnabled;
  const riveSrc = (prefs.ai.homieRiveSrc || "/rive/homie.riv").trim() || "/rive/homie.riv";
  const riveArtboard = (prefs.ai.homieRiveArtboard || "Homie").trim() || "Homie";
  const riveStateMachine = (prefs.ai.homieRiveStateMachine || "State Machine 1").trim() || "State Machine 1";
  const rivePointerTracking = prefs.ai.homieRivePointerTracking !== false;
  const shellClass = mode === "standalone" ? "homieCompanion homieRebuildStandalone" : "homieBuddy homieRebuildDock";
  const avatarState = `${isListening ? "listening" : ""} ${isSpeaking ? "speaking" : ""} ${mood} skin-${skin} gesture-${gesture}`.trim();
  const voiceModeLabel = voiceEngineMode === "external-http" ? "Local bridge" : voiceEngineMode === "hybrid" ? "Hybrid voice" : "Cloud voice";
  const spokenStatus = isListening ? "Listening" : isSpeaking ? "Speaking" : "Ready";
  const diagnosticsVisible = showDiagnostics || !!diagnostics.lastErrorMessage;
  const presenceEmotion = getHomiePresenceEmotion({ isListening, isSpeaking, mood, status, memory: companionMemory });
  const presenceClass = "emotion-" + presenceEmotion;
  const presenceLine = getHomiePresenceLine(presenceEmotion, activeTitle);

  function persistHomiePrefs(partial: Partial<typeof prefs.ai>) {
    const next = { ...prefs, ai: { ...prefs.ai, ...partial } };
    savePrefs(next);
    setPrefs(next);
    return next;
  }

  function emitVoiceStatus(detail: Record<string, any>) {
    const modeName = String(detail.mode || activeVoicePathRef.current || "cloud");
    updateVoiceEngineSnapshot({
      cloudState: modeName === "cloud" ? (detail.status === "started" ? "listening" : detail.status === "error" ? "degraded" : diagnostics.recognitionAvailable ? "ready" : "unavailable") : (diagnostics.recognitionAvailable ? "ready" : "degraded"),
      pushToTalkState: diagnostics.microphoneApiAvailable ? "ready" : "unavailable",
      typedState: "ready",
      localState: "disabled",
      externalState: modeName === "external"
        ? (detail.status === "started" ? "recording" : detail.status === "error" ? "degraded" : detail.status === "transcribing" ? "transcribing" : diagnostics.externalBridgeState)
        : diagnostics.externalBridgeState,
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
    } catch {
      // ignore
    }
  }

  function speak(text: string, force = false, spokenOverride?: string) {
    try {
      if (!force && !voiceEnabled) return;
      const utterance = new SpeechSynthesisUtterance((spokenOverride || text).replace(/\*\*/g, ""));
      const voice = pickVoice(voiceProfile);
      if (voice) utterance.voice = voice;
      utterance.rate = 0.93;
      utterance.pitch = skin === "terminal" ? 0.86 : skin === "phoenix" ? 1.0 : 0.96;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    } catch {
      setIsSpeaking(false);
    }
  }

  function announce(nextStatus: string, nextMood: "idle" | "good" | "warn" = "good", force = false, spokenOverride?: string) {
    setStatus(nextStatus);
    setMood(nextMood);
    speak(nextStatus, force, spokenOverride);
  }

  function appendCompanionMessages(nextMessages: HomieCompanionMessage[]) {
    setCompanionMessages((prev) => {
      const next = [...prev, ...nextMessages].slice(-18);
      saveHomieCompanionHistory(next);
      setCompanionMemory(getHomieCompanionMemorySnapshot());
      setLegacyArtifactSummaries(getHomieLegacyArtifactSummaries(4));
      return next;
    });
  }

  function handleCompanionConversation(text: string, source: "typed" | "voice" | "quick" = "typed") {
    const trimmed = text.trim();
    if (!trimmed) return false;
    const ctx = { activePanelTitle: activeTitle, activePanelId, status, mood, source };
    const reply = buildHomieCompanionReply(trimmed, ctx);
    appendCompanionMessages([
      createHomieMessage("user", trimmed, source),
      createHomieMessage("homie", reply.text, source),
    ]);
    announce(reply.text, reply.mood, source === "voice" || voiceEnabled, trimForSpeech(reply.text));
    return true;
  }

  function runCompanionQuick(text: string) {
    handleCompanionConversation(text, "quick");
  }

  function run(text: string) {
    if (companionMode && shouldHomieCompanionAnswer(text)) {
      handleCompanionConversation(text, "voice");
      return;
    }
    const result = executeCommand({
      text,
      activePanelId,
      onNavigate,
      onOpenHowTo,
      onStatus: (message) => announce(message, "good"),
    });
    if (result?.message) announce(result.message, result.ok ? "good" : "warn");
  }

  function stopVoice(silent = false, source = "homie") {
    if (activeVoicePathRef.current === "external") {
      try {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
      setIsListening(false);
      setIsHoldingToTalk(false);
      emitVoiceStatus({ source, status: "ended", message: "Stopped local bridge recording.", mode: "external" });
      if (!silent) announce("Stopped listening.", "idle", false, "Stopped listening.");
      return;
    }
    try {
      recognitionRef.current?.stop?.();
    } catch {
      // ignore
    }
    setIsListening(false);
    setIsHoldingToTalk(false);
    emitVoiceStatus({ source, status: "ended", message: "Stopped listening.", mode: "cloud" });
    if (!silent) announce("Stopped listening.", "idle", false, "Stopped listening.");
  }

  function wantsExternalVoice() {
    return voiceEngineMode === "external-http" || voiceEngineMode === "hybrid";
  }

  async function probeExternalVoice(silent = false, baseState?: VoiceDiagnostics) {
    const current = baseState || diagnostics;
    if (!api.voiceBridgeProbe || !wantsExternalVoice()) {
      const message = voiceEngineMode === "cloud"
        ? "External/local bridge is idle because Homie is set to cloud mode."
        : "External/local bridge probing is only available in desktop mode.";
      const nextState = voiceEngineMode === "cloud" ? "disabled" : "unavailable";
      setDiagnostics((prev) => ({ ...prev, externalBridgeConfigured: wantsExternalVoice(), externalBridgeBaseUrl: externalVoiceBaseUrl, externalBridgeState: nextState, externalBridgeMessage: message, externalBridgeModel: "" }));
      if (!silent) announce(message, "warn", true, "Voice bridge unavailable.");
      return { ok: false, status: nextState, message };
    }

    setDiagnostics((prev) => ({ ...prev, externalBridgeConfigured: true, externalBridgeBaseUrl: externalVoiceBaseUrl, externalBridgeState: "configuring", externalBridgeMessage: `Checking ${externalVoiceBaseUrl}…` }));
    const result = await api.voiceBridgeProbe({ baseUrl: externalVoiceBaseUrl, timeoutMs: Math.min(externalVoiceTimeoutMs, 8000) });

    if (result?.ok) {
      const message = result.detail || `External/local voice bridge is ready at ${externalVoiceBaseUrl}.`;
      setDiagnostics((prev) => ({ ...prev, ...current, externalBridgeConfigured: true, externalBridgeBaseUrl: externalVoiceBaseUrl, externalBridgeState: "ready", externalBridgeMessage: message, externalBridgeModel: result.model || "" }));
      if (!silent) announce(message, "good", true, "Voice bridge ready.");
      return { ok: true, status: "ready", message };
    }

    const message = classifyExternalBridgeError(result?.error || `External/local voice bridge did not respond at ${externalVoiceBaseUrl}.`, externalVoiceBaseUrl);
    setDiagnostics((prev) => ({ ...prev, ...current, externalBridgeConfigured: true, externalBridgeBaseUrl: externalVoiceBaseUrl, externalBridgeState: "degraded", externalBridgeMessage: message, externalBridgeModel: "", lastErrorCode: prev.lastErrorCode || "external-bridge-unreachable", lastErrorMessage: prev.lastErrorMessage || message }));
    if (!silent) announce(message, "warn", true, "Voice bridge issue.");
    return { ok: false, status: "degraded", message };
  }

  async function refreshVoiceDiagnostics() {
    const next = createBaseDiagnostics();
    next.externalBridgeConfigured = wantsExternalVoice();
    next.externalBridgeBaseUrl = externalVoiceBaseUrl;
    next.externalBridgeState = wantsExternalVoice() ? "configuring" : "disabled";
    next.externalBridgeMessage = wantsExternalVoice() ? `Checking ${externalVoiceBaseUrl}…` : "External/local bridge is idle because Homie is set to cloud mode.";

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
    } catch {
      // ignore
    }

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
      message: wantsExternalVoice() ? next.externalBridgeMessage : next.localMessage,
      errorCode: next.lastErrorCode || "",
    });

    if (wantsExternalVoice()) await probeExternalVoice(true, next);
    return next;
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
      announce(message, "warn", true, "Voice bridge unavailable.");
      return;
    }

    try {
      setDiagnostics((prev) => ({ ...prev, externalBridgeState: "transcribing", externalBridgeMessage: `Transcribing with ${externalVoiceBaseUrl}…`, activeRecognitionMode: "external" }));
      const audioBase64 = await blobToBase64(blob);
      const result = await api.voiceBridgeTranscribe({ baseUrl: externalVoiceBaseUrl, timeoutMs: externalVoiceTimeoutMs, mimeType: blob.type || "audio/webm", audioBase64 });

      if (!result?.ok || !result.text) {
        const message = result?.error || "External/local voice bridge returned no transcript.";
        setDiagnostics((prev) => ({ ...prev, externalBridgeState: "degraded", externalBridgeMessage: message, lastErrorCode: "external-transcribe-failed", lastErrorMessage: message, activeRecognitionMode: "idle" }));
        announce(message, "warn", true, "Voice bridge transcription failed.");
        return;
      }

      const transcript = String(result.text || "").trim();
      setDiagnostics((prev) => ({ ...prev, externalBridgeState: "ready", externalBridgeMessage: result.detail || `External/local voice bridge ready at ${externalVoiceBaseUrl}.`, externalBridgeModel: result.model || prev.externalBridgeModel, lastTranscript: transcript || prev.lastTranscript, lastErrorCode: "", lastErrorMessage: "", activeRecognitionMode: "idle" }));

      if (!transcript) {
        announce("The bridge heard audio but returned an empty transcript.", "warn", true, "No transcript returned.");
        return;
      }

      emitVoiceStatus({ source, status: "transcript", message: `Heard: ${transcript}`, transcript, mode: "external" });
      setStatus("Heard you. I’m answering.");
      setMood("good");
      window.setTimeout(() => run(transcript), 90);
    } catch (error: any) {
      const code = String(error?.name || "external-transcribe-error");
      const message = classifyExternalBridgeError(`${code}: ${String(error?.message || "External/local transcription failed.")}`, externalVoiceBaseUrl);
      setDiagnostics((prev) => ({ ...prev, externalBridgeState: "degraded", externalBridgeMessage: message, lastErrorCode: code, lastErrorMessage: message, activeRecognitionMode: "idle" }));
      announce(message, "warn", true, "Voice bridge issue.");
    }
  }

  async function startExternalVoice(pushToTalk = false, source = "homie") {
    const latest = await refreshVoiceDiagnostics();
    if (!navigator.mediaDevices?.getUserMedia) {
      const message = "Microphone access is unavailable because getUserMedia is missing in this runtime.";
      setDiagnostics((prev) => ({ ...prev, ...latest, lastErrorCode: "getusermedia-unavailable", lastErrorMessage: message }));
      announce(message, "warn", true, "Microphone unavailable.");
      return;
    }

    const probe = await probeExternalVoice(true, latest);
    if (!probe.ok && strictLocalVoice) {
      const message = `${probe.message} External/local mode is strict, so Homie will not fall back to cloud speech.`;
      setDiagnostics((prev) => ({ ...prev, lastErrorCode: "external-bridge-required", lastErrorMessage: message, activeRecognitionMode: "idle" }));
      announce(message, "warn", true, "Voice bridge required.");
      return;
    }
    if (!probe.ok && !strictLocalVoice) {
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
        try {
          mediaStreamRef.current?.getTracks()?.forEach((track) => track.stop());
        } catch {
          // ignore
        }
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;
        setIsListening(false);
        setIsHoldingToTalk(false);
        if (blob.size <= 0) {
          announce("No audio was captured before listening stopped.", "warn", true, "No audio captured.");
          return;
        }
        void transcribeExternalBlob(blob, source);
      };

      recorder.onerror = (event: any) => {
        const message = String(event?.error?.message || event?.message || "External/local recording failed.");
        setDiagnostics((prev) => ({ ...prev, externalBridgeState: "degraded", externalBridgeMessage: message, lastErrorCode: "external-recorder-error", lastErrorMessage: message, activeRecognitionMode: "idle" }));
        announce(message, "warn", true, "Recording failed.");
      };

      recorder.start();
      setIsListening(true);
      if (pushToTalk) setIsHoldingToTalk(true);
      setDiagnostics((prev) => ({ ...prev, externalBridgeState: "recording", externalBridgeMessage: pushToTalk ? "Hold to talk is recording." : "Recording for the local bridge.", activeRecognitionMode: "external", lastErrorCode: "", lastErrorMessage: "" }));
      emitVoiceStatus({ source, status: "started", message: pushToTalk ? "Hold to talk is recording." : "Recording for the local bridge.", mode: "external" });
    } catch (error: any) {
      const code = String(error?.name || "external-start-failed");
      const message = `${code}: ${String(error?.message || "Could not start external/local voice recording.")}`;
      setDiagnostics((prev) => ({ ...prev, externalBridgeState: "degraded", externalBridgeMessage: message, lastErrorCode: code, lastErrorMessage: message, activeRecognitionMode: "idle" }));
      announce(message, "warn", true, "Voice start failed.");
    }
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
      const message = "SpeechRecognition is unavailable in this runtime. Use typing or the external/local voice bridge instead.";
      setDiagnostics((prev) => ({ ...prev, ...latest, lastErrorCode: "unsupported", lastErrorMessage: message }));
      announce(message, "warn", true, "Cloud voice unavailable.");
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      const message = "Microphone access is unavailable because getUserMedia is missing in this runtime.";
      setDiagnostics((prev) => ({ ...prev, ...latest, lastErrorCode: "getusermedia-unavailable", lastErrorMessage: message }));
      announce(message, "warn", true, "Microphone unavailable.");
      return;
    }

    try {
      const rec = new Ctor();
      recognitionRef.current = rec;
      rec.lang = "en-US";
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      const biased = allowBias ? applyRecognitionBias(rec) : false;
      if (pushToTalk) setIsHoldingToTalk(true);

      rec.onstart = () => {
        setIsListening(true);
        setDiagnostics((prev) => ({ ...prev, phrasesSupported: prev.phrasesSupported || biased, phraseBiasMode: biased ? "supported" : prev.recognitionAvailable ? "optional" : "unsupported", activeRecognitionMode: "cloud" }));
        emitVoiceStatus({ source, status: "started", message: pushToTalk ? "Hold to talk is live." : "Listening.", mode: "cloud" });
      };

      rec.onresult = (event: any) => {
        const transcript = String(event?.results?.[0]?.[0]?.transcript || "").trim();
        setIsListening(false);
        setIsHoldingToTalk(false);
        setDiagnostics((prev) => ({ ...prev, lastTranscript: transcript || prev.lastTranscript }));
        if (!transcript) {
          announce("Listening ended without a transcript.", "warn", true, "No transcript returned.");
          return;
        }
        emitVoiceStatus({ source, status: "transcript", message: `Heard: ${transcript}`, transcript, mode: "cloud" });
        setStatus("Heard you. I’m answering.");
        setMood("good");
        window.setTimeout(() => run(transcript), 90);
      };

      rec.onerror = (event: any) => {
        const code = String(event?.error || "unknown");
        const rawMessage = String(event?.message || event?.error || "");
        if (biased && allowBias && isPhraseBiasError(code, rawMessage)) {
          try {
            rec.abort?.();
          } catch {
            // ignore
          }
          setIsListening(false);
          setIsHoldingToTalk(false);
          setDiagnostics((prev) => ({ ...prev, phraseBiasMode: "optional", phrasesSupported: false, lastErrorCode: "phrase-bias-unsupported", lastErrorMessage: "Phrase biasing is unsupported in this runtime. Retrying with standard voice recognition." }));
          window.setTimeout(() => {
            void startVoice(pushToTalk, false, false, false, source);
          }, 80);
          return;
        }
        const message = mapRecognitionError(code);
        setIsListening(false);
        setIsHoldingToTalk(false);
        setDiagnostics((prev) => ({ ...prev, activeRecognitionMode: "idle", lastErrorCode: code, lastErrorMessage: message }));
        emitVoiceStatus({ source, status: "error", message, errorCode: code, mode: "cloud" });
        announce(message, "warn", true, "Voice recognition issue.");
      };

      rec.onend = () => {
        setIsListening(false);
        setIsHoldingToTalk(false);
        setDiagnostics((prev) => ({ ...prev, activeRecognitionMode: "idle" }));
        emitVoiceStatus({ source, status: "ended", message: "Voice session ended.", mode: "cloud" });
      };

      rec.start();
    } catch (error: any) {
      const code = String(error?.name || "recognition-start-failed");
      const rawMessage = String(error?.message || "Voice recognition could not start.");
      const message = `${code}: ${rawMessage}`;
      setDiagnostics((prev) => ({ ...prev, activeRecognitionMode: "idle", lastErrorCode: code, lastErrorMessage: message }));
      setIsListening(false);
      setIsHoldingToTalk(false);
      emitVoiceStatus({ source, status: "error", message, errorCode: code, mode: "cloud" });
      announce(message, "warn", true, "Voice start failed.");
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
      announce(`Mic test passed. ${fresh.audioInputCount || 1} audio input${fresh.audioInputCount === 1 ? "" : "s"} detected.`, "good", true, "Mic test passed.");
    } catch (error: any) {
      const code = String(error?.name || error?.code || "mic-test-failed");
      const message = `${code}: ${String(error?.message || "Microphone test failed.")}`;
      setDiagnostics((prev) => ({ ...prev, micTest: "fail", lastErrorCode: code, lastErrorMessage: message }));
      announce(message, "warn", true, "Mic test failed.");
    }
  }

  async function launchCompanion() {
    if (!api.openWindow) {
      announce("Companion pop-out is only available in desktop mode.", "warn", true, "Pop-out unavailable.");
      return;
    }
    const result = await api.openWindow({ title: "Homie", query: { buddy: "1" }, width: 460, height: 760, alwaysOnTop: true, frame: false, transparent: true, skipTaskbar: false, resizable: true });
    if (result.ok) announce("Launched the Homie companion window.", "good", false, "Companion window opened.");
    else announce(result.error || "Could not launch the Homie companion window.", "warn", true, "Companion window failed.");
  }

  function runLegacyDraft() {
    const artifact = buildHomieLegacyArtifactDraft({ activePanelTitle: activeTitle, activePanelId, status, mood, source: "quick" });
    appendCompanionMessages([createHomieMessage("homie", artifact.body, "quick")]);
    setCompanionMemory(getHomieCompanionMemorySnapshot());
    setLegacyArtifactSummaries(getHomieLegacyArtifactSummaries(4));
    announce("I drafted a family note you can keep.", "good", true, "I drafted a family note.");
  }

  function runLegacyPrompt(prompt: string, spoken = "Saved a family artifact.") {
    const artifact = buildHomieLegacyPromptArtifact(prompt, { activePanelTitle: activeTitle, activePanelId, status, mood, source: "quick" });
    appendCompanionMessages([createHomieMessage("homie", artifact.body, "quick")]);
    setCompanionMemory(getHomieCompanionMemorySnapshot());
    setLegacyArtifactSummaries(getHomieLegacyArtifactSummaries(4));
    announce(spoken, "good", true, spoken);
  }

  function saveForFamily() {
    const text = exportHomieLegacyArtifactText();
    const stamp = new Date().toISOString().slice(0, 10);
    downloadTextFile(`Homie_Legacy_Note_${stamp}.txt`, text);
    try {
      void navigator.clipboard?.writeText(text);
    } catch {
      // ignore
    }
    setLegacyArtifactSummaries(getHomieLegacyArtifactSummaries(4));
    announce("Saved the latest family note and copied it too.", "good", true, "Saved for family.");
  }

  useEffect(() => {
    setVoiceEnabled(prefs.ai.homieVoiceEnabled);
  }, [prefs.ai.homieVoiceEnabled]);

  useEffect(() => {
    const syncPrefs = () => {
      const next = loadPrefs();
      setPrefs(next);
      setVoiceEnabled(next.ai.homieVoiceEnabled);
    };
    window.addEventListener("oddengine:prefs-changed", syncPrefs as EventListener);
    window.addEventListener("storage", syncPrefs as EventListener);
    return () => {
      window.removeEventListener("oddengine:prefs-changed", syncPrefs as EventListener);
      window.removeEventListener("storage", syncPrefs as EventListener);
    };
  }, []);

  useEffect(() => {
    void refreshVoiceDiagnostics();
  }, [voiceEngineMode, externalVoiceBaseUrl]);

  useEffect(() => {
    if (reduceMotion) return;
    if (isListening) {
      setGesture("tilt");
      return;
    }
    if (isSpeaking) {
      setGesture("nod");
      return;
    }
    if (mood === "warn") {
      setGesture("tilt");
      return;
    }
    if (mood === "good") {
      setGesture("spark");
      const id = window.setTimeout(() => setGesture("none"), 900);
      return () => window.clearTimeout(id);
    }
    setGesture("none");
  }, [isListening, isSpeaking, mood, reduceMotion]);

  useEffect(() => {
    if (diagnostics.lastErrorMessage) setShowDiagnostics(true);
  }, [diagnostics.lastErrorMessage]);

  useEffect(() => {
    const hydrateVoices = () => setPrefs(loadPrefs());
    try {
      window.speechSynthesis.onvoiceschanged = hydrateVoices;
    } catch {
      // ignore
    }
    return () => {
      try {
        window.speechSynthesis.onvoiceschanged = null;
      } catch {
        // ignore
      }
    };
  }, []);

  useEffect(() => () => stopVoice(true), []);

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

  const avatarContents = (
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
        fallback={orbFallbackFace}
      />
      <span className="homieOrbLabel">Homie</span>
    </span>
  );

  const panel = (
    <div className={`homieBuddyPanel card softCard homieRebuildPanel ${presenceClass} ${mode === "standalone" ? "standalone" : ""}`}>
      <div className="homieRebuildHeader">
        <div className="homieRebuildBrand">
          <img src={fairlyOddLogo} alt="FairlyOdd" className="homieRebuildLogo" />
          <div>
            <div className="assistantTitle">Homie</div>
            <div className="small">Companion • {activeTitle}</div>
          </div>
        </div>
        <div className="homieRebuildHeaderActions">
          <button
            className={`tabBtn ${companionMode ? "active" : ""}`}
            onClick={() => {
              const next = !companionMode;
              setCompanionMode(next);
              persistHomiePrefs({ homieCompanionMode: next } as any);
              announce(next ? "Companion mode is on." : "Companion mode is muted. Command routing still works.", next ? "good" : "idle", true, next ? "Companion on." : "Companion off.");
            }}
          >
            {companionMode ? "Companion on" : "Companion off"}
          </button>
          {mode === "floating" ? <button className="tabBtn" onClick={() => setOpen(false)}>Hide</button> : <button className="tabBtn" onClick={launchCompanion}>Pop out</button>}
        </div>
      </div>

      <div className="homieRebuildLayout">
        <section className="card homieRebuildStage">
          <div className={`homieRebuildAura mood-${mood} ${presenceClass} ${isListening ? "listening" : ""} ${isSpeaking ? "speaking" : ""}`} />
          <div className="homieRebuildAvatarWrap">
            <span className={`homieOrb homieRebuildAvatar ${presenceClass} ${avatarState}`}>
              {avatarContents}
              <span className="homieOrbRing ringOne" />
              <span className="homieOrbRing ringTwo" />
            </span>
          </div>
          <div className="homieRebuildPresence">
            <span className={`badge ${isListening ? "warn" : isSpeaking ? "good" : mood === "warn" ? "warn" : "good"}`}>{spokenStatus}</span>
            <span className="badge">{voiceModeLabel}</span>
            <span className={`badge ${diagnostics.permissionState === "granted" ? "good" : diagnostics.permissionState === "denied" ? "warn" : ""}`}>Mic {diagnostics.permissionState}</span>
          </div>
          <div className="homieRebuildStageText">
            <div className="assistantSectionTitle">A calmer Homie lane</div>
            <div className="small">{status}</div>
            <div className="small homieRebuildPresenceLine">{presenceLine}</div>
          </div>
          <div className="homieRebuildMemoryGrid">
            <div className="homieRebuildMemoryCell"><span className="small">Check-ins</span><strong>{companionMemory.checkInCount}</strong></div>
            <div className="homieRebuildMemoryCell"><span className="small">Themes</span><strong>{companionMemory.recentThemeText}</strong></div>
            <div className="homieRebuildMemoryCell wide"><span className="small">Last next move</span><strong>{companionMemory.lastNextStep}</strong></div>
          </div>
          <div className="homieLegacyVaultMini">
            <div className="small"><b>Family legacy vault</b> • {companionMemory.legacyArtifactCount} saved</div>
            {legacyArtifactSummaries.length ? (
              <div className="homieLegacyVaultList">
                {legacyArtifactSummaries.slice(0, 3).map((artifact) => (
                  <div key={artifact.id} className="homieLegacyVaultItem">
                    <strong>{artifact.title}</strong>
                    <span>{artifact.preview || "Saved family artifact"}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="small">No family artifact saved yet. Use Legacy note or Save for family when something matters.</div>
            )}
          </div>
        </section>

        <section className="card homieRebuildConversation">
          <div className="homieRebuildSectionHead">
            <div>
              <div className="assistantSectionTitle">Talk with Homie</div>
              <div className="small">Warm short replies first. Deeper support when you stay in the lane.</div>
            </div>
            <button
              className="tabBtn active"
              onClick={() => {
                const reply = buildHomieCompanionCheckIn({ activePanelTitle: activeTitle, activePanelId, status, mood, source: "quick" });
                appendCompanionMessages([createHomieMessage("homie", reply.text, "quick")]);
                announce(reply.text, reply.mood, true, trimForSpeech(reply.text));
              }}
            >
              Check in
            </button>
          </div>

          <div className="homieCompanionMessages homieRebuildMessages">
            {companionMessages.length === 0 ? (
              <div className="homieCompanionEmpty small">Say “Homie, check in with me” or tell me what feels heavy. I’ll answer like a companion first.</div>
            ) : (
              companionMessages.slice(-6).map((msg) => (
                <div key={msg.id} className={`homieCompanionMsg ${msg.role}`}><span>{msg.text}</span></div>
              ))
            )}
          </div>

          <div className="homieRebuildComposer">
            <input
              value={companionInput}
              onChange={(event) => setCompanionInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  const next = companionInput.trim();
                  setCompanionInput("");
                  handleCompanionConversation(next, "typed");
                }
              }}
              placeholder="Tell Homie what you need..."
            />
            <button className="tabBtn active" onClick={() => { const next = companionInput.trim() || "check in with me"; setCompanionInput(""); handleCompanionConversation(next, "typed"); }}>Send</button>
          </div>

          <div className="assistantChipWrap homieRebuildQuickActions">
            <button className="tabBtn" onClick={() => runCompanionQuick("help me focus on the next tiny move")}>Focus me</button>
            <button className="tabBtn" onClick={() => runCompanionQuick("I feel overwhelmed, ground me")}>Ground me</button>
            <button className="tabBtn" onClick={runLegacyDraft}>Legacy note</button>
            <button className="tabBtn" onClick={() => runLegacyPrompt("write a message for my family", "Saved a message for family.")}>Family message</button>
            <button className="tabBtn" onClick={() => runLegacyPrompt("what should my family open first", "Saved the open-first guide.")}>Open first</button>
            <button className="tabBtn" onClick={() => runLegacyPrompt("save today’s checkpoint", "Saved today’s checkpoint.")}>Today checkpoint</button>
            <button className="tabBtn" onClick={saveForFamily}>Save for family</button>
            <button className="tabBtn" onClick={() => { setOpen(true); void startVoice(false); }}>Talk by mic</button>
          </div>
        </section>

        <section className="card homieRebuildVoice">
          <div className="homieRebuildSectionHead">
            <div>
              <div className="assistantSectionTitle">Voice</div>
              <div className="small">Mic in. Speaker out. Diagnostics only when needed.</div>
            </div>
            <button className="tabBtn" onClick={() => setShowDiagnostics((value) => !value)}>{diagnosticsVisible ? "Hide details" : "Voice details"}</button>
          </div>

          <div className="assistantChipWrap">
            <button className={`tabBtn ${voiceEnabled ? "active" : ""}`} onClick={() => { const next = !voiceEnabled; setVoiceEnabled(next); persistHomiePrefs({ homieVoiceEnabled: next } as any); announce(next ? "Voice is on." : "Voice is muted.", next ? "good" : "idle", true, next ? "Voice on." : "Voice off."); }}>{voiceEnabled ? "Voice on" : "Voice off"}</button>
            <button className="tabBtn" onClick={() => { if (isListening) stopVoice(); else void startVoice(false); }}>{isListening ? "Stop listening" : "Start listening"}</button>
            <button
              className={`tabBtn ${isHoldingToTalk ? "active" : ""}`}
              onMouseDown={(event) => { event.preventDefault(); void startVoice(true); }}
              onMouseUp={() => stopVoice()}
              onMouseLeave={() => { if (isHoldingToTalk) stopVoice(true); }}
              onTouchStart={(event) => { event.preventDefault(); void startVoice(true); }}
              onTouchEnd={() => stopVoice()}
            >
              {isHoldingToTalk ? "Release to stop" : "Hold to talk"}
            </button>
            <button className="tabBtn" onClick={() => void runMicTest()}>Mic test</button>
            <button className="tabBtn" onClick={() => { const digest = buildMorningDigest(); announce(digest, "good", true, trimForSpeech(digest)); }}>Read digest</button>
            {mode === "floating" && <button className="tabBtn" onClick={launchCompanion}>Pop out</button>}
          </div>

          <div className="homieRebuildVoiceMeta">
            <div className="small"><b>Voice engine:</b> {diagnostics.recognitionName} • {voiceModeLabel}</div>
            <div className="small"><b>Last transcript:</b> {diagnostics.lastTranscript || "—"}</div>
            <div className="small"><b>Bridge:</b> {diagnostics.externalBridgeState} • {diagnostics.externalBridgeBaseUrl}</div>
          </div>

          {diagnosticsVisible && (
            <div className="homieRebuildDiagnostics">
              <div className="small"><b>Recognition:</b> {diagnostics.recognitionAvailable ? "ready" : "unavailable"}</div>
              <div className="small"><b>Phrase boost:</b> {diagnostics.phraseBiasMode}</div>
              <div className="small"><b>Mic permission:</b> {diagnostics.permissionState}</div>
              <div className="small"><b>Audio inputs:</b> {diagnostics.audioInputCount}</div>
              <div className="small"><b>Mic test:</b> {diagnostics.micTest}</div>
              <div className="small"><b>External/local bridge:</b> {diagnostics.externalBridgeMessage}</div>
              <div className="small"><b>Last failure:</b> {diagnostics.lastErrorMessage || "none"}</div>
              <div className="assistantChipWrap" style={{ marginTop: 10 }}>
                <button className="tabBtn" onClick={() => void refreshVoiceDiagnostics()}>Refresh diagnostics</button>
                <button className="tabBtn" onClick={() => void probeExternalVoice(false)}>Probe bridge</button>
              </div>
            </div>
          )}
        </section>
      </div>

      <div className="homieRebuildFooter small">Operator mode still works. Say things like “open trading” or “open mission control” when you want Homie to route commands instead of coach.</div>
    </div>
  );

  return (
    <div className={shellClass}>
      {mode === "floating" && (
        <button className={`homieOrb homieRebuildLauncher ${presenceClass} ${avatarState}`} onClick={() => setOpen((value) => !value)} title="Homie">
          {avatarContents}
          <span className="homieOrbRing ringOne" />
          <span className="homieOrbRing ringTwo" />
        </button>
      )}
      {(open || mode === "standalone") && panel}
    </div>
  );
}
