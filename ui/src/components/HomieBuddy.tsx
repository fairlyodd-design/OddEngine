import { HomieTrue3DAvatar } from "./HomieTrue3DAvatar";
import React, { useEffect, useMemo, useRef, useState } from "react";
// v10.36.81 checker-safe marker: premium warm local TTS + cleaner panel personality installed
// v10.36.80 checker-safe marker: warm local TTS voice shaping installed
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


const HOMIE_VOICE_MIN_EXTERNAL_RECORDING_MS = 700;
const HOMIE_VOICE_MAX_EXTERNAL_RECORDING_MS = 30000;
const HOMIE_VOICE_PROBE_CACHE_MS = 15000;
const HOMIE_VOICE_MIN_AUDIO_BLOB_BYTES = 1200;

type HomieExternalProbeCache = {
  ts: number;
  baseUrl: string;
  result: { ok: boolean; status?: string; message?: string; model?: string };
};

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
      return "The microphone opened, but I did not catch words. Camera does not carry voice here. Try Start listening, say one short sentence clearly, or check your Windows input device.";
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


function applyHomieWarmTtsStyle(utter: SpeechSynthesisUtterance) {
  try {
    utter.rate = 0.92;
    utter.pitch = 0.98;
    utter.volume = 1;
    utter.text = String(utter.text || "")
      .replace(/\s+/g, " ")
      .replace(/,\s+/g, ", ")
      .replace(/\s*—\s*/g, ". ")
      .replace(/\s*\|\s*/g, ". ")
      .replace(/:\s+/g, ", ")
      .trim();
  } catch {
    // ignore
  }
}


function applyHomiePremiumWarmTtsStyle(utter: SpeechSynthesisUtterance) {
  try {
    utter.rate = 0.9;
    utter.pitch = 0.97;
    utter.volume = 1;
    utter.text = String(utter.text || "")
      .replace(/\s+/g, " ")
      .replace(/\s*—\s*/g, ". ")
      .replace(/\s*\|\s*/g, ". ")
      .replace(/:\s+/g, ", ")
      .replace(/,\s+/g, ", ")
      .trim();
  } catch {
    // ignore
  }
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


function downloadBlobFile(filename: string, blob: Blob) {
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
    case "warm": return "Warm companion lane open — body, mind, family, next move.";
    default: return "Calm companion mode — present, warm, and ready.";
  }
}
// ===== v10.36.20 Homie true presence helpers END =====


// ===== v10.36.24 Homie runtime self-check + trust helpers =====
type HomieTrustSignalTone = "good" | "warn" | "idle";

function isHomieRuntimeSelfCheckPrompt(text: string) {
  const lower = text.trim().toLowerCase();
  return /\b(are you okay|are you ok|self check|self-check|runtime check|trust check|status check|can you hear me|can you talk|is your mic working|is the mic working|is voice working|what do you know|what are you guessing|what needs confirmation)\b/.test(lower);
}

function yesNo(value: boolean, yes: string, no: string) {
  return value ? yes : no;
}

function plainPermissionLabel(permission: VoiceDiagnostics["permissionState"]) {
  if (permission === "granted") return "allowed";
  if (permission === "denied") return "blocked";
  if (permission === "prompt") return "will ask when used";
  return "unknown";
}

function bridgePlainLabel(state: VoiceDiagnostics["externalBridgeState"]) {
  switch (state) {
    case "ready": return "ready";
    case "recording": return "recording";
    case "transcribing": return "transcribing";
    case "configuring": return "checking";
    case "degraded": return "having trouble";
    case "unavailable": return "unavailable";
    case "disabled": return "off";
    default: return String(state || "unknown");
  }
}
// ===== v10.36.24 Homie runtime self-check + trust helpers END =====


// ===== v10.36.25b Homie daily rhythm + proactive check-in helpers =====
type HomieDailyRhythmState = {
  lastGreetingDay?: string;
  lastPromptDay?: string;
  lastCheckInDay?: string;
  dismissedDay?: string;
  lastPromptAt?: number;
};

const HOMIE_DAILY_RHYTHM_KEY = "oddengine:homie:daily-rhythm:v1";

function getHomieDailyRhythmDayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + d;
}

function getHomieDayPart(date = new Date()) {
  const hour = date.getHours();
  if (hour < 5) return "late night";
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  if (hour < 21) return "evening";
  return "night";
}

function loadHomieDailyRhythmState(): HomieDailyRhythmState {
  try {
    const raw = localStorage.getItem(HOMIE_DAILY_RHYTHM_KEY);
    if (!raw) return {};
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
}

function saveHomieDailyRhythmState(next: HomieDailyRhythmState) {
  try {
    localStorage.setItem(HOMIE_DAILY_RHYTHM_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}

function isHomieDailyRhythmPrompt(text: string) {
  const lower = text.trim().toLowerCase();
  return /\b(what matters today|daily check|daily rhythm|today check|today's check|todays check|morning check|evening check|start my day|body family money creative|family body money creative)\b/.test(lower);
}

function buildHomieDailyRhythmPrompt(activeTitle: string) {
  return [
    "Homie, daily rhythm check in with me.",
    "Ask what matters today, then scan body, family, money, and creative next move.",
    "Keep it gentle, short first, no nagging, and do not claim you noticed anything without evidence.",
    "Current panel: " + activeTitle + ".",
  ].join(" ");
}

function buildHomieDailyRhythmLine(state: HomieDailyRhythmState, memory: { checkInCount?: number; lastCheckInLabel?: string; recentThemeText?: string }) {
  const today = getHomieDailyRhythmDayKey();
  if (state.lastCheckInDay === today) return "Daily rhythm is already checked in for today.";
  if (state.lastPromptDay === today) return "Today’s rhythm prompt is open — answer only what feels useful.";
  if ((memory.checkInCount || 0) > 0) return "Ready for one calm step, a plan, a memory, a family note, or one quiet minute.";
  return "When you’re ready: what matters today?";
}

function buildHomieDailyGreetingStatus(state: HomieDailyRhythmState, memory: { checkInCount?: number; recentThemeText?: string }) {
  const part = getHomieDayPart();
  const today = getHomieDailyRhythmDayKey();
  if (state.lastCheckInDay === today) return "Today’s rhythm is already checked in. I’m here if you need the next move.";
  const theme = memory.recentThemeText && memory.recentThemeText !== "general" ? " Last saved themes: " + memory.recentThemeText + "." : "";
  return "Good " + part + ". When you’re ready: what matters today — body, family, money, or creative?" + theme;
}
// ===== v10.36.25b Homie daily rhythm + proactive check-in helpers END =====

// ===== v10.36.26b Homie deep memory review + legacy timeline helpers =====
type HomieLegacyTimelineReview = {
  displayText: string;
  spokenText: string;
  exportText: string;
};

function isHomieLegacyTimelinePrompt(text: string) {
  const lower = text.trim().toLowerCase();
  return /\b(memory review|deep memory|legacy timeline|family timeline|timeline review|what we have been building|what we've been building|what we’ve been building|what changed today|what changed|current mission thread|mission thread|what to do next|export timeline|share timeline|share family timeline|download timeline|save timeline)\b/.test(lower);
}

function homieTimelineStamp(value: any) {
  const raw = value || Date.now();
  try {
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return "recent";
    return date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  } catch {
    return "recent";
  }
}

function homieCleanTimelineText(text: any, fallback = "Saved memory item") {
  const clean = String(text || fallback).replace(/\s+/g, " ").trim();
  if (clean.length <= 180) return clean;
  return clean.slice(0, 177) + "...";
}

function homieTimelineBullet(label: string, value: string) {
  return "• " + label + ": " + value;
}

function buildHomieLegacyTimelineReview(args: {
  messages: HomieCompanionMessage[];
  memory: any;
  artifacts: any[];
  dailyRhythm: HomieDailyRhythmState;
  activeTitle: string;
  status: string;
  dailyRhythmLine: string;
}): HomieLegacyTimelineReview {
  const messages = Array.isArray(args.messages) ? args.messages : [];
  const recentMessages = messages.slice(Math.max(0, messages.length - 10));
  const userMessages = recentMessages.filter((msg) => msg.role === "user").slice(-4);
  const artifacts = (Array.isArray(args.artifacts) ? args.artifacts : []).slice(0, 5);
  const today = getHomieDailyRhythmDayKey();
  const checkInCount = Number(args.memory?.checkInCount || 0);
  const legacyCount = Number(args.memory?.legacyArtifactCount || artifacts.length || 0);
  const themes = homieCleanTimelineText(args.memory?.recentThemeText || "general", "general");
  const lastNextMove = homieCleanTimelineText(args.memory?.lastNextStep || args.dailyRhythmLine || "Choose one small next move and keep going.");
  const activeThread = homieCleanTimelineText(args.status || "Homie is here with you: warm, steady, and here to remember what matters.");
  const checkedToday = args.dailyRhythm?.lastCheckInDay === today;
  const promptedToday = args.dailyRhythm?.lastPromptDay === today;
  const greetedToday = args.dailyRhythm?.lastGreetingDay === today;

  const recentCheckIns = userMessages.length
    ? userMessages.map((msg) => homieTimelineBullet(homieTimelineStamp((msg as any).createdAt || (msg as any).ts || (msg as any).time), homieCleanTimelineText(msg.text, "Check-in")))
    : ["• No recent check-in messages are visible in this local Homie window yet."];

  const savedNotes = artifacts.length
    ? artifacts.map((artifact) => homieTimelineBullet(homieCleanTimelineText(artifact.title, "Family note"), homieCleanTimelineText(artifact.preview, "Saved family artifact")))
    : ["• No saved family artifact summary is visible yet. Use Legacy note or Save for family when something matters."];

  const todayChanges = [
    checkedToday ? "Daily rhythm check-in is marked complete today." : "Daily rhythm check-in is not marked complete today yet.",
    promptedToday ? "Today’s prompt has been opened." : "Today’s prompt has not been opened yet.",
    greetedToday ? "Homie already gave today’s calm greeting." : "Homie has not recorded a greeting for today yet.",
    "Current panel context is " + args.activeTitle + ".",
  ];

  const currentMission = [
    "Keep Homie calm, grounded, useful, and family-safe.",
    "Current thread: " + activeThread,
    "Recent themes: " + themes,
    "Last next move: " + lastNextMove,
  ];

  const nextMoves = [
    "Do one tiny check-in: body, family, money, or creative.",
    legacyCount > 0 ? "Review one saved family artifact and decide whether it should be exported." : "Create one first legacy note for the family vault.",
    "Use Self check if mic, speaker, or bridge confidence feels shaky.",
    "Keep the OS lane clean before adding another big feature.",
  ];

  const displayText = [
    "Legacy timeline review — what we’ve been building.",
    "",
    "Recent check-ins:",
    ...recentCheckIns,
    "",
    "Saved family notes / artifacts:",
    ...savedNotes,
    "",
    "Current mission thread:",
    ...currentMission.map((line) => "• " + line),
    "",
    "What changed today:",
    ...todayChanges.map((line) => "• " + line),
    "",
    "What to do next:",
    ...nextMoves.map((line) => "• " + line),
    "",
    "Trust note: I’m summarizing local Homie memory and visible runtime state. I’m not claiming your family has seen anything unless you confirm it.",
  ].join("\n");

  const exportText = [
    "FairlyOdd / Homie Legacy Timeline",
    "Generated: " + new Date().toLocaleString(),
    "",
    displayText,
    "",
    "Counts:",
    "• Check-ins visible to Homie memory: " + checkInCount,
    "• Legacy artifacts visible to Homie memory: " + legacyCount,
    "• Active panel: " + args.activeTitle,
  ].join("\n");

  const spokenText = "Here’s the calm legacy timeline. I can see the recent Homie memory lane, saved family artifacts, today’s rhythm state, and the next tiny move. I’m not claiming anything outside those signals.";

  return { displayText, spokenText, exportText };
}
// ===== v10.36.26b Homie deep memory review + legacy timeline helpers END =====

// ===== v10.36.27 Homie family legacy artifact studio helpers =====
type HomieLegacyArtifactStudioType = "letter" | "memory-note" | "open-first" | "life-lesson" | "project-status";

type HomieLegacyArtifactStudioPreview = {
  type: HomieLegacyArtifactStudioType;
  title: string;
  body: string;
  markdown: string;
  filenameBase: string;
  spokenText: string;
  createdAt: number;
};

const HOMIE_LEGACY_ARTIFACT_TYPE_LABELS: Record<HomieLegacyArtifactStudioType, string> = {
  letter: "Letter",
  "memory-note": "Memory note",
  "open-first": "Open this first",
  "life-lesson": "Life lesson",
  "project-status": "Project status",
};

function isHomieLegacyArtifactStudioPrompt(text: string) {
  const lower = text.trim().toLowerCase();
  return /\b(artifact studio|family artifact|legacy artifact|make a letter|write a letter|memory note|open this first|life lesson|project status|status note|preview artifact|export artifact|legacy studio)\b/.test(lower);
}

function inferHomieLegacyArtifactStudioType(text: string): HomieLegacyArtifactStudioType {
  const lower = text.trim().toLowerCase();
  if (/\b(open this first|open-first|first thing|start here)\b/.test(lower)) return "open-first";
  if (/\b(life lesson|lesson|what i learned|teach them)\b/.test(lower)) return "life-lesson";
  if (/\b(project status|status note|where the project stands|what we built|build status)\b/.test(lower)) return "project-status";
  if (/\b(memory note|remember this|save this memory|family memory)\b/.test(lower)) return "memory-note";
  return "letter";
}

function homieLegacyArtifactFileSlug(type: HomieLegacyArtifactStudioType) {
  return type.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "") || "artifact";
}

function buildHomieFamilyLegacyArtifactStudioPreview(args: {
  type: HomieLegacyArtifactStudioType;
  timeline: HomieLegacyTimelineReview;
  memory: any;
  activeTitle: string;
  dailyRhythmLine: string;
}): HomieLegacyArtifactStudioPreview {
  const type = args.type || "letter";
  const label = HOMIE_LEGACY_ARTIFACT_TYPE_LABELS[type] || "Legacy artifact";
  const dateLine = new Date().toLocaleString();
  const themes = homieCleanTimelineText(args.memory?.recentThemeText || "general", "general");
  const lastNextMove = homieCleanTimelineText(args.memory?.lastNextStep || args.dailyRhythmLine || "Choose one small next move and keep going.");
  const activePanel = homieCleanTimelineText(args.activeTitle || "Homie", "Homie");
  const timelineSummary = homieCleanTimelineText(args.timeline.displayText, "Local Homie timeline is ready.");

  let title = "Family legacy artifact";
  let bodyLines: string[] = [];

  if (type === "letter") {
    title = "A letter for my family";
    bodyLines = [
      "Dear family,",
      "",
      "I wanted there to be a calm place you could open when life feels loud. FairlyOdd OS and Homie are part of that: a companion lane for memory, next moves, and the things that matter.",
      "",
      "What matters in this moment: body, mind, family, and one small next move. You do not have to understand everything at once. Start with the open-first notes, then follow the timeline slowly.",
      "",
      "Current Homie themes: " + themes + ".",
      "Current next move: " + lastNextMove,
      "",
      "Trust note: this was generated from local Homie memory and the visible timeline. It should be reviewed by the family before being treated as final."
    ];
  } else if (type === "memory-note") {
    title = "Memory note for the family vault";
    bodyLines = [
      "Memory note",
      "",
      "This note captures the current Homie memory lane without pretending to know anything outside the app.",
      "",
      "Recent themes: " + themes + ".",
      "Current panel/thread: " + activePanel + ".",
      "Next move remembered by Homie: " + lastNextMove,
      "",
      "Timeline preview: " + timelineSummary,
      "",
      "Family instruction: keep what feels true, edit what needs human context, and save the cleaned version."
    ];
  } else if (type === "open-first") {
    title = "Open this first";
    bodyLines = [
      "Open this first",
      "",
      "Start here if you are trying to understand what this system is for.",
      "",
      "1. Homie is the calm companion lane. Use it for check-ins, grounding, family notes, and the next move.",
      "2. The timeline shows what has been built and what changed recently.",
      "3. The legacy vault holds saved family notes and artifacts.",
      "4. Do not rush. Pick one note, one panel, or one next move at a time.",
      "",
      "Today’s gentle prompt: " + args.dailyRhythmLine,
      "",
      "Trust note: Homie can summarize saved local memory, but the family decides what is final."
    ];
  } else if (type === "life-lesson") {
    title = "Life lesson from this build";
    bodyLines = [
      "Life lesson",
      "",
      "The lesson inside this build is simple: when everything feels too big, make the next move small enough to actually do.",
      "",
      "Body first. Then mind. Then family. Then money or creative work. That order keeps the room human.",
      "",
      "Homie’s remembered next move: " + lastNextMove,
      "Recent themes: " + themes + ".",
      "",
      "Keep this as a family reminder: progress does not have to be loud to be real."
    ];
  } else {
    title = "Project status for FairlyOdd / Homie";
    bodyLines = [
      "Project status",
      "",
      "Homie is being shaped into a warm, non-human companion for check-ins, voice, legacy memory, and family artifacts.",
      "",
      "Current panel/thread: " + activePanel + ".",
      "Recent themes: " + themes + ".",
      "Current next move: " + lastNextMove,
      "",
      "What exists now: daily rhythm, runtime self-check, trust language, legacy timeline, artifact preview, and export flow.",
      "",
      "What to verify next: voice reliability, artifact quality, and whether the family can open the saved notes without needing developer context."
    ];
  }

  const footer = [
    "",
    "Generated by Homie Artifact Studio",
    "Generated: " + dateLine,
    "Source: local Homie memory, current timeline preview, and visible runtime context.",
    "Review note: please edit this before treating it as a final family document."
  ];
  const body = bodyLines.concat(footer).join("\n");
  const markdown = ["# " + title, "", body].join("\n");
  const filenameBase = "Homie_" + homieLegacyArtifactFileSlug(type) + "_" + getHomieDailyRhythmDayKey();
  const spokenText = label + " preview is ready. Review it first, then export as text or markdown.";

  return { type, title, body, markdown, filenameBase, spokenText, createdAt: Date.now() };
}
// ===== v10.36.27 Homie family legacy artifact studio helpers END =====

// ===== v10.36.28 Homie family legacy export pack + vault polish helpers =====
type HomieFamilyLegacyExportPack = {
  title: string;
  body: string;
  markdown: string;
  filenameBase: string;
  spokenText: string;
  createdAt: number;
};

function isHomieFamilyLegacyExportPackPrompt(text: string) {
  const lower = text.trim().toLowerCase();
  return /\b(family export pack|legacy export pack|export pack|vault pack|family vault pack|download pack|share pack|save pack|bundle timeline|bundle artifact|bundle notes|family packet|legacy packet)\b/.test(lower);
}

function homiePackSafeSection(title: string, lines: string[]) {
  const body = lines.map((line) => String(line || "").trim()).filter(Boolean);
  return [title, "", ...(body.length ? body : ["Nothing saved here yet."])].join("\n");
}

function buildHomieFamilyLegacyExportPack(args: {
  timeline: HomieLegacyTimelineReview;
  artifact?: HomieLegacyArtifactStudioPreview | null;
  memory: any;
  artifacts: any[];
  notesText: string;
  activeTitle: string;
  dailyRhythmLine: string;
}): HomieFamilyLegacyExportPack {
  const dateLine = new Date().toLocaleString();
  const artifact = args.artifact || null;
  const artifacts = Array.isArray(args.artifacts) ? args.artifacts.slice(0, 8) : [];
  const themes = homieCleanTimelineText(args.memory?.recentThemeText || "general", "general");
  const nextMove = homieCleanTimelineText(args.memory?.lastNextStep || args.dailyRhythmLine || "Choose one small next move.");
  const checkIns = Number(args.memory?.checkInCount || 0);
  const legacyCount = Number(args.memory?.legacyArtifactCount || artifacts.length || 0);
  const activePanel = homieCleanTimelineText(args.activeTitle || "Homie", "Homie");
  const savedArtifactLines = artifacts.length
    ? artifacts.map((item) => "• " + homieCleanTimelineText(item.title, "Family note") + " — " + homieCleanTimelineText(item.preview, "Saved family artifact"))
    : ["• No saved family artifact summaries are visible yet."];
  const artifactBody = artifact
    ? artifact.body
    : "No selected Artifact Studio draft was visible, so this pack includes the timeline and legacy notes only. Preview an artifact first if you want a letter, memory note, open-first guide, life lesson, or project status included.";
  const notesText = String(args.notesText || "").trim() || "No raw legacy note export is visible yet. Use Legacy note, Family message, or Save for family when something matters.";

  const sections = [
    "FairlyOdd / Homie Family Legacy Export Pack",
    "Generated: " + dateLine,
    "",
    homiePackSafeSection("Start here", [
      "This pack bundles the current Homie legacy timeline, the selected Artifact Studio draft, and the family vault notes into one reviewable family document.",
      "Open this slowly. Start with the selected artifact, then read the timeline, then review the vault notes.",
      "Homie is summarizing local app memory and visible runtime context only. The family should edit and confirm anything important.",
    ]),
    "",
    homiePackSafeSection("Current mission thread", [
      "Active panel: " + activePanel + ".",
      "Recent themes: " + themes + ".",
      "Remembered next move: " + nextMove,
      "Daily rhythm: " + args.dailyRhythmLine,
    ]),
    "",
    homiePackSafeSection("Selected family artifact", [artifact ? artifact.title : "No selected artifact preview yet.", "", artifactBody]),
    "",
    homiePackSafeSection("Legacy timeline", [args.timeline.exportText || args.timeline.displayText]),
    "",
    homiePackSafeSection("Saved vault summaries", savedArtifactLines),
    "",
    homiePackSafeSection("Raw legacy notes export", [notesText]),
    "",
    homiePackSafeSection("What to do next", [
      "1. Read the selected artifact and edit it like a human family document.",
      "2. Keep the timeline as context, not as proof of anything outside the app.",
      "3. Save one clean copy somewhere your family can actually find.",
      "4. Come back to Homie for one small next move: body, family, money, or creative.",
    ]),
    "",
    homiePackSafeSection("Trust and review note", [
      "This pack is generated from local Homie memory, visible timeline state, selected artifact preview, and legacy note export helpers.",
      "Homie is not claiming your family has read anything, opened anything, or confirmed anything unless you tell it so.",
      "Review before final family use.",
    ]),
    "",
    "Counts:",
    "• Check-ins visible to Homie memory: " + checkIns,
    "• Legacy artifacts visible to Homie memory: " + legacyCount,
  ];

  const body = sections.join("\n");
  const markdown = body
    .split("\n")
    .map((line, index) => {
      if (index === 0) return "# " + line;
      if (["Start here", "Current mission thread", "Selected family artifact", "Legacy timeline", "Saved vault summaries", "Raw legacy notes export", "What to do next", "Trust and review note", "Counts:"].includes(line.trim())) return "## " + line.trim().replace(/:$/, "");
      return line;
    })
    .join("\n");
  const filenameBase = "Homie_Family_Legacy_Export_Pack_" + getHomieDailyRhythmDayKey();
  const spokenText = "Family legacy export pack preview is ready. It bundles the timeline, selected artifact, and vault notes into one reviewable family document.";

  return { title: "Family Legacy Export Pack", body, markdown, filenameBase, spokenText, createdAt: Date.now() };
}
// ===== v10.36.28 Homie family legacy export pack + vault polish helpers END =====

// ===== v10.36.30b Homie family onboarding README + open-first pack helpers =====
type HomieFamilyOpenFirstGuide = {
  title: string;
  body: string;
  markdown: string;
  filenameBase: string;
  spokenText: string;
  createdAt: number;
};

function isHomieFamilyOpenFirstGuidePrompt(text: string) {
  const lower = text.trim().toLowerCase();
  return /\b(open first guide|open-first guide|open this first guide|family readme|family read me|family onboarding|first open pack|first-open pack|what is fairlyodd|what is homie|how do i use homie|how should my family use this|explain this to my family|start here guide|family start guide)\b/.test(lower);
}

function homieOpenFirstLine(value: any, fallback = "Not saved yet") {
  const clean = String(value || fallback).replace(/\s+/g, " ").trim();
  if (clean.length <= 180) return clean;
  return clean.slice(0, 177) + "...";
}

function buildHomieFamilyOpenFirstGuide(args: {
  memory: any;
  artifacts: any[];
  activeTitle: string;
  dailyRhythmLine: string;
}): HomieFamilyOpenFirstGuide {
  const generated = new Date().toLocaleString();
  const themes = homieOpenFirstLine(args.memory?.recentThemeText || "general", "general");
  const nextMove = homieOpenFirstLine(args.memory?.lastNextStep || args.dailyRhythmLine || "Start with one small check-in.");
  const activePanel = homieOpenFirstLine(args.activeTitle || "Homie", "Homie");
  const checkIns = Number(args.memory?.checkInCount || 0);
  const legacyCount = Number(args.memory?.legacyArtifactCount || (Array.isArray(args.artifacts) ? args.artifacts.length : 0) || 0);
  const savedPreview = Array.isArray(args.artifacts) && args.artifacts.length
    ? args.artifacts.slice(0, 4).map((item) => "• " + homieOpenFirstLine(item.title, "Family note") + " — " + homieOpenFirstLine(item.preview, "Saved family note"))
    : ["• No family notes are visible yet. Use Legacy note or Save for family when something matters."];

  const body = [
    "Open this first — FairlyOdd / Homie",
    "Generated: " + generated,
    "",
    "Dear family,",
    "",
    "This is a simple starting guide for FairlyOdd OS and Homie. You do not need developer context to use it. Treat this as a calm map, not a technical manual.",
    "",
    "What FairlyOdd OS is",
    "FairlyOdd OS is a home-and-life dashboard. It gathers useful panels in one place: family, money, creative work, routines, tools, and the pieces of everyday life that can feel scattered.",
    "",
    "What Homie is",
    "Homie is the warm companion lane inside the OS. Homie is not human, and Homie should not pretend to know things it cannot see. Homie can help with check-ins, grounding, voice, memory notes, family artifacts, and one small next move.",
    "",
    "What to click first",
    "1. Click Today for a gentle check-in: body, family, money, or creative.",
    "2. Click Timeline to see what has been built and what changed recently.",
    "3. Use Artifact Studio when you want a letter, memory note, life lesson, open-first note, or project status draft.",
    "4. Use Family export pack when you want one bundled file with the timeline, selected artifact, and saved notes.",
    "5. Use Self check or Voice details only when mic, speaker, or bridge behavior feels off.",
    "",
    "How to use the legacy tools",
    "Timeline: gives a calm review of recent Homie memory, saved family notes, the current mission thread, what changed today, and what to do next.",
    "Artifact Studio: turns the timeline into a cleaner family artifact. Preview it first, then export TXT or MD.",
    "Family export pack: bundles the timeline, selected artifact, and vault notes into one reviewable family file.",
    "Save for family: exports the latest family note as a plain text file and copies it when possible.",
    "",
    "Current Homie memory snapshot",
    "• Visible check-ins: " + checkIns,
    "• Visible family artifacts: " + legacyCount,
    "• Recent themes: " + themes,
    "• Current panel/thread: " + activePanel,
    "• Remembered next move: " + nextMove,
    "• Today prompt: " + args.dailyRhythmLine,
    "",
    "Saved family note preview",
    ...savedPreview,
    "",
    "Trust note",
    "Homie is summarizing local app memory and visible runtime state only. Homie is not claiming your family has read, approved, or confirmed anything unless someone says so. Please review important notes like human family documents before relying on them.",
    "",
    "Gentle next step",
    "Open Homie, click Today, then choose one thing: body, family, money, or creative. One small useful move is enough.",
  ].join("\n");

  const markdown = body
    .split("\n")
    .map((line, index) => {
      const trimmed = line.trim();
      if (index === 0) return "# " + trimmed;
      if (["What FairlyOdd OS is", "What Homie is", "What to click first", "How to use the legacy tools", "Current Homie memory snapshot", "Saved family note preview", "Trust note", "Gentle next step"].includes(trimmed)) return "## " + trimmed;
      return line;
    })
    .join("\n");

  return {
    title: "Open this first",
    body,
    markdown,
    filenameBase: "Homie_Open_This_First_" + getHomieDailyRhythmDayKey(),
    spokenText: "Open-this-first guide is ready. It explains FairlyOdd, Homie, what to click first, and how to use the family legacy tools without developer context.",
    createdAt: Date.now(),
  };
}
// ===== v10.36.30b Homie family onboarding README + open-first pack helpers END =====

// ===== v10.36.31 Homie family legacy quality review + human edit helpers =====
type HomieLegacyQualityReviewVerdict = "needs-human-edit" | "family-ready-draft";

type HomieLegacyQualityChecklistItem = {
  key: "true" | "kind" | "useful" | "understandable";
  label: string;
  ok: boolean;
  note: string;
};

type HomieLegacyQualityReview = {
  title: string;
  sourceLabel: string;
  verdict: HomieLegacyQualityReviewVerdict;
  checklist: HomieLegacyQualityChecklistItem[];
  body: string;
  cleanedText: string;
  markdown: string;
  filenameBase: string;
  spokenText: string;
  createdAt: number;
};

function isHomieLegacyQualityReviewPrompt(text: string) {
  const lower = text.trim().toLowerCase();
  return /\b(quality review|human edit|review latest|review this draft|review family draft|family-ready|family ready|needs human edit|need human edit|true kind useful|is this true|is this kind|is this useful|would my family understand|copy cleaned version|cleaned version|clean family version|final review)\b/.test(lower);
}

function homieQualityCleanText(text: any, fallback = "No draft text visible yet.") {
  return String(text || fallback).replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function homieQualityPreviewText(text: any, limit = 220) {
  const clean = homieQualityCleanText(text, "No draft text visible yet.").replace(/\s+/g, " ").trim();
  if (clean.length <= limit) return clean;
  return clean.slice(0, Math.max(0, limit - 3)) + "...";
}

function homieQualityChecklistLine(item: HomieLegacyQualityChecklistItem) {
  return (item.ok ? "✓ " : "Needs edit — ") + item.label + ": " + item.note;
}

function buildHomieLegacyQualityReview(args: {
  sourceLabel: string;
  sourceTitle: string;
  sourceText: string;
  memory: any;
  activeTitle: string;
  dailyRhythmLine: string;
}): HomieLegacyQualityReview {
  const sourceText = homieQualityCleanText(args.sourceText);
  const lower = sourceText.toLowerCase();
  const hasSource = sourceText.length > 80;
  const hasAbsoluteClaims = /\b(always|never|guaranteed|definitely|everyone will|nobody will|proof that|i know for sure)\b/i.test(sourceText);
  const hasTrustLanguage = /\b(review|confirm|local|visible|not claiming|trust note|human|edit)\b/i.test(sourceText);
  const hasHarshLanguage = /\b(stupid|idiot|worthless|hate|fault|blame|shame)\b/i.test(sourceText);
  const hasNextStep = /\b(click|start|review|save|open|use|next|today|timeline|artifact|pack|family)\b/i.test(sourceText);
  const tooTechnical = /\b(TypeScript|runtime import|tsx|vite|node\.js|stack trace|undefined|anchor not found|git push|npm --prefix)\b/i.test(sourceText);

  const checklist: HomieLegacyQualityChecklistItem[] = [
    {
      key: "true",
      label: "Is this true?",
      ok: hasSource && !hasAbsoluteClaims && hasTrustLanguage,
      note: hasSource ? (hasAbsoluteClaims ? "Soften absolute claims and add what needs confirmation." : hasTrustLanguage ? "Uses review/confirmation language instead of fake certainty." : "Add a short trust note about what Homie can and cannot know.") : "There is not enough draft text visible to review yet.",
    },
    {
      key: "kind",
      label: "Is this kind?",
      ok: hasSource && !hasHarshLanguage,
      note: hasHarshLanguage ? "Remove blame/shame language before family use." : "Tone looks gentle enough for a family-facing draft.",
    },
    {
      key: "useful",
      label: "Is this useful?",
      ok: hasSource && hasNextStep,
      note: hasNextStep ? "Includes practical next steps or what to click/use." : "Add one clear next step so the family knows what to do.",
    },
    {
      key: "understandable",
      label: "Would my family understand it?",
      ok: hasSource && !tooTechnical && sourceText.length < 9000,
      note: tooTechnical ? "Remove developer/debug language before family use." : sourceText.length >= 9000 ? "Shorten the draft before giving it to family." : "Language looks understandable without developer context.",
    },
  ];

  const familyReady = checklist.every((item) => item.ok);
  const verdict: HomieLegacyQualityReviewVerdict = familyReady ? "family-ready-draft" : "needs-human-edit";
  const verdictLine = familyReady
    ? "Family-ready draft — still review like a human document before final use."
    : "Needs human edit — do not treat this as final yet.";
  const sourceLabel = args.sourceLabel || "latest family draft";
  const sourceTitle = args.sourceTitle || "Family draft";
  const generated = new Date().toLocaleString();
  const themes = homieQualityPreviewText(args.memory?.recentThemeText || "general", 120);
  const nextMove = homieQualityPreviewText(args.memory?.lastNextStep || args.dailyRhythmLine || "Choose one small next move.", 160);

  const cleanedText = [
    "Family legacy draft — human-edited copy",
    "Source: " + sourceLabel + " / " + sourceTitle,
    "Generated: " + generated,
    "Verdict: " + verdictLine,
    "",
    "Human edit checklist:",
    ...checklist.map(homieQualityChecklistLine),
    "",
    "Cleaned family draft:",
    sourceText,
    "",
    "Final human review reminder:",
    "Before sharing this with family, read it once out loud. Keep what is true, kind, useful, and easy to understand. Edit anything that needs human context.",
  ].join("\n");

  const body = [
    "Family legacy quality review",
    "",
    "Source: " + sourceLabel + " — " + sourceTitle,
    "Verdict: " + verdictLine,
    "",
    "Checklist:",
    ...checklist.map(homieQualityChecklistLine),
    "",
    "Current memory context:",
    "• Active panel/thread: " + homieQualityPreviewText(args.activeTitle || "Homie", 120),
    "• Recent themes: " + themes,
    "• Remembered next move: " + nextMove,
    "",
    "Preview of draft being reviewed:",
    homieQualityPreviewText(sourceText, 700),
    "",
    "Trust note: this review is a helper pass over visible Homie draft text. It cannot know private family context unless you add it.",
  ].join("\n");

  const markdown = cleanedText
    .split("\n")
    .map((line, index) => {
      const trimmed = line.trim();
      if (index === 0) return "# " + trimmed;
      if (["Human edit checklist:", "Cleaned family draft:", "Final human review reminder:"].includes(trimmed)) return "## " + trimmed.replace(/:$/, "");
      return line;
    })
    .join("\n");

  return {
    title: "Family quality review",
    sourceLabel,
    verdict,
    checklist,
    body,
    cleanedText,
    markdown,
    filenameBase: "Homie_Family_Quality_Review_" + getHomieDailyRhythmDayKey(),
    spokenText: familyReady
      ? "Family quality review is ready. It looks family-ready as a draft, but still needs one human read before final use."
      : "Family quality review is ready. This one needs a human edit before it becomes final.",
    createdAt: Date.now(),
  };
}
// ===== v10.36.31 Homie family legacy quality review + human edit helpers END =====

// ===== v10.36.32b Homie legacy final pack index + manifest helpers =====
type HomieLegacyFinalManifest = {
  title: string;
  body: string;
  markdown: string;
  filenameBase: string;
  spokenText: string;
  createdAt: number;
};

function isHomieLegacyFinalManifestPrompt(text: string) {
  const lower = text.trim().toLowerCase();
  return /\b(final family index|family final index|final index|final manifest|family manifest|legacy manifest|pack index|final pack index|generate final index|create final index|what files should exist|read this first then timeline|final family packet|family file list)\b/.test(lower);
}

function homieManifestCleanLine(value: any, fallback = "Not generated yet") {
  const clean = String(value || fallback).replace(/\s+/g, " ").trim();
  if (clean.length <= 190) return clean;
  return clean.slice(0, 187) + "...";
}

function homieManifestFileLine(label: string, filenameBase: string, formats = "TXT / MD") {
  const cleanBase = homieManifestCleanLine(filenameBase, "Generate this item first");
  return "• " + label + ": " + cleanBase + " (" + formats + ")";
}

function buildHomieLegacyFinalManifest(args: {
  openFirst: HomieFamilyOpenFirstGuide;
  timeline: HomieLegacyTimelineReview;
  artifact: HomieLegacyArtifactStudioPreview;
  quality: HomieLegacyQualityReview;
  pack: HomieFamilyLegacyExportPack;
  memory: any;
  activeTitle: string;
  dailyRhythmLine: string;
}): HomieLegacyFinalManifest {
  const generated = new Date().toLocaleString();
  const day = getHomieDailyRhythmDayKey();
  const themes = homieManifestCleanLine(args.memory?.recentThemeText || "general", "general");
  const nextMove = homieManifestCleanLine(args.memory?.lastNextStep || args.dailyRhythmLine || "Choose one small next move.");
  const activePanel = homieManifestCleanLine(args.activeTitle || "Homie", "Homie");
  const qualityVerdict = args.quality?.verdict === "family-ready-draft" ? "Family-ready draft after one human read" : "Needs human edit before final use";
  const checklistLines = Array.isArray(args.quality?.checklist)
    ? args.quality.checklist.map((item) => "• " + (item.ok ? "✓" : "Needs edit") + " — " + item.label + " " + item.note)
    : ["• Run Family quality review before final sharing."];

  const expectedFiles = [
    homieManifestFileLine("Open This First", args.openFirst?.filenameBase || "Homie_Open_This_First_" + day, "TXT / MD"),
    "• Timeline: Homie_Legacy_Timeline_" + day + ".txt (TXT)",
    homieManifestFileLine("Selected Artifact", args.artifact?.filenameBase || "Homie_selected_artifact_" + day, "TXT / MD"),
    homieManifestFileLine("Quality Review", args.quality?.filenameBase || "Homie_Family_Quality_Review_" + day, "TXT / MD"),
    homieManifestFileLine("Family Export Pack", args.pack?.filenameBase || "Homie_Family_Legacy_Export_Pack_" + day, "TXT / MD"),
  ];

  const body = [
    "Final Family Legacy Pack Index",
    "Generated: " + generated,
    "",
    "Purpose",
    "This index is the simple front door for the family legacy files. It tells someone what to open first, what each file is for, and what still needs human review.",
    "",
    "Expected files",
    ...expectedFiles,
    "",
    "Reading order",
    "1. Read Open This First.",
    "2. Then read the Timeline for context.",
    "3. Then read the Selected Artifact, like the letter, memory note, life lesson, open-first note, or project status.",
    "4. Then read the Quality Review notes before treating anything as final.",
    "5. Then read or save the Family Export Pack as the bundled copy.",
    "",
    "Human review checklist",
    "[ ] Human edited?",
    "[ ] Checked for truth?",
    "[ ] Checked for kindness?",
    "[ ] Checked for usefulness?",
    "[ ] Easy for the family to understand?",
    "[ ] Saved somewhere the family can actually find?",
    "[ ] Shared only after a human has reviewed it?",
    "",
    "Latest quality review verdict",
    qualityVerdict,
    "",
    "Quality checklist notes",
    ...checklistLines,
    "",
    "Current Homie context",
    "• Active panel/thread: " + activePanel,
    "• Recent themes: " + themes,
    "• Remembered next move: " + nextMove,
    "• Daily rhythm: " + args.dailyRhythmLine,
    "",
    "What this pack includes",
    "• Open First guide: " + homieManifestCleanLine(args.openFirst?.title, "Open this first"),
    "• Timeline summary: " + homieManifestCleanLine(args.timeline?.displayText || args.timeline?.exportText, "Timeline ready"),
    "• Selected artifact: " + homieManifestCleanLine(args.artifact?.title, "Selected artifact"),
    "• Quality review: " + homieManifestCleanLine(args.quality?.title, "Quality review"),
    "• Export pack: " + homieManifestCleanLine(args.pack?.title, "Family export pack"),
    "",
    "Trust note",
    "Homie is organizing local app memory, visible draft previews, and review helpers. Homie is not claiming these files are complete, emotionally perfect, or family-approved. A human should read, edit, and confirm the final version.",
    "",
    "Gentle next step",
    "Export the index, then export the five files listed above. Keep them together in one folder named Family Legacy Pack.",
  ].join("\n");

  const markdown = body
    .split("\n")
    .map((line, index) => {
      const trimmed = line.trim();
      if (index === 0) return "# " + trimmed;
      if (["Purpose", "Expected files", "Reading order", "Human review checklist", "Latest quality review verdict", "Quality checklist notes", "Current Homie context", "What this pack includes", "Trust note", "Gentle next step"].includes(trimmed)) return "## " + trimmed;
      return line;
    })
    .join("\n");

  return {
    title: "Final Family Legacy Pack Index",
    body,
    markdown,
    filenameBase: "Homie_Final_Family_Legacy_Pack_Index_" + day,
    spokenText: "Final family index is ready. It lists the files, the reading order, the human-edited checklist, and the trust note.",
    createdAt: Date.now(),
  };
}
// ===== v10.36.32b Homie legacy final pack index + manifest helpers END =====

// ===== v10.36.33d Homie one-click family folder export helpers =====
type HomieLegacyFamilyFolderFile = {
  name: string;
  text: string;
  description: string;
};

type HomieLegacyFamilyFolderExportPreview = {
  title: string;
  body: string;
  markdown: string;
  filenameBase: string;
  spokenText: string;
  files: HomieLegacyFamilyFolderFile[];
  createdAt: number;
};

function isHomieLegacyFamilyFolderExportPrompt(text: string) {
  const lower = text.trim().toLowerCase();
  return /\b(build family folder|family folder|legacy folder|one click family|one-click family|download family folder|export family folder|family legacy folder|zip family pack|zip legacy pack|build legacy folder|create family folder|bundle all family files|all family docs)\b/.test(lower);
}

function homieFolderCleanLine(value: any, fallback = "Not generated yet") {
  const clean = String(value || fallback).replace(/\s+/g, " ").trim();
  if (clean.length <= 220) return clean;
  return clean.slice(0, 217) + "...";
}

function homieFolderMarkdownTitle(title: string) {
  const clean = String(title || "Family legacy file").replace(/\s+/g, " ").trim();
  return clean.startsWith("#") ? clean : "# " + clean;
}

function buildHomieLegacyFamilyFolderPreview(args: {
  files: HomieLegacyFamilyFolderFile[];
  openFirst: HomieFamilyOpenFirstGuide;
  artifact: HomieLegacyArtifactStudioPreview;
  quality: HomieLegacyQualityReview;
  pack: HomieFamilyLegacyExportPack;
  manifest: HomieLegacyFinalManifest;
  memory: any;
  activeTitle: string;
  dailyRhythmLine: string;
}): HomieLegacyFamilyFolderExportPreview {
  const day = getHomieDailyRhythmDayKey();
  const generated = new Date().toLocaleString();
  const fileLines = args.files.map((file, index) => "• " + String(index + 1).padStart(2, "0") + " — " + file.name + ": " + file.description);
  const qualityVerdict = args.quality?.verdict === "family-ready-draft" ? "Family-ready draft after one human read" : "Needs human edit before final use";
  const themes = homieFolderCleanLine(args.memory?.recentThemeText || "general", "general");
  const nextMove = homieFolderCleanLine(args.memory?.lastNextStep || args.dailyRhythmLine || "Choose one small next move.");

  const body = [
    "Homie One-Click Family Folder",
    "Generated: " + generated,
    "",
    "What this does",
    "This one action prepares the family-facing legacy documents together so they can be saved in one folder and opened without developer context.",
    "",
    "Files included",
    ...fileLines,
    "",
    "Suggested folder name",
    "Family_Legacy_Pack_" + day,
    "",
    "Reading order",
    "1. Open 01_Open_This_First first.",
    "2. Read 02_Legacy_Timeline for context.",
    "3. Read 03_Selected_Artifact as the main family draft.",
    "4. Read 04_Quality_Review before treating anything as final.",
    "5. Keep 05_Family_Export_Pack as the bundled copy.",
    "6. Use 06_Final_Index as the file map.",
    "",
    "Current quality verdict",
    qualityVerdict,
    "",
    "Current Homie context",
    "• Active panel/thread: " + homieFolderCleanLine(args.activeTitle || "Homie", "Homie"),
    "• Recent themes: " + themes,
    "• Remembered next move: " + nextMove,
    "• Daily rhythm: " + args.dailyRhythmLine,
    "",
    "Human review reminder",
    "[ ] Human edited?",
    "[ ] True?",
    "[ ] Kind?",
    "[ ] Useful?",
    "[ ] Easy for the family to understand?",
    "[ ] Saved somewhere the family can actually find?",
    "",
    "Trust note",
    "Homie is bundling local app memory, visible drafts, generated exports, and review helpers. Homie is not claiming these files are final, family-approved, or emotionally perfect. A human should read and edit the final copy.",
  ].join("\n");

  const markdown = body
    .split("\n")
    .map((line, index) => {
      const trimmed = line.trim();
      if (index === 0) return homieFolderMarkdownTitle(trimmed);
      if (["What this does", "Files included", "Suggested folder name", "Reading order", "Current quality verdict", "Current Homie context", "Human review reminder", "Trust note"].includes(trimmed)) return "## " + trimmed;
      return line;
    })
    .join("\n");

  return {
    title: "One-click family folder",
    body,
    markdown,
    filenameBase: "Homie_Family_Legacy_Folder_" + day,
    spokenText: "Family folder is ready. I bundled the open-first guide, timeline, artifact, quality review, export pack, and final index into one family-ready folder package.",
    files: args.files,
    createdAt: Date.now(),
  };
}
// ===== v10.36.33d Homie one-click family folder export helpers END =====


// v10.36.63 checker-safe marker: Homie Buddy big-stage full-body companion avatar installed
// v10.36.66b checker-safe marker: true camera preview and launcher gate installed
// v10.36.67 checker-safe marker: mic reality and camera-not-a-mic guidance installed
// v10.36.68 checker-safe marker: mic proof meter and normal companion mode installed
// v10.36.70 checker-safe marker: direct browser voice bridge fallback installed
// v10.36.70b checker-safe marker: visible bridge switch and direct browser fallback installed
// v10.36.72b checker-safe marker: bridge dedupe repair installed
// v10.36.73c checker-safe marker: bridge launcher and say test crash hotfix installed
// v10.36.77 checker-safe marker: direct bridge probe/transcribe and bridge-required dead-end fix installed
function HomieBuddyHumanAvatar() {
  return (
    <div className="homieBuddyHumanAvatarStage" aria-label="Human-inspired Homie companion avatar">
      <div className="homieBuddyHumanCap" />
      <div className="homieBuddyHumanEar left" />
      <div className="homieBuddyHumanEar right" />
      <div className="homieBuddyHumanHead" />
      <div className="homieBuddyHumanBrow left" />
      <div className="homieBuddyHumanBrow right" />
      <div className="homieBuddyHumanGlasses">
        <div className="homieBuddyHumanBridge" />
      </div>
      <div className="homieBuddyHumanEye left" />
      <div className="homieBuddyHumanEye right" />
      <div className="homieBuddyHumanBeard" />
      <div className="homieBuddyHumanSmile" />
      <div className="homieBuddyHumanBody" />
      <div className="homieBuddyHumanCore" />
      <div className="homieBuddyHumanHand left" />
      <div className="homieBuddyHumanHand right" />
      <div className="homieBuddyHumanLabel">HOMIE</div>
    </div>
  );
}
function getHomieLivingPresenceState(args: { isListening?: boolean; isSpeaking?: boolean; mood?: string; status?: string; activeTitle?: string }) {
  const text = `${args.status || ""} ${args.activeTitle || ""}`.toLowerCase();
  if (args.isListening) return "listening";
  if (args.isSpeaking) return "speaking";
  if (text.includes("legacy") || text.includes("open first") || text.includes("family")) return "legacy";
  if (args.mood === "warn" || text.includes("care") || text.includes("overwhelm") || text.includes("tired")) return "caring";
  if (text.includes("checking") || text.includes("thinking") || text.includes("bridge")) return "thinking";
  return "idle";
}

function getHomieVoiceWarmthLine(args: { isListening?: boolean; isSpeaking?: boolean; diagnostics?: any; voiceModeLabel?: string }) {
  const permission = args.diagnostics?.permissionState || "unknown";
  if (args.isListening) return "Mic is ready. Say one short sentence and I will stay with you.";
  if (args.isSpeaking) return "Voice output is active. I am talking now.";
  if (permission === "granted") return "Mic is ready when you want it. Typed mode is safe too.";
  if (permission === "denied") return "Mic is blocked. Typed mode is safe, and you can re-enable mic permission when ready.";
  return "Bridge is checking. Typed mode is safe while I verify voice and mic.";
}
function homieBuddyReadRoutineReceipts() {
  try {
    const raw = localStorage.getItem("oddengine:homie:routine-receipts:v1");
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(0, 12) : [];
  } catch {
    return [];
  }
}

function homieBuddyAddRoutineReceipt(kind: string, title: string, detail: string) {
  const receipt = { id: `buddy_receipt_${Date.now()}_${kind}`, kind, title, detail, createdAt: Date.now() };
  try {
    const next = [receipt, ...homieBuddyReadRoutineReceipts()].slice(0, 50);
    localStorage.setItem("oddengine:homie:routine-receipts:v1", JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("homie:routine-receipts-updated"));
  } catch {}
}

function buildHomieBuddyRoutineSummary() {
  const latest = homieBuddyReadRoutineReceipts()[0];
  if (!latest) return "No routine receipt yet.";
  return `${latest.title}: ${latest.detail}`;
}
function readHomieMoodLedgerForBuddy() { try { const raw = localStorage.getItem("oddengine:homie:mood-ledger:v1"); const parsed = raw ? JSON.parse(raw) : []; return Array.isArray(parsed) ? parsed.slice(0, 12) : []; } catch { return []; } }
function buildHomieBuddyMoodSummary() { const entries = readHomieMoodLedgerForBuddy(); const latest = entries[0]; if (!latest) return "No local check-in saved yet."; const themes = Array.isArray(latest.themes) ? latest.themes.join(", ") : latest.lane || "next move"; return `Last check-in: ${latest.lane || "check-in"} - ${themes}.`; }
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
  const [status, setStatus] = useState("Homie is here with you: warm, steady, and here to remember what matters.");
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
  const [dailyRhythm, setDailyRhythm] = useState<HomieDailyRhythmState>(() => loadHomieDailyRhythmState());
  const [legacyArtifactStudioType, setLegacyArtifactStudioType] = useState<HomieLegacyArtifactStudioType>("letter");
  const [legacyArtifactPreview, setLegacyArtifactPreview] = useState<HomieLegacyArtifactStudioPreview | null>(null);
  const [legacyExportPackPreview, setLegacyExportPackPreview] = useState<HomieFamilyLegacyExportPack | null>(null);
  const [openFirstGuidePreview, setOpenFirstGuidePreview] = useState<HomieFamilyOpenFirstGuide | null>(null);
  const [legacyQualityReview, setLegacyQualityReview] = useState<HomieLegacyQualityReview | null>(null);
  const [legacyFinalManifestPreview, setLegacyFinalManifestPreview] = useState<HomieLegacyFinalManifest | null>(null);
  const [legacyFamilyFolderPreview, setLegacyFamilyFolderPreview] = useState<HomieLegacyFamilyFolderExportPreview | null>(null);
  const [legacyFamilyFolderExportStatus, setLegacyFamilyFolderExportStatus] = useState("Family folder ZIP has not run yet.");
  const [homieCameraPresenceStatus, setHomieCameraPresenceStatus] = useState("Camera is off. Camera is visual only; use mic buttons for hearing. No video is saved.");
  const [homieMicProofStatus, setHomieMicProofStatus] = useState("Mic proof has not run yet.");
  const [homieMicLevel, setHomieMicLevel] = useState(0);
  const [homieMicPeak, setHomieMicPeak] = useState(0);
  const [homieCameraLive, setHomieCameraLive] = useState(false);
  const [homieCameraSignal, setHomieCameraSignal] = useState("Camera preview is off. Camera is visual only; Homie is not listening through it.");
  const homieCameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const homieCameraCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const homieCameraStreamRef = useRef<MediaStream | null>(null);
  const homieCameraSampleTimerRef = useRef<number | null>(null);
  const homieCameraLastBrightnessRef = useRef<number | null>(null);
  const homieMicProofStreamRef = useRef<MediaStream | null>(null);
  const homieMicProofAudioCtxRef = useRef<AudioContext | null>(null);
  const homieMicProofRafRef = useRef<number | null>(null);
  const homieMicProofTimerRef = useRef<number | null>(null);
  const homieMicProofPeakRef = useRef(0);
  const homieMicProofActiveRef = useRef(false);

  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<any>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaChunksRef = useRef<BlobPart[]>([]);
  const activeVoicePathRef = useRef<"cloud" | "external">("cloud");
  const externalRecordingStartedAtRef = useRef(0);
  const externalStopTimerRef = useRef<number | null>(null);
  const voiceStartLockRef = useRef(false);
  const lastExternalProbeRef = useRef<HomieExternalProbeCache | null>(null);

  const reduceMotion = useMemo(() => {
    try {
      return !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      setLegacyFamilyFolderExportStatus("ZIP fallback used: exported files one by one.");
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
  const dailyRhythmLine = buildHomieDailyRhythmLine(dailyRhythm, companionMemory);

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
    applyHomiePremiumWarmTtsStyle(utterance);
    applyHomieWarmTtsStyle(utterance);
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


  function updateDailyRhythm(partial: HomieDailyRhythmState) {
    setDailyRhythm((prev) => {
      const next = saveHomieDailyRhythmState({ ...prev, ...partial });
      return next;
    });
  }

  function runHomieDailyRhythmCheck(source: "typed" | "voice" | "quick" = "quick", prompt?: string) {
    const day = getHomieDailyRhythmDayKey();
    const rhythmPrompt = prompt?.trim() || buildHomieDailyRhythmPrompt(activeTitle);
    const ctx = { activePanelTitle: activeTitle, activePanelId, status, mood, source };
    const reply = buildHomieCompanionReply(rhythmPrompt, ctx);
    appendCompanionMessages([
      createHomieMessage("user", rhythmPrompt, source),
      createHomieMessage("homie", reply.text, source),
    ]);
    updateDailyRhythm({ lastPromptDay: day, lastCheckInDay: day, lastPromptAt: Date.now() });
    setCompanionMemory(getHomieCompanionMemorySnapshot());
    setLegacyArtifactSummaries(getHomieLegacyArtifactSummaries(4));
    announce(reply.text, reply.mood, source === "voice" || voiceEnabled, trimForSpeech(reply.spokenText || reply.text));
    return true;
  }

  function buildCurrentHomieLegacyTimeline() {
    return buildHomieLegacyTimelineReview({
      messages: companionMessages,
      memory: companionMemory,
      artifacts: legacyArtifactSummaries,
      dailyRhythm,
      activeTitle,
      status,
      dailyRhythmLine,
    });
  }

  function runHomieLegacyTimelineReview(source: "typed" | "voice" | "quick" = "quick", prompt = "Homie, show the legacy timeline", exportAfter = false) {
    const timeline = buildCurrentHomieLegacyTimeline();
    appendCompanionMessages([
      createHomieMessage("user", prompt, source),
      createHomieMessage("homie", timeline.displayText, source),
    ]);
    announce(timeline.displayText, "good", source === "voice" || voiceEnabled, timeline.spokenText);
    if (exportAfter) {
      const stamp = new Date().toISOString().slice(0, 10);
      downloadTextFile("Homie_Legacy_Timeline_" + stamp + ".txt", timeline.exportText);
    }
    return timeline;
  }

  function exportHomieLegacyTimeline() {
    const timeline = buildCurrentHomieLegacyTimeline();
    const stamp = new Date().toISOString().slice(0, 10);
    downloadTextFile("Homie_Legacy_Timeline_" + stamp + ".txt", timeline.exportText);
    try {
      void navigator.clipboard?.writeText(timeline.exportText);
    } catch {
      // ignore
    }
    announce("Exported the family legacy timeline and copied it too.", "good", true, "Exported the family legacy timeline.");
  }


  function buildCurrentHomieLegacyArtifactStudioPreview(type: HomieLegacyArtifactStudioType = legacyArtifactStudioType) {
    return buildHomieFamilyLegacyArtifactStudioPreview({
      type,
      timeline: buildCurrentHomieLegacyTimeline(),
      memory: companionMemory,
      activeTitle,
      dailyRhythmLine,
    });
  }

  function runHomieLegacyArtifactStudio(type: HomieLegacyArtifactStudioType = legacyArtifactStudioType, source: "typed" | "voice" | "quick" = "quick", prompt = "Homie, preview a family legacy artifact") {
    const preview = buildCurrentHomieLegacyArtifactStudioPreview(type);
    setLegacyArtifactStudioType(preview.type);
    setLegacyArtifactPreview(preview);
    appendCompanionMessages([
      createHomieMessage("user", prompt, source),
      createHomieMessage("homie", "Artifact studio preview ready: " + preview.title + "\n\n" + preview.body, source),
    ]);
    announce("Artifact studio preview ready: " + preview.title, "good", source === "voice" || voiceEnabled, preview.spokenText);
    return preview;
  }

  function exportHomieLegacyArtifactStudio(format: "txt" | "md" = "txt") {
    const preview = legacyArtifactPreview || buildCurrentHomieLegacyArtifactStudioPreview(legacyArtifactStudioType);
    setLegacyArtifactPreview(preview);
    const isMarkdown = format === "md";
    const text = isMarkdown ? preview.markdown : preview.body;
    const filename = preview.filenameBase + (isMarkdown ? ".md" : ".txt");
    downloadTextFile(filename, text);
    try {
      void navigator.clipboard?.writeText(text);
    } catch {
      // ignore
    }
    announce("Exported the family artifact preview as " + (isMarkdown ? "Markdown." : "text."), "good", true, isMarkdown ? "Exported as markdown." : "Exported as text.");
  }


  function buildCurrentHomieFamilyLegacyExportPack(artifact: HomieLegacyArtifactStudioPreview | null = legacyArtifactPreview || buildCurrentHomieLegacyArtifactStudioPreview(legacyArtifactStudioType)) {
    return buildHomieFamilyLegacyExportPack({
      timeline: buildCurrentHomieLegacyTimeline(),
      artifact,
      memory: companionMemory,
      artifacts: legacyArtifactSummaries,
      notesText: exportHomieLegacyArtifactText(),
      activeTitle,
      dailyRhythmLine,
    });
  }

  function runHomieFamilyLegacyExportPack(source: "typed" | "voice" | "quick" = "quick", prompt = "Homie, build the family legacy export pack", exportAfter = false) {
    const artifact = legacyArtifactPreview || buildCurrentHomieLegacyArtifactStudioPreview(legacyArtifactStudioType);
    if (!legacyArtifactPreview) setLegacyArtifactPreview(artifact);
    const pack = buildCurrentHomieFamilyLegacyExportPack(artifact);
    setLegacyExportPackPreview(pack);
    appendCompanionMessages([
      createHomieMessage("user", prompt, source),
      createHomieMessage("homie", pack.body, source),
    ]);
    announce("Family legacy export pack preview ready.", "good", source === "voice" || voiceEnabled, pack.spokenText);
    if (exportAfter) exportHomieFamilyLegacyPack("txt", pack);
    return pack;
  }

  function exportHomieFamilyLegacyPack(format: "txt" | "md" = "txt", forcedPack?: HomieFamilyLegacyExportPack) {
    const artifact = legacyArtifactPreview || buildCurrentHomieLegacyArtifactStudioPreview(legacyArtifactStudioType);
    if (!legacyArtifactPreview) setLegacyArtifactPreview(artifact);
    const pack = forcedPack || legacyExportPackPreview || buildCurrentHomieFamilyLegacyExportPack(artifact);
    setLegacyExportPackPreview(pack);
    const isMarkdown = format === "md";
    const text = isMarkdown ? pack.markdown : pack.body;
    const filename = pack.filenameBase + (isMarkdown ? ".md" : ".txt");
    downloadTextFile(filename, text);
    try {
      void navigator.clipboard?.writeText(text);
    } catch {
      // ignore
    }
    announce("Exported the family legacy pack as " + (isMarkdown ? "Markdown." : "text."), "good", true, isMarkdown ? "Exported the pack as markdown." : "Exported the pack as text.");
  }

  function buildCurrentHomieFamilyOpenFirstGuide() {
    return buildHomieFamilyOpenFirstGuide({
      memory: companionMemory,
      artifacts: legacyArtifactSummaries,
      activeTitle,
      dailyRhythmLine,
    });
  }

  function runHomieFamilyOpenFirstGuide(source: "typed" | "voice" | "quick" = "quick", prompt = "Homie, build the open-this-first family guide", exportAfter = false) {
    const guide = buildCurrentHomieFamilyOpenFirstGuide();
    setOpenFirstGuidePreview(guide);
    appendCompanionMessages([
      createHomieMessage("user", prompt, source),
      createHomieMessage("homie", guide.body, source),
    ]);
    announce("Open-this-first guide is ready.", "good", source === "voice" || voiceEnabled, guide.spokenText);
    if (exportAfter) exportHomieFamilyOpenFirstGuide("txt", guide);
    return guide;
  }

  function exportHomieFamilyOpenFirstGuide(format: "txt" | "md" = "txt", forcedGuide?: HomieFamilyOpenFirstGuide) {
    const guide = forcedGuide || openFirstGuidePreview || buildCurrentHomieFamilyOpenFirstGuide();
    setOpenFirstGuidePreview(guide);
    const isMarkdown = format === "md";
    const text = isMarkdown ? guide.markdown : guide.body;
    const filename = guide.filenameBase + (isMarkdown ? ".md" : ".txt");
    downloadTextFile(filename, text);
    try {
      void navigator.clipboard?.writeText(text);
    } catch {
      // ignore
    }
    announce("Exported the open-this-first guide as " + (isMarkdown ? "Markdown." : "text."), "good", true, isMarkdown ? "Exported the guide as markdown." : "Exported the guide as text.");
  }


  function buildCurrentHomieLegacyQualityReview() {
    let sourceLabel = "Open First guide";
    let sourceTitle = "Open this first";
    let sourceText = "";

    if (legacyExportPackPreview) {
      sourceLabel = "Family export pack";
      sourceTitle = legacyExportPackPreview.title;
      sourceText = legacyExportPackPreview.body;
    } else if (legacyArtifactPreview) {
      sourceLabel = "Artifact Studio draft";
      sourceTitle = legacyArtifactPreview.title;
      sourceText = legacyArtifactPreview.body;
    } else if (openFirstGuidePreview) {
      sourceLabel = "Open First guide";
      sourceTitle = openFirstGuidePreview.title;
      sourceText = openFirstGuidePreview.body;
    } else {
      const guide = buildCurrentHomieFamilyOpenFirstGuide();
      setOpenFirstGuidePreview(guide);
      sourceLabel = "Open First guide";
      sourceTitle = guide.title;
      sourceText = guide.body;
    }

    return buildHomieLegacyQualityReview({
      sourceLabel,
      sourceTitle,
      sourceText,
      memory: companionMemory,
      activeTitle,
      dailyRhythmLine,
    });
  }

  function runHomieLegacyQualityReview(source: "typed" | "voice" | "quick" = "quick", prompt = "Homie, review the family draft") {
    const review = buildCurrentHomieLegacyQualityReview();
    setLegacyQualityReview(review);
    appendCompanionMessages([
      createHomieMessage("user", prompt, source),
      createHomieMessage("homie", review.body, source),
    ]);
    announce(review.verdict === "family-ready-draft" ? "Family quality review: family-ready draft." : "Family quality review: needs human edit.", review.verdict === "family-ready-draft" ? "good" : "warn", source === "voice" || voiceEnabled, review.spokenText);
    return review;
  }

  function copyHomieLegacyQualityCleanedVersion(forcedReview?: HomieLegacyQualityReview) {
    const review = forcedReview || legacyQualityReview || buildCurrentHomieLegacyQualityReview();
    setLegacyQualityReview(review);
    try {
      void navigator.clipboard?.writeText(review.cleanedText);
    } catch {
      // ignore
    }
    announce("Copied the cleaned family draft for human editing.", "good", true, "Copied the cleaned family draft.");
  }

  function exportHomieLegacyQualityCleanedVersion(format: "txt" | "md" = "txt", forcedReview?: HomieLegacyQualityReview) {
    const review = forcedReview || legacyQualityReview || buildCurrentHomieLegacyQualityReview();
    setLegacyQualityReview(review);
    const isMarkdown = format === "md";
    const text = isMarkdown ? review.markdown : review.cleanedText;
    const filename = review.filenameBase + (isMarkdown ? ".md" : ".txt");
    downloadTextFile(filename, text);
    try {
      void navigator.clipboard?.writeText(text);
    } catch {
      // ignore
    }
    announce("Exported the cleaned family review as " + (isMarkdown ? "Markdown." : "text."), "good", true, isMarkdown ? "Exported cleaned markdown." : "Exported cleaned text.");
  }

  function buildCurrentHomieLegacyFinalManifestBundle() {
    const openFirst = openFirstGuidePreview || buildCurrentHomieFamilyOpenFirstGuide();
    const artifact = legacyArtifactPreview || buildCurrentHomieLegacyArtifactStudioPreview(legacyArtifactStudioType);
    const pack = legacyExportPackPreview || buildCurrentHomieFamilyLegacyExportPack(artifact);
    const quality = legacyQualityReview || buildHomieLegacyQualityReview({
      sourceLabel: "Family export pack",
      sourceTitle: pack.title,
      sourceText: pack.body,
      memory: companionMemory,
      activeTitle,
      dailyRhythmLine,
    });
    const manifest = buildHomieLegacyFinalManifest({
      openFirst,
      timeline: buildCurrentHomieLegacyTimeline(),
      artifact,
      quality,
      pack,
      memory: companionMemory,
      activeTitle,
      dailyRhythmLine,
    });
    return { openFirst, artifact, pack, quality, manifest };
  }

  function runHomieLegacyFinalManifest(source: "typed" | "voice" | "quick" = "quick", prompt = "Homie, generate the final family index", exportAfter = false) {
    const bundle = buildCurrentHomieLegacyFinalManifestBundle();
    if (!openFirstGuidePreview) setOpenFirstGuidePreview(bundle.openFirst);
    if (!legacyArtifactPreview) setLegacyArtifactPreview(bundle.artifact);
    if (!legacyExportPackPreview) setLegacyExportPackPreview(bundle.pack);
    if (!legacyQualityReview) setLegacyQualityReview(bundle.quality);
    setLegacyFinalManifestPreview(bundle.manifest);
    appendCompanionMessages([
      createHomieMessage("user", prompt, source),
      createHomieMessage("homie", bundle.manifest.body, source),
    ]);
    announce("Final family index is ready.", "good", source === "voice" || voiceEnabled, bundle.manifest.spokenText);
    if (exportAfter) exportHomieLegacyFinalManifest("txt", bundle.manifest);
    return bundle.manifest;
  }

  function exportHomieLegacyFinalManifest(format: "txt" | "md" = "txt", forcedManifest?: HomieLegacyFinalManifest) {
    const manifest = forcedManifest || legacyFinalManifestPreview || buildCurrentHomieLegacyFinalManifestBundle().manifest;
    setLegacyFinalManifestPreview(manifest);
    const isMarkdown = format === "md";
    const text = isMarkdown ? manifest.markdown : manifest.body;
    const filename = manifest.filenameBase + (isMarkdown ? ".md" : ".txt");
    downloadTextFile(filename, text);
    try {
      void navigator.clipboard?.writeText(text);
    } catch {
      // ignore
    }
    announce("Exported the final family index as " + (isMarkdown ? "Markdown." : "text."), "good", true, isMarkdown ? "Exported final index markdown." : "Exported final index text.");
  }


  function buildCurrentHomieLegacyFamilyFolderBundle() {
    const timeline = buildCurrentHomieLegacyTimeline();
    const openFirst = openFirstGuidePreview || buildCurrentHomieFamilyOpenFirstGuide();
    const artifact = legacyArtifactPreview || buildCurrentHomieLegacyArtifactStudioPreview(legacyArtifactStudioType);
    const pack = legacyExportPackPreview || buildCurrentHomieFamilyLegacyExportPack(artifact);
    const quality = buildHomieLegacyQualityReview({
      sourceLabel: "Family export pack",
      sourceTitle: pack.title,
      sourceText: pack.body,
      memory: companionMemory,
      activeTitle,
      dailyRhythmLine,
    });
    const manifest = buildHomieLegacyFinalManifest({
      openFirst,
      timeline,
      artifact,
      quality,
      pack,
      memory: companionMemory,
      activeTitle,
      dailyRhythmLine,
    });
    const files: HomieLegacyFamilyFolderFile[] = [
      { name: "01_Open_This_First.txt", text: openFirst.body, description: "Plain-language starting guide for FairlyOdd and Homie." },
      { name: "01_Open_This_First.md", text: openFirst.markdown, description: "Markdown copy of the starting guide." },
      { name: "02_Legacy_Timeline.txt", text: timeline.exportText, description: "Timeline and current mission context." },
      { name: "03_Selected_Artifact.txt", text: artifact.body, description: "The selected family artifact draft." },
      { name: "03_Selected_Artifact.md", text: artifact.markdown, description: "Markdown copy of the selected family artifact." },
      { name: "04_Quality_Review.txt", text: quality.cleanedText, description: "Human-edit checklist and cleaned draft copy." },
      { name: "04_Quality_Review.md", text: quality.markdown, description: "Markdown quality review and cleaned draft copy." },
      { name: "05_Family_Export_Pack.txt", text: pack.body, description: "Bundled family export pack." },
      { name: "05_Family_Export_Pack.md", text: pack.markdown, description: "Markdown family export pack." },
      { name: "06_Final_Index.txt", text: manifest.body, description: "Final file map, reading order, and trust note." },
      { name: "06_Final_Index.md", text: manifest.markdown, description: "Markdown final file map." },
    ];
    const preview = buildHomieLegacyFamilyFolderPreview({ files, openFirst, artifact, quality, pack, manifest, memory: companionMemory, activeTitle, dailyRhythmLine });
    return { openFirst, timeline, artifact, pack, quality, manifest, preview };
  }

  function syncHomieLegacyFamilyFolderBundleState(bundle: ReturnType<typeof buildCurrentHomieLegacyFamilyFolderBundle>) {
    setOpenFirstGuidePreview(bundle.openFirst);
    setLegacyArtifactPreview(bundle.artifact);
    setLegacyExportPackPreview(bundle.pack);
    setLegacyQualityReview(bundle.quality);
    setLegacyFinalManifestPreview(bundle.manifest);
    setLegacyFamilyFolderPreview(bundle.preview);
  }

  function runHomieLegacyFamilyFolderExport(source: "typed" | "voice" | "quick" = "quick", prompt = "Homie, build the family folder", exportAfter = true) {
    const bundle = buildCurrentHomieLegacyFamilyFolderBundle();
    syncHomieLegacyFamilyFolderBundleState(bundle);
    setLegacyFamilyFolderExportStatus(exportAfter ? "Preparing family ZIP..." : "Preview ready. ZIP not downloaded yet.");
    setLegacyFamilyFolderExportStatus(exportAfter ? "Preparing ZIP download..." : "Folder preview ready. ZIP not downloaded yet.");
    appendCompanionMessages([
      createHomieMessage("user", prompt, source),
      createHomieMessage("homie", bundle.preview.body, source),
    ]);
    announce("Family folder is ready.", "good", source === "voice" || voiceEnabled, bundle.preview.spokenText);
    if (exportAfter) void exportHomieLegacyFamilyFolderZip(bundle.preview);
    return bundle.preview;
  }

  async function exportHomieLegacyFamilyFolderZip(forcedPreview?: HomieLegacyFamilyFolderExportPreview) {
    const preview = forcedPreview || legacyFamilyFolderPreview || buildCurrentHomieLegacyFamilyFolderBundle().preview;
    setLegacyFamilyFolderPreview(preview);
    setLegacyFamilyFolderExportStatus("Preparing family ZIP...");
    try {
      const jszipModule: any = await import("jszip");
      const JSZipCtor = (jszipModule as any).default || jszipModule;
      const zip = new JSZipCtor();
      const folderName = preview.filenameBase.replace(/^Homie_/, "").replace(/[^A-Za-z0-9_-]+/g, "_");
      const rootFolder = zip.folder(folderName) || zip;
      preview.files.forEach((file) => rootFolder.file(file.name, file.text));
      rootFolder.file("00_Folder_ReadMe.txt", preview.body);
      rootFolder.file("00_Folder_ReadMe.md", preview.markdown);
      const blob = await zip.generateAsync({ type: "blob" });
      downloadBlobFile(preview.filenameBase + ".zip", blob);
      setLegacyFamilyFolderExportStatus("ZIP downloaded: " + preview.filenameBase + ".zip");
      try {
        void navigator.clipboard?.writeText(preview.body);
      } catch {
        // ignore
      }
      announce("Downloaded the family folder ZIP.", "good", true, "Downloaded the family folder zip.");
    } catch {
      setLegacyFamilyFolderExportStatus("ZIP unavailable; exported files one by one.");
      preview.files.forEach((file, index) => {
        window.setTimeout(() => downloadTextFile(file.name, file.text), index * 120);
      });
      window.setTimeout(() => downloadTextFile("00_Folder_ReadMe.txt", preview.body), preview.files.length * 120);
      announce("ZIP bundling was not available, so I exported the family files one by one.", "warn", true, "ZIP unavailable. Exported files one by one.");
    }
  }


  function handleCompanionConversation(text: string, source: "typed" | "voice" | "quick" = "typed") {
    const trimmed = text.trim();
    if (!trimmed) return false;

    if (isHomieLegacyFamilyFolderExportPrompt(trimmed)) {
      const shouldDownload = !/\b(preview|show|list only|do not download)\b/i.test(trimmed) || /\b(build|export|share|download|save|zip)\b/i.test(trimmed);
      runHomieLegacyFamilyFolderExport(source, trimmed, shouldDownload);
      return true;
    }

    if (isHomieLegacyFinalManifestPrompt(trimmed)) {
      runHomieLegacyFinalManifest(source, trimmed, /\b(export|share|download|save)\b/i.test(trimmed));
      return true;
    }
    if (isHomieLegacyQualityReviewPrompt(trimmed)) {
      const review = runHomieLegacyQualityReview(source, trimmed);
      if (/\b(copy|cleaned|clipboard)\b/i.test(trimmed)) copyHomieLegacyQualityCleanedVersion(review);
      return true;
    }
    if (isHomieFamilyOpenFirstGuidePrompt(trimmed)) {
      runHomieFamilyOpenFirstGuide(source, trimmed, /\b(export|share|download|save)\b/i.test(trimmed));
      return true;
    }
    if (isHomieFamilyLegacyExportPackPrompt(trimmed)) {
      runHomieFamilyLegacyExportPack(source, trimmed, /\b(export|share|download|save)\b/i.test(trimmed));
      return true;
    }
    if (isHomieLegacyArtifactStudioPrompt(trimmed)) {
      const type = inferHomieLegacyArtifactStudioType(trimmed);
      runHomieLegacyArtifactStudio(type, source, trimmed);
      return true;
    }
    if (isHomieLegacyTimelinePrompt(trimmed)) {
      runHomieLegacyTimelineReview(source, trimmed, /\b(export|share|download|save)\b/i.test(trimmed));
      return true;
    }
    if (isHomieDailyRhythmPrompt(trimmed)) {
      runHomieDailyRhythmCheck(source, trimmed);
      return true;
    }
    if (isHomieRuntimeSelfCheckPrompt(trimmed)) {
      void runHomieRuntimeSelfCheck(source, trimmed);
      return true;
    }
    const ctx = { activePanelTitle: activeTitle, activePanelId, status, mood, source };
    const reply = buildHomieCompanionReply(trimmed, ctx);
    appendCompanionMessages([
      createHomieMessage("user", trimmed, source),
      createHomieMessage("homie", reply.text, source),
    ]);
    announce(reply.text, reply.mood, source === "voice" || voiceEnabled, trimForSpeech(reply.text));
    return true;
  }


  async function runHomieRuntimeSelfCheck(source: "typed" | "voice" | "quick" = "quick", prompt = "Homie, are you okay?") {
    const latest = await refreshVoiceDiagnostics();
    let bridge: { ok: boolean; status?: string; message?: string; model?: string } = {
      ok: diagnostics.externalBridgeState === "ready" || diagnostics.externalBridgeState === "recording" || diagnostics.externalBridgeState === "transcribing",
      status: diagnostics.externalBridgeState,
      message: diagnostics.externalBridgeMessage,
      model: diagnostics.externalBridgeModel,
    };

    if (wantsExternalVoice()) {
      try {
        bridge = await getExternalBridgeReadiness(true, latest);
      } catch {
        bridge = { ok: false, status: "degraded", message: "I tried to check the local bridge, but the probe itself failed." };
      }
    }

    const speechAvailable = typeof window !== "undefined" && !!window.speechSynthesis;
    const micKnown = latest.microphoneApiAvailable
      ? `microphone API is present; permission is ${plainPermissionLabel(latest.permissionState)}; ${latest.audioInputCount || 0} audio input${latest.audioInputCount === 1 ? "" : "s"} detected`
      : "microphone API is not available in this runtime";
    const speakerKnown = speechAvailable
      ? `speaker output API is present; Homie voice is ${voiceEnabled ? "enabled" : "muted"}; I am ${isSpeaking ? "speaking right now" : "not speaking right now"}`
      : "speaker output API is not available in this runtime";
    const bridgeKnown = wantsExternalVoice()
      ? `local bridge is ${bridge.ok ? "reachable" : "not confirmed"} at ${externalVoiceBaseUrl}; state is ${bridgePlainLabel((bridge.status as VoiceDiagnostics["externalBridgeState"]) || diagnostics.externalBridgeState)}`
      : `local bridge is not selected; current mode is ${voiceModeLabel}`;
    const memoryKnown = `I can see ${companionMemory.checkInCount} check-in${companionMemory.checkInCount === 1 ? "" : "s"}, themes: ${companionMemory.recentThemeText || "general"}, and ${companionMemory.legacyArtifactCount} family artifact${companionMemory.legacyArtifactCount === 1 ? "" : "s"} in this local Homie memory lane`;

    const known = [
      `Mic: ${micKnown}.`,
      `Speaker: ${speakerKnown}.`,
      `Memory: ${memoryKnown}.`,
      `Bridge: ${bridgeKnown}.`,
    ];

    const guessing = [
      "I am not reading your physical room, your actual speaker volume, or your real mic level unless a mic test, transcript, or bridge response gives me evidence.",
      "I cannot know whether you personally heard me unless you confirm it.",
      "I can summarize local Homie memory, but I cannot prove your family has opened or read any saved note yet.",
    ];

    const needsConfirmation = [
      latest.permissionState === "granted" ? "Say a short test phrase so I can confirm the transcript path." : "Confirm Windows and browser/Electron microphone permission.",
      voiceEnabled ? "Tell me if my voice volume and pacing feel right." : "Turn Voice on if you want speaker output.",
      wantsExternalVoice() && !bridge.ok ? "Start or repair the local voice bridge if you want local mic transcription." : "Tell me whether you want cloud, hybrid, or local bridge as the default voice lane.",
    ];

    const allGreen = latest.microphoneApiAvailable && latest.permissionState !== "denied" && speechAvailable && (!wantsExternalVoice() || !!bridge.ok);
    const displayText = [
      allGreen ? "Runtime self-check: I look okay from the signals I can actually see." : "Runtime self-check: I’m present, but at least one voice signal needs attention.",
      "",
      "What I know:",
      ...known.map((line) => `• ${line}`),
      "",
      "What I’m guessing / not claiming:",
      ...guessing.map((line) => `• ${line}`),
      "",
      "What needs your confirmation:",
      ...needsConfirmation.map((line) => `• ${line}`),
    ].join("\n");

    const spokenText = allGreen
      ? "I look okay from the runtime signals I can actually see. I still need you to confirm that you can hear me and that the mic catches your words."
      : "I’m here, but one voice signal needs attention. I’ll show what I know, what I’m guessing, and what needs your confirmation.";

    appendCompanionMessages([
      createHomieMessage("user", prompt, source),
      createHomieMessage("homie", displayText, source),
    ]);
    setCompanionMemory(getHomieCompanionMemorySnapshot());
    setLegacyArtifactSummaries(getHomieLegacyArtifactSummaries(4));
    announce(displayText, allGreen ? "good" : "warn", source === "voice" || voiceEnabled, spokenText);
    if (!allGreen) setShowDiagnostics(true);
    return { ok: allGreen, displayText, spokenText };
  }


  function runCompanionQuick(text: string) {
    handleCompanionConversation(text, "quick");
  }


  // v10.36.42b Family-facing mic entry: try local bridge, but fall back gently for this click.
  async function startHomieFamilyTalkByMic() {
    setOpen(true);
    await startVoice(false, true, false, false, "family-mic", true);
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
      stopExternalVoice(silent, source);
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

  function clearExternalStopTimer() {
    if (externalStopTimerRef.current) {
      window.clearTimeout(externalStopTimerRef.current);
      externalStopTimerRef.current = null;
    }
  }

  function cleanupExternalVoiceStream() {
    clearExternalStopTimer();
    try {
      mediaStreamRef.current?.getTracks()?.forEach((track) => track.stop());
    } catch {
      // ignore
    }
    mediaStreamRef.current = null;
    mediaRecorderRef.current = null;
    externalRecordingStartedAtRef.current = 0;
  }

  function stopExternalVoice(silent = false, source = "homie") {
    const recorder = mediaRecorderRef.current;
    const elapsed = Date.now() - (externalRecordingStartedAtRef.current || Date.now());
    const finish = () => {
      clearExternalStopTimer();
      try {
        if (recorder && recorder.state !== "inactive") {
          recorder.stop();
        } else {
          cleanupExternalVoiceStream();
          setIsListening(false);
          setIsHoldingToTalk(false);
        }
      } catch (error: any) {
        cleanupExternalVoiceStream();
        setIsListening(false);
        setIsHoldingToTalk(false);
        const message = String(error?.message || "Could not stop local bridge recording cleanly.");
        setDiagnostics((prev) => ({ ...prev, externalBridgeState: "degraded", externalBridgeMessage: message, lastErrorCode: "external-stop-failed", lastErrorMessage: message, activeRecognitionMode: "idle" }));
        if (!silent) announce(message, "warn", true, "Recording stop issue.");
      }
    };

    setIsHoldingToTalk(false);
    if (recorder && recorder.state !== "inactive" && elapsed > 0 && elapsed < HOMIE_VOICE_MIN_EXTERNAL_RECORDING_MS) {
      const wait = HOMIE_VOICE_MIN_EXTERNAL_RECORDING_MS - elapsed;
      setStatus("Got it. Finishing the clip.");
      setDiagnostics((prev) => ({ ...prev, externalBridgeState: "recording", externalBridgeMessage: "Finishing a short voice clip before transcription." }));
      window.setTimeout(finish, wait);
      return;
    }

    finish();
    emitVoiceStatus({ source, status: "ended", message: "Stopped local bridge recording.", mode: "external" });
    if (!silent) setStatus("Got it. Working on that.");
  }


  // ===== v10.36.70b Homie visible local bridge helpers =====
  function normalizeHomieBridgeBaseUrl(baseUrl: string) {
    return String(baseUrl || "http://127.0.0.1:8765").trim().replace(/\/+$/, "") || "http://127.0.0.1:8765";
  }

  function isDesktopBridgeUnavailable(result: any) {
    const hay = String(result?.error || result?.message || result?.detail || "").toLowerCase();
    return hay.includes("not available in browser") || hay.includes("not available") || hay.includes("desktop mode");
  }

  async function homieBridgeFetchJson(url: string, init: RequestInit = {}, timeoutMs = 8000) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), Math.max(1500, timeoutMs));
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      const text = await res.text();
      let parsed: any = null;
      try { parsed = text ? JSON.parse(text) : null; } catch { /* ignore */ }
      if (!res.ok) return { ok: false, error: "HTTP " + res.status + " from " + url, detail: text || res.statusText };
      return parsed && typeof parsed === "object" ? parsed : { ok: true, text };
    } catch (error: any) {
      return { ok: false, error: String(error?.name || "fetch-failed") + ": " + String(error?.message || "Could not reach " + url) };
    } finally {
      window.clearTimeout(timer);
    }
  }

  async function callHomieVoiceBridgeProbe(payload: any, forceDirect = false) {
    let desktopResult: any = null;
    if (!forceDirect) {
      try { desktopResult = await api.voiceBridgeProbe?.(payload); }
      catch (error: any) { desktopResult = { ok: false, error: String(error?.message || error || "Desktop bridge probe failed.") }; }
      if (desktopResult?.ok) return desktopResult;
    }

    const shouldTryDirect = forceDirect || !api.isDesktop?.() || isDesktopBridgeUnavailable(desktopResult);
    if (!shouldTryDirect) return desktopResult || { ok: false, error: "Desktop bridge probe failed." };

    const baseUrl = normalizeHomieBridgeBaseUrl(payload?.baseUrl || externalVoiceBaseUrl);
    const health = await homieBridgeFetchJson(baseUrl + "/health", { method: "GET" }, Math.min(Number(payload?.timeoutMs || externalVoiceTimeoutMs || 8000), 10000));
    if (health?.ok) {
      return {
        ...health,
        ok: true,
        status: "ready",
        detail: "Direct browser bridge is ready at " + baseUrl + ".",
        model: health?.stt?.modelHint || health?.model || "",
        browserDirect: true,
      };
    }
    return { ...(health || {}), ok: false, error: health?.error || "Direct browser bridge did not answer at " + baseUrl + ". Keep RUN_HOMIE_VOICE_BRIDGE_v10.36.45.bat open.", browserDirect: true };
  }

  async function callHomieVoiceBridgeTranscribe(payload: any) {
    let desktopResult: any = null;
    try { desktopResult = await api.voiceBridgeTranscribe?.(payload); }
    catch (error: any) { desktopResult = { ok: false, error: String(error?.message || error || "Desktop bridge transcribe failed.") }; }
    if (desktopResult?.ok) return desktopResult;

    const shouldTryDirect = !api.isDesktop?.() || isDesktopBridgeUnavailable(desktopResult);
    if (!shouldTryDirect) return desktopResult || { ok: false, error: "Desktop bridge transcribe failed." };

    const baseUrl = normalizeHomieBridgeBaseUrl(payload?.baseUrl || externalVoiceBaseUrl);
    const result = await homieBridgeFetchJson(baseUrl + "/transcribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audioBase64: payload?.audioBase64 || "", mimeType: payload?.mimeType || "audio/webm" }),
    }, Math.max(Number(payload?.timeoutMs || externalVoiceTimeoutMs || 120000), 120000));
    return { ...(result || {}), browserDirect: true };
  }

  async function activateHomieLocalBridgeNow() {
    const baseUrl = normalizeHomieBridgeBaseUrl(externalVoiceBaseUrl || "http://127.0.0.1:8765");
    persistHomiePrefs({ homieVoiceEngineMode: "external-http", homieExternalVoiceBaseUrl: baseUrl, homieExternalVoiceTimeoutMs: 120000 } as any);
    setDiagnostics((prev) => ({
      ...prev,
      externalBridgeConfigured: true,
      externalBridgeBaseUrl: baseUrl,
      externalBridgeState: "configuring",
      externalBridgeMessage: "Checking direct local bridge at " + baseUrl + "…",
      lastErrorCode: "",
      lastErrorMessage: "",
    }));
    setStatus("Switching Homie to local bridge mode at " + baseUrl + ".");
    const result = await callHomieVoiceBridgeProbe({ baseUrl, timeoutMs: 8000 }, true);
    if (result?.ok) {
      const message = result.detail || "Direct browser bridge is ready at " + baseUrl + ".";
      setDiagnostics((prev) => ({
        ...prev,
        externalBridgeConfigured: true,
        externalBridgeBaseUrl: baseUrl,
        externalBridgeState: "ready",
        externalBridgeMessage: message,
        externalBridgeModel: result.model || prev.externalBridgeModel || "tiny.en",
        lastErrorCode: "",
        lastErrorMessage: "",
      }));
      announce(message + " Use Start listening or Hold to talk now.", "good", true, "Local bridge ready.");
      return;
    }
    const message = classifyExternalBridgeError(result?.error || "Direct local bridge did not answer.", baseUrl);
    setDiagnostics((prev) => ({
      ...prev,
      externalBridgeConfigured: true,
      externalBridgeBaseUrl: baseUrl,
      externalBridgeState: "degraded",
      externalBridgeMessage: message,
      lastErrorCode: "direct-bridge-unreachable",
      lastErrorMessage: message,
    }));
    announce(message, "warn", true, "Local bridge issue.");
  }
  // ===== v10.36.70b Homie visible local bridge helpers END =====

  // ===== v10.36.73c Homie bridge say test helper =====
  async function runHomieLocalBridgeSayTest() {
    persistHomiePrefs({ homieVoiceEngineMode: "external-http", homieExternalVoiceBaseUrl: externalVoiceBaseUrl || "http://127.0.0.1:8765", homieExternalVoiceTimeoutMs: 120000 } as any);
    setStatus("Bridge say test is listening — say one clear sentence, then click Stop listening.");
    setDiagnostics((prev) => ({ ...prev, externalBridgeConfigured: true, externalBridgeBaseUrl: externalVoiceBaseUrl, externalBridgeState: "recording", externalBridgeMessage: "Bridge say test records audio and sends it to /transcribe.", lastErrorCode: "", lastErrorMessage: "" }));
    await startVoice(false, true, false, false, "bridge-say-test");
  }
  // ===== v10.36.73c Homie bridge say test helper END =====

  // ===== v10.36.77 direct bridge helpers =====
  function homieV77BridgeBaseUrl(baseUrl: string) {
    return String(baseUrl || "http://127.0.0.1:8765").trim().replace(/\/+$/, "") || "http://127.0.0.1:8765";
  }
  function homieV77BridgeError(errorLike: any, baseUrl: string) {
    const raw = String(errorLike || "Bridge did not answer.");
    const lower = raw.toLowerCase();
    if (lower.includes("failed to fetch") || lower.includes("fetch failed") || lower.includes("econnrefused") || lower.includes("abort")) {
      return "Local voice bridge is not reachable at " + baseUrl + ". Start the bridge BAT, keep that window open, then click Probe 8765.";
    }
    return classifyExternalBridgeError(raw, baseUrl);
  }
  async function homieV77FetchJson(url: string, init: RequestInit = {}, timeoutMs = 12000) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), Math.max(2000, timeoutMs));
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      const text = await res.text();
      let parsed: any = null;
      try { parsed = text ? JSON.parse(text) : null; } catch { /* keep text */ }
      if (!res.ok) return { ok: false, error: "HTTP " + res.status + " from " + url, detail: text || res.statusText };
      return parsed && typeof parsed === "object" ? parsed : { ok: true, text };
    } catch (error: any) {
      return { ok: false, error: String(error?.name || "fetch-failed") + ": " + String(error?.message || "Could not reach " + url) };
    } finally { window.clearTimeout(timer); }
  }
  async function homieV77ProbeBridge(baseUrl = externalVoiceBaseUrl, timeoutMs = 12000) {
    const cleanBase = homieV77BridgeBaseUrl(baseUrl);
    const result = await homieV77FetchJson(cleanBase + "/health", { method: "GET" }, timeoutMs);
    if (result?.ok) return { ...result, ok: true, status: "ready", baseUrl: cleanBase, detail: result.detail || "Direct browser bridge is ready at " + cleanBase + ".", model: result?.stt?.modelHint || result?.model || result?.sttModel || "", browserDirect: true };
    return { ...(result || {}), ok: false, status: "degraded", baseUrl: cleanBase, error: homieV77BridgeError(result?.error || result?.detail, cleanBase), browserDirect: true };
  }
  async function homieV77TranscribeBridge(payload: any) {
    const cleanBase = homieV77BridgeBaseUrl(payload?.baseUrl || externalVoiceBaseUrl);
    const result = await homieV77FetchJson(cleanBase + "/transcribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ audioBase64: payload?.audioBase64 || "", mimeType: payload?.mimeType || "audio/webm" }) }, Math.max(Number(payload?.timeoutMs || externalVoiceTimeoutMs || 180000), 180000));
    return { ...(result || {}), browserDirect: true };
  }
  async function homieV77UseLocalBridgeNow() {
    const baseUrl = homieV77BridgeBaseUrl(externalVoiceBaseUrl || "http://127.0.0.1:8765");
    persistHomiePrefs({ homieVoiceEngineMode: "external-http", homieExternalVoiceBaseUrl: baseUrl, homieExternalVoiceTimeoutMs: 180000 } as any);
    setDiagnostics((prev) => ({ ...prev, externalBridgeConfigured: true, externalBridgeBaseUrl: baseUrl, externalBridgeState: "configuring", externalBridgeMessage: "Checking local bridge at " + baseUrl + "…", lastErrorCode: "", lastErrorMessage: "" }));
    const result = await homieV77ProbeBridge(baseUrl, 12000);
    if (result?.ok) {
      const message = result.detail || "Local voice bridge is ready at " + baseUrl + ".";
      setDiagnostics((prev) => ({ ...prev, externalBridgeConfigured: true, externalBridgeBaseUrl: baseUrl, externalBridgeState: "ready", externalBridgeMessage: message, externalBridgeModel: result.model || prev.externalBridgeModel || "", lastErrorCode: "", lastErrorMessage: "" }));
      announce(message + " Now use Bridge say test.", "good", true, "Local bridge ready.");
      return;
    }
    const message = result?.error || "Local bridge did not answer at " + baseUrl + ".";
    setDiagnostics((prev) => ({ ...prev, externalBridgeConfigured: true, externalBridgeBaseUrl: baseUrl, externalBridgeState: "degraded", externalBridgeMessage: message, lastErrorCode: "bridge-unreachable", lastErrorMessage: message }));
    announce(message, "warn", true, "Local bridge not reachable.");
  }
  // ===== v10.36.77 direct bridge helpers END =====

  async function getExternalBridgeReadiness(force = false, baseState?: VoiceDiagnostics) {
    const cached = lastExternalProbeRef.current;
    const now = Date.now();
    if (!force && cached && cached.baseUrl === externalVoiceBaseUrl && now - cached.ts < HOMIE_VOICE_PROBE_CACHE_MS) {
      return cached.result;
    }
    const result = await probeExternalVoice(true, baseState);
    const normalized = { ok: !!result?.ok, status: String(result?.status || ""), message: String(result?.message || ""), model: String((result as any)?.model || "") };
    lastExternalProbeRef.current = { ts: Date.now(), baseUrl: externalVoiceBaseUrl, result: normalized };
    return normalized;
  }


  async function probeExternalVoice(silent = false, baseState?: VoiceDiagnostics) {
    const current = baseState || diagnostics;
    const baseUrl = homieV77BridgeBaseUrl(externalVoiceBaseUrl || "http://127.0.0.1:8765");
    if (!wantsExternalVoice()) {
      const message = "External/local bridge is idle because Homie is set to cloud mode. Click Use local bridge to use 127.0.0.1:8765.";
      setDiagnostics((prev) => ({ ...prev, ...current, externalBridgeConfigured: false, externalBridgeBaseUrl: baseUrl, externalBridgeState: "disabled", externalBridgeMessage: message, externalBridgeModel: "" }));
      if (!silent) announce(message, "idle", true, "Local bridge is idle.");
      return { ok: false, status: "disabled", message };
    }
    setDiagnostics((prev) => ({ ...prev, ...current, externalBridgeConfigured: true, externalBridgeBaseUrl: baseUrl, externalBridgeState: "configuring", externalBridgeMessage: "Checking " + baseUrl + "…", lastErrorCode: "", lastErrorMessage: "" }));
    let result: any = null;
    try { if (api.voiceBridgeProbe) result = await api.voiceBridgeProbe({ baseUrl, timeoutMs: Math.min(externalVoiceTimeoutMs, 12000) }); }
    catch (error: any) { result = { ok: false, error: String(error?.message || error || "Desktop bridge probe failed.") }; }
    if (!result?.ok) result = await homieV77ProbeBridge(baseUrl, 12000);
    if (result?.ok) {
      const message = result.detail || "Direct browser bridge is ready at " + baseUrl + ".";
      setDiagnostics((prev) => ({ ...prev, ...current, externalBridgeConfigured: true, externalBridgeBaseUrl: baseUrl, externalBridgeState: "ready", externalBridgeMessage: message, externalBridgeModel: result.model || prev.externalBridgeModel || "", lastErrorCode: "", lastErrorMessage: "" }));
      if (!silent) announce(message, "good", true, "Voice bridge ready.");
      return { ok: true, status: "ready", message, model: result.model || "" };
    }
    const message = homieV77BridgeError(result?.error || result?.detail || "External/local voice bridge did not respond.", baseUrl);
    setDiagnostics((prev) => ({ ...prev, ...current, externalBridgeConfigured: true, externalBridgeBaseUrl: baseUrl, externalBridgeState: "degraded", externalBridgeMessage: message, externalBridgeModel: "", lastErrorCode: "external-bridge-unreachable", lastErrorMessage: message, activeRecognitionMode: "idle" }));
    if (!silent) announce(message, "warn", true, "Voice bridge not reachable.");
    return { ok: false, status: "degraded", message };
  }

async function refreshVoiceDiagnostics() {
    const next = createBaseDiagnostics();
    next.externalBridgeConfigured = wantsExternalVoice();
    next.externalBridgeBaseUrl = externalVoiceBaseUrl;
    next.externalBridgeState = wantsExternalVoice() ? "configuring" : "disabled";
    next.externalBridgeMessage = wantsExternalVoice() ? `Checking ${externalVoiceBaseUrl}…` : "External/local bridge is idle because Homie is set to cloud mode. Click Use local bridge to use 127.0.0.1:8765.";

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

    if (wantsExternalVoice()) await getExternalBridgeReadiness(false, next);
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
    if (blob.size < HOMIE_VOICE_MIN_AUDIO_BLOB_BYTES) {
      const message = "That voice clip was too short to transcribe reliably. Use Bridge say test, speak one clear full sentence, then click Stop listening.";
      setDiagnostics((prev) => ({ ...prev, externalBridgeState: "ready", externalBridgeMessage: message, lastErrorCode: "external-clip-too-short", lastErrorMessage: message, activeRecognitionMode: "idle" }));
      announce(message, "warn", true, "Voice clip too short.");
      return;
    }
    try {
      const baseUrl = homieV77BridgeBaseUrl(externalVoiceBaseUrl || "http://127.0.0.1:8765");
      setDiagnostics((prev) => ({ ...prev, externalBridgeState: "transcribing", externalBridgeMessage: "Transcribing with " + baseUrl + "…", activeRecognitionMode: "external" }));
      const audioBase64 = await blobToBase64(blob);
      let result: any = null;
      try { if (api.voiceBridgeTranscribe) result = await api.voiceBridgeTranscribe({ baseUrl, timeoutMs: externalVoiceTimeoutMs, mimeType: blob.type || "audio/webm", audioBase64 }); }
      catch (error: any) { result = { ok: false, error: String(error?.message || error || "Desktop bridge transcribe failed.") }; }
      if (!result?.ok) result = await homieV77TranscribeBridge({ baseUrl, timeoutMs: externalVoiceTimeoutMs, mimeType: blob.type || "audio/webm", audioBase64 });
      if (!result?.ok || !result.text) {
        const message = homieV77BridgeError(result?.error || result?.detail || "External/local voice bridge returned no transcript.", baseUrl);
        setDiagnostics((prev) => ({ ...prev, externalBridgeState: "degraded", externalBridgeMessage: message, lastErrorCode: "external-transcribe-failed", lastErrorMessage: message, activeRecognitionMode: "idle" }));
        announce(message, "warn", true, "Voice bridge transcription failed.");
        return;
      }
      const transcript = String(result.text || "").trim();
      setDiagnostics((prev) => ({ ...prev, externalBridgeState: "ready", externalBridgeMessage: result.detail || "External/local voice bridge ready at " + baseUrl + ".", externalBridgeModel: result.model || prev.externalBridgeModel, lastTranscript: transcript || prev.lastTranscript, lastErrorCode: "", lastErrorMessage: "", activeRecognitionMode: "idle" }));
      if (!transcript) { announce("The bridge heard audio but returned an empty transcript.", "warn", true, "No transcript returned."); return; }
      emitVoiceStatus({ source, status: "transcript", message: "Heard: " + transcript, transcript, mode: "external" });
      setStatus("Bridge heard: " + transcript + ". Answering now.");
      setMood("good");
      window.setTimeout(() => run(transcript), 90);
    } catch (error: any) {
      const code = String(error?.name || "external-transcribe-error");
      const message = homieV77BridgeError(code + ": " + String(error?.message || "External/local transcription failed."), externalVoiceBaseUrl);
      setDiagnostics((prev) => ({ ...prev, externalBridgeState: "degraded", externalBridgeMessage: message, lastErrorCode: code, lastErrorMessage: message, activeRecognitionMode: "idle" }));
      announce(message, "warn", true, "Voice bridge issue.");
    }
  }

async function startExternalVoice(pushToTalk = false, source = "homie") {
    try {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    } catch {
      // ignore
    }
    setStatus(pushToTalk ? "Hold to talk is live — speak while holding." : "Listening — say one short sentence now.");
    setMood("good");
    const latest = await refreshVoiceDiagnostics();
    if (!navigator.mediaDevices?.getUserMedia) {
      const message = "Microphone access is unavailable because getUserMedia is missing in this runtime.";
      setDiagnostics((prev) => ({ ...prev, ...latest, lastErrorCode: "getusermedia-unavailable", lastErrorMessage: message }));
      announce(message, "warn", true, "Microphone unavailable.");
      return;
    }

    const probe = await getExternalBridgeReadiness(false, latest);
    if (!probe.ok && strictLocalVoice) {
      const message = `${probe.message} Start the local bridge BAT, keep that window open, then click Probe 8765. Or click Cloud mode if you want browser speech instead.`;
      setDiagnostics((prev) => ({ ...prev, lastErrorCode: "external-bridge-required", lastErrorMessage: message, activeRecognitionMode: "idle" }));
      announce(message, "warn", true, "Voice bridge not reachable.");
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

      recorder.start(250);
      externalRecordingStartedAtRef.current = Date.now();
      clearExternalStopTimer();
      externalStopTimerRef.current = window.setTimeout(() => {
        if (mediaRecorderRef.current === recorder && recorder.state !== "inactive") {
          stopExternalVoice(true, source);
        }
      }, HOMIE_VOICE_MAX_EXTERNAL_RECORDING_MS);
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

  async function startVoice(pushToTalk = false, allowBias = true, _forceLocal = false, _networkRetryUsed = false, source = "homie", familyFriendlyVoiceFallback = false) {
    if (voiceStartLockRef.current) return;
    voiceStartLockRef.current = true;
    window.setTimeout(() => {
      voiceStartLockRef.current = false;
    }, 900);

    try {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    } catch {
      // ignore
    }

    const latest = await refreshVoiceDiagnostics();
    let useExternal = false;
    if (wantsExternalVoice()) {
      if (voiceEngineMode === "external-http") {
        // v10.36.42b family friendly strict local fallback
        // Family-facing Talk by mic should not dead-end on “voice bridge required”.
        // Normal Start listening / strict local bridge behavior stays unchanged.
        if (familyFriendlyVoiceFallback) {
          const bridge = await getExternalBridgeReadiness(false, latest);
          if (bridge.ok) {
            useExternal = true;
          } else {
            const friendlyMessage = "Voice bridge is not running. Trying regular mic for this family click.";
            setDiagnostics((prev) => ({
              ...prev,
              externalBridgeConfigured: true,
              externalBridgeBaseUrl: externalVoiceBaseUrl,
              externalBridgeState: "degraded",
              externalBridgeMessage: (bridge.message || "External/local voice bridge is unavailable.") + " " + friendlyMessage,
              lastErrorCode: "",
              lastErrorMessage: "",
              activeRecognitionMode: "idle",
            }));
            setStatus(friendlyMessage);
            setMood("good");
          }
        } else {
          useExternal = true;
        }
      } else if (voiceEngineMode === "hybrid") {
        const bridge = await getExternalBridgeReadiness(false, latest);
        useExternal = !!bridge.ok;
      }
    }

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
        setStatus(pushToTalk ? "Hold to talk is live." : "I’m listening.");
        setMood("good");
        emitVoiceStatus({ source, status: "started", message: pushToTalk ? "Hold to talk is live — speak while holding." : "Listening — say one short sentence now.", mode: "cloud" });
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
        if (homieMicProofActiveRef.current) finishHomieMicProofWithoutTranscript(code);
        announce(message, "warn", true, "Voice recognition issue.");
      };

      rec.onend = () => {
        setIsListening(false);
        setIsHoldingToTalk(false);
        setDiagnostics((prev) => ({ ...prev, activeRecognitionMode: "idle" }));
        emitVoiceStatus({ source, status: "ended", message: "Voice session ended.", mode: "cloud" });
        if (homieMicProofActiveRef.current) finishHomieMicProofWithoutTranscript("speech-end");
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


  // ===== v10.36.66b Homie Buddy true opt-in camera preview + honest visual signal =====
  function stopHomieCameraPreview(silent = false) {
    try {
      if (homieCameraSampleTimerRef.current) {
        window.clearInterval(homieCameraSampleTimerRef.current);
        homieCameraSampleTimerRef.current = null;
      }
    } catch {
      // ignore
    }

    try {
      homieCameraStreamRef.current?.getTracks()?.forEach((track) => track.stop());
    } catch {
      // ignore
    }

    homieCameraStreamRef.current = null;
    homieCameraLastBrightnessRef.current = null;

    try {
      if (homieCameraVideoRef.current) homieCameraVideoRef.current.srcObject = null;
    } catch {
      // ignore
    }

    setHomieCameraLive(false);
    setHomieCameraSignal("Camera preview is off. Camera is visual only; Homie is not listening through it.");
    setHomieCameraPresenceStatus("Camera is off. Camera is visual only; use mic buttons for hearing. No video is saved.");
    if (!silent) announce("Camera preview is off.", "idle", true, "Camera preview off.");
  }

  function sampleHomieCameraFrame() {
    const video = homieCameraVideoRef.current;
    const canvas = homieCameraCanvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;

    const width = 96;
    const height = 54;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D | null;
    if (!ctx) return;

    try {
      ctx.drawImage(video, 0, 0, width, height);
      const pixels = ctx.getImageData(0, 0, width, height).data;
      let total = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        total += (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
      }
      const brightness = Math.round(total / (pixels.length / 4));
      const last = homieCameraLastBrightnessRef.current;
      homieCameraLastBrightnessRef.current = brightness;
      const delta = last == null ? 0 : Math.abs(brightness - last);

      const lightLabel = brightness < 44 ? "dim room" : brightness > 170 ? "bright room" : "normal room light";
      const motionLabel = delta > 18 ? "movement/light change detected" : delta > 8 ? "small visual change" : "steady frame";

      setHomieCameraSignal(lightLabel + " • " + motionLabel + " • brightness " + brightness);
      setHomieCameraPresenceStatus("Camera preview is live and local. Camera is visual only. Homie is only sampling simple brightness/motion signals: " + lightLabel + ", " + motionLabel + ". No video is saved.");
    } catch {
      setHomieCameraSignal("Camera frame could not be sampled. Preview may still be visible.");
    }
  }

  async function startHomieCameraPreview() {
    setHomieCameraPresenceStatus("Requesting camera permission. Camera opens only when clicked.");
    setHomieCameraSignal("Requesting camera permission...");
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera access is unavailable in this runtime.");

      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      homieCameraStreamRef.current = stream;
      setHomieCameraLive(true);
      setHomieCameraSignal("Camera preview starting. Homie will sample brightness/motion only.");
      setHomieCameraPresenceStatus("Camera preview is live and local. Camera is visual only; Homie listens only through the mic buttons. No video is saved.");

      window.setTimeout(() => {
        const video = homieCameraVideoRef.current;
        if (!video) return;
        try {
          video.srcObject = stream;
          video.muted = true;
          video.play?.().catch(() => undefined);
        } catch {
          // ignore
        }

        sampleHomieCameraFrame();
        if (homieCameraSampleTimerRef.current) window.clearInterval(homieCameraSampleTimerRef.current);
        homieCameraSampleTimerRef.current = window.setInterval(sampleHomieCameraFrame, 1200);
      }, 80);

      announce("Camera preview is live. I am only sampling brightness and motion. I am not listening through the camera or saving video.", "good", true, "Camera preview live. Mic is separate.");
    } catch (error: any) {
      const code = String(error?.name || error?.code || "camera-preview-failed");
      const message = code + ": " + String(error?.message || "Camera preview failed or permission was blocked.");
      setHomieCameraLive(false);
      setHomieCameraSignal(message);
      setHomieCameraPresenceStatus(message);
      announce(message, "warn", true, "Camera preview needs permission.");
    }
  }

  // ===== v10.36.68 Homie mic proof meter helpers =====
  function stopHomieMicLevelProbe(silent = false) {
    try {
      if (homieMicProofRafRef.current) window.cancelAnimationFrame(homieMicProofRafRef.current);
    } catch {
      // ignore
    }
    try {
      if (homieMicProofTimerRef.current) window.clearTimeout(homieMicProofTimerRef.current);
    } catch {
      // ignore
    }
    homieMicProofRafRef.current = null;
    homieMicProofTimerRef.current = null;
    try {
      homieMicProofStreamRef.current?.getTracks()?.forEach((track) => track.stop());
    } catch {
      // ignore
    }
    homieMicProofStreamRef.current = null;
    try {
      void homieMicProofAudioCtxRef.current?.close?.();
    } catch {
      // ignore
    }
    homieMicProofAudioCtxRef.current = null;
    setHomieMicLevel(0);
    if (!silent) setHomieMicProofStatus("Mic proof stopped.");
  }

  function finishHomieMicProofWithoutTranscript(reason = "ended") {
    if (!homieMicProofActiveRef.current) return;
    const peak = homieMicProofPeakRef.current || 0;
    homieMicProofActiveRef.current = false;
    const pct = Math.round(Math.min(1, peak) * 100);
    if (peak > 0.035) {
      const message = "Mic level detected (" + pct + "% peak), but SpeechRecognition did not return words. Your input device is probably sending audio; the browser speech transcript path is the weak link. Try Say test again, speak one short sentence, or switch to the local voice bridge."; 
      setHomieMicProofStatus(message);
      setDiagnostics((prev) => ({ ...prev, lastErrorCode: "mic-audio-no-transcript", lastErrorMessage: message }));
      announce(message, "warn", true, "Mic level detected, but no transcript returned.");
    } else {
      const message = "No useful mic level detected during the proof test. Check Windows input device, browser mic permission, and whether the right microphone is selected."; 
      setHomieMicProofStatus(message);
      setDiagnostics((prev) => ({ ...prev, lastErrorCode: "mic-level-too-low", lastErrorMessage: message }));
      announce(message, "warn", true, "No useful mic level detected.");
    }
    stopHomieMicLevelProbe(true);
  }

  async function startHomieMicLevelProbe(durationMs = 6500) {
    stopHomieMicLevelProbe(true);
    homieMicProofPeakRef.current = 0;
    setHomieMicLevel(0);
    setHomieMicPeak(0);
    setHomieMicProofStatus("Requesting mic signal. Speak after the browser starts listening.");

    if (!navigator.mediaDevices?.getUserMedia) {
      const message = "Mic level probe is unavailable because getUserMedia is missing in this runtime."; 
      setHomieMicProofStatus(message);
      throw new Error(message);
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    homieMicProofStreamRef.current = stream;
    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextCtor) {
      const message = "AudioContext is unavailable, so Homie cannot meter mic level in this runtime."; 
      setHomieMicProofStatus(message);
      throw new Error(message);
    }

    const ctx = new AudioContextCtor();
    homieMicProofAudioCtxRef.current = ctx;
    if (ctx.state === "suspended") {
      try { await ctx.resume(); } catch { /* ignore */ }
    }
    const sourceNode = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    sourceNode.connect(analyser);
    const data = new Uint8Array(analyser.fftSize);

    const tick = () => {
      try {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i += 1) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        const level = Math.min(1, rms * 5);
        homieMicProofPeakRef.current = Math.max(homieMicProofPeakRef.current, level);
        setHomieMicLevel(level);
        setHomieMicPeak(homieMicProofPeakRef.current);
      } catch {
        // ignore
      }
      homieMicProofRafRef.current = window.requestAnimationFrame(tick);
    };
    tick();

    homieMicProofTimerRef.current = window.setTimeout(() => {
      finishHomieMicProofWithoutTranscript("timeout");
    }, durationMs);
  }

  async function runHomieMicProofTest() {
    homieMicProofActiveRef.current = true;
    setDiagnostics((prev) => ({ ...prev, lastTranscript: "", lastErrorCode: "", lastErrorMessage: "" }));
    setStatus("Mic proof is listening — say: Homie can hear me.");
    setHomieMicProofStatus("Starting mic proof. Say: Homie can hear me.");
    try {
      await startHomieMicLevelProbe(7600);
      await startVoice(false, true, false, false, "mic-proof");
    } catch (error: any) {
      homieMicProofActiveRef.current = false;
      stopHomieMicLevelProbe(true);
      const message = String(error?.message || "Mic proof could not start.");
      setHomieMicProofStatus(message);
      announce(message, "warn", true, "Mic proof could not start.");
    }
  }
  // ===== v10.36.68 Homie mic proof meter helpers END =====
  async function runHomieCameraPresenceCheck() {
    if (homieCameraLive) {
      stopHomieCameraPreview(false);
      return;
    }
    await startHomieCameraPreview();
  }
  // ===== v10.36.66b Homie Buddy true opt-in camera preview + honest visual signal END =====

  async function runMicTest() {
    setDiagnostics((prev) => ({ ...prev, micTest: "running", lastErrorCode: "", lastErrorMessage: "" }));
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("getUserMedia is unavailable in this runtime.");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      const fresh = await refreshVoiceDiagnostics();
      setDiagnostics((prev) => ({ ...prev, ...fresh, micTest: "pass" }));
      announce(`Mic permission passed. ${fresh.audioInputCount || 1} audio input${fresh.audioInputCount === 1 ? "" : "s"} detected. This proves permission, not transcript. Use Say test to prove Homie heard words.`, "good", true, "Mic permission passed. Use Say test to prove transcript.");
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
    const shouldGreet = open || mode === "standalone";
    if (!shouldGreet) return;
    const today = getHomieDailyRhythmDayKey();
    if (dailyRhythm.lastGreetingDay === today || dailyRhythm.dismissedDay === today) return;
    const id = window.setTimeout(() => {
      setDailyRhythm((prev) => {
        if (prev.lastGreetingDay === today || prev.dismissedDay === today) return prev;
        return saveHomieDailyRhythmState({ ...prev, lastGreetingDay: today });
      });
      setStatus(buildHomieDailyGreetingStatus(dailyRhythm, companionMemory));
      setMood("good");
    }, 750);
    return () => window.clearTimeout(id);
  }, [open, mode, dailyRhythm.lastGreetingDay, dailyRhythm.dismissedDay, dailyRhythm.lastCheckInDay, companionMemory.checkInCount, companionMemory.recentThemeText]);

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

  useEffect(() => () => {
    stopVoice(true);
    stopHomieCameraPreview(true);
    stopHomieMicLevelProbe(true);
  }, []);
  // ===== v10.38.8g Homie Buddy human companion avatar =====
  const livingPresenceState = getHomieLivingPresenceState({ isListening, isSpeaking, mood, status, activeTitle });
  const voiceWarmthLine = getHomieVoiceWarmthLine({ isListening, isSpeaking, diagnostics, voiceModeLabel });
  const avatarContents = (
    <span className="homieHumanBuddyCore" data-presence-state={livingPresenceState || "idle"} data-homie-buddy-human-avatar="v10.38.9" aria-label="Human-inspired Homie companion avatar">
      <span className="homieHumanBuddyAura" />
      <span className="homieHumanBuddyCap" />
      <span className="homieHumanBuddyEar left" />
      <span className="homieHumanBuddyEar right" />
      <span className="homieHumanBuddyHead" />
      <span className="homieHumanBuddyBrow left" />
      <span className="homieHumanBuddyBrow right" />
      <span className="homieHumanBuddyGlasses">
        <span className="homieHumanBuddyBridge" />
      </span>
      <span className="homieHumanBuddyEye left" />
      <span className="homieHumanBuddyEye right" />
      <span className="homieHumanBuddyBeard" />
      <span className="homieHumanBuddySmile" />
      <span className="homieHumanBuddyBody" />
      <span className="homieHumanBuddyCoreLight" />
      <span className="homieHumanBuddyHand left" />
      <span className="homieHumanBuddyHand right" />
      <span className="homieHumanBuddyFoot" />
      <span className="homieHumanBuddyName">HOMIE</span>
    </span>
  );
  // ===== v10.38.8g Homie Buddy human companion avatar END =====

  const homieBuddyMoodSummary = buildHomieBuddyMoodSummary();

  function homieBuddyRunCompanionRoutine(kind: "checkin" | "reflect" | "legacy") {
    const key = "oddengine:homie:mood-ledger:v1";
    let entries: any[] = [];
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : [];
      entries = Array.isArray(parsed) ? parsed : [];
    } catch {
      entries = [];
    }

    const latest = entries[0];
    const themes = Array.isArray(latest?.themes) && latest.themes.length ? latest.themes : ["body", "mind", "family", "next move"];
    const lane = latest?.lane || "mind";
    const now = Date.now();

    if (kind === "checkin") {
      const entry = {
        id: `buddy_routine_${now}_checkin`,
        lane: "mind",
        mood: "honest check-in",
        themes: ["mind", "body", "family", "next move"],
        note: "HomieBuddy check-in started. Name what feels true, then pick one tiny step.",
        createdAt: now,
      };
      const next = [entry, ...entries].slice(0, 50);
      try {
        localStorage.setItem(key, JSON.stringify(next));
        window.dispatchEvent(new CustomEvent("homie:mood-ledger-updated"));
      } catch {
        // local-only best effort
      }
      homieBuddyAddRoutineReceipt("checkin", "Check-in saved", "HomieBuddy saved a local check-in.");
      homieBuddySetCompanionDraft("Homie, ask me how I am really doing, then help me name one honest feeling and one tiny next step.");
      return;
    }

    if (kind === "reflect") {
      homieBuddyAddRoutineReceipt("reflect", "Reflection drafted", `Latest themes reflected: ${themes.join(", ")}.`);
      homieBuddySetCompanionDraft(`Homie, reflect my latest check-in (${lane}: ${themes.join(", ")}) and suggest one tiny next step.`);
      return;
    }

    const legacyPrompt = latest
      ? `Homie, turn my latest check-in (${lane}: ${themes.join(", ")}) into a kind family legacy note and one Open First handoff.`
      : "Homie, help me draft a kind family legacy note and one Open First handoff.";
    try {
      localStorage.setItem("oddengine:homie:latest-legacy-draft:v1", legacyPrompt);
      const rawLegacy = localStorage.getItem("oddengine:homie:legacy-vault-sync:v1");
      const parsedLegacy = rawLegacy ? JSON.parse(rawLegacy) : [];
      const legacyList = Array.isArray(parsedLegacy) ? parsedLegacy : [];
      localStorage.setItem("oddengine:homie:legacy-vault-sync:v1", JSON.stringify([{ id: `buddy_legacy_${now}`, title: "Homie family legacy draft", body: legacyPrompt, source: "HomieBuddy Companion Routine", createdAt: now }, ...legacyList].slice(0, 50)));
      window.dispatchEvent(new CustomEvent("homie:legacy-draft-updated", { detail: { prompt: legacyPrompt, createdAt: now } }));
    } catch {
      // local-only best effort
    }
    homieBuddyAddRoutineReceipt("legacy", "Legacy draft synced", "Family note and Open First handoff starter saved locally.");
    homieBuddySetCompanionDraft(legacyPrompt);
  }
  function homieBuddySetCompanionDraft(nextPrompt: string) {
    try {
      const input = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(
        '[data-homie-buddy-input="true"], [data-homie-input="true"], textarea[placeholder*="Homie"], input[placeholder*="Homie"]'
      );
      if (input) {
        input.value = nextPrompt;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.focus();
        return;
      }
      window.dispatchEvent(new CustomEvent("homie:companion-draft", { detail: { prompt: nextPrompt } }));
    } catch {
      window.dispatchEvent(new CustomEvent("homie:companion-draft", { detail: { prompt: nextPrompt } }));
    }
  }
  const homieBuddyRoutineSummary = buildHomieBuddyRoutineSummary();

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
          <div className="homiePresenceConsentRow" aria-label="Homie presence consent">
            <span>Mic: opt-in</span>
            <span>Camera: opt-in</span>
            <span>Memory: local</span>
          </div>
          <div className="homieLivingPresenceBar" aria-label="Homie living presence">
            <span className={`homieLivingPresencePill ${livingPresenceState === "idle" ? "good" : ""}`}>State: {livingPresenceState}</span>
            <span className="homieLivingPresencePill">{voiceWarmthLine || "Typed mode is safe."}</span>
          </div>
                                        <div className="homieBuddyRoutineStatus" data-homiebuddy-routine-status="v10.38.15">
            <b>Latest routine</b>
            {homieBuddyRoutineSummary || "No routine receipt yet."}
          </div>
<div className="homieBuddyCompanionMiniDeck" data-homiebuddy-companion-behavior="v10.38.13">
            <div className="homieCompanionBehaviorCard">
              <b>How are you really?</b>
              <p>Tiny companion routines: check in, reflect what feels true, or save something your family can understand later.</p>
            </div>
            <div className="homieCompanionPromptGrid">
              <button className="homieCompanionPromptBtn" onClick={() => homieBuddyRunCompanionRoutine("checkin")}><b>Check in</b><span>feeling first</span></button>
              <button className="homieCompanionPromptBtn" onClick={() => homieBuddyRunCompanionRoutine("reflect")}><b>Reflect</b><span>mood + step</span></button>
              <button className="homieCompanionPromptBtn" onClick={() => homieBuddyRunCompanionRoutine("legacy")}><b>Legacy</b><span>family note</span></button>
            </div>
          </div>
<div className="homieMoodLedgerLine" data-homie-buddy-mood-ledger="v10.38.10">
            {homieBuddyMoodSummary || "No local check-in saved yet."} Want one tiny step, a plan, or a family note?
          </div>
<div className="homieRebuildStageText">
          <div data-homie-true-3d="buddy-stage"><HomieTrue3DAvatar size="buddy" /></div>
<div className="assistantSectionTitle">Homie companion presence</div>
            <div className="small">{status}</div>
            <div className="small homieRebuildPresenceLine">{presenceLine}</div>
            <div className="small homieTolanIdlePresenceLine">I’m here. We can stay quiet, talk by mic, or take one small next move.</div>


            <div className="small homieDailyRhythmLine">{dailyRhythmLine}</div>
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
              <div className="small">Clear family/OS companion replies. Grounding only when you ask for it.</div>
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
            <button className="tabBtn" onClick={() => runHomieDailyRhythmCheck("quick")}>Today</button>
            <button className="tabBtn" onClick={() => runHomieFamilyOpenFirstGuide("quick")}>Open first</button>
            <button className="tabBtn" onClick={() => runHomieLegacyQualityReview("quick")}>Review draft</button>
            <button className="tabBtn" onClick={() => runHomieLegacyTimelineReview("quick")}>Timeline</button>
            <button className="tabBtn" onClick={() => runCompanionQuick("help me focus on the next tiny move")}>Focus me</button>
            <button className="tabBtn" onClick={() => runCompanionQuick("I feel overwhelmed, ground me")}>Ground me</button>
            <button className="tabBtn" onClick={runLegacyDraft}>Legacy note</button>
            <button className="tabBtn" onClick={saveForFamily}>Save for family</button>
            <button className="tabBtn" onClick={() => { void startHomieFamilyTalkByMic(); }}>Talk by mic</button>
          </div>
          {/* v10.36.40f Homie family mode soft launch first-use flow */}
          <div className="homieFamilyModeSoftLaunchCard" aria-label="Family mode first minute">
            <div className="homieFamilyModeSoftLaunchHead">
              <div>
                <div className="assistantSectionTitle">Family mode first minute</div>
                <div className="small">Start here. Four gentle clicks your family can understand without developer context.</div>
              </div>
              <span className="badge good">Soft launch</span>
            </div>

          {/* v10.36.41 Homie family flow readiness smoke badge */}
          <div className="homieFamilyFlowReadinessBadge" aria-label="Homie legacy family flow readiness">
            <span>Open First ready</span>
            <span>Family Folder ready</span>
            <span>Voice opt-in</span>
          </div>
          <div className="small homieFamilyFlowReadyLine">Family flow is ready. Start with Open First, build the family folder when you’re ready, then use mic only by choice.</div>
          {/* v10.36.41 Homie family flow readiness smoke badge END */}

<div className="homieFamilyModeFirstUseFlow">
              <button className="homieFamilyModeStep" onClick={() => runHomieFamilyOpenFirstGuide("quick")}>
                <strong>1. Open this first</strong>
                <span>Plain-language guide for what FairlyOdd OS and Homie are.</span>
              </button>
              <button className="homieFamilyModeStep" onClick={() => runCompanionQuick("what can Homie help with for my family?")}>
                <strong>2. What Homie can help with</strong>
                <span>Explain, organize, remember, route panels, voice, legacy files, and one small next move.</span>
              </button>
              <button className="homieFamilyModeStep" onClick={() => runHomieLegacyFamilyFolderExport("quick", "Homie, build the family folder", true)}>
                <strong>3. Build family folder</strong>
                <span>Bundle Open First, Timeline, Artifact, Review, Export Pack, and Index.</span>
              </button>
              <button className="homieFamilyModeStep" onClick={() => { void startHomieFamilyTalkByMic(); }}>
                <strong>4. Talk by mic</strong>
                <span>Mic listens only when clicked. Camera is visual only and separate.</span>
              </button>
            </div>
            <div className="small homieFamilyModeSoftLaunchNote">Mic and Camera are opt-in. Memory is local. Homie should explain what it knows, what it is guessing, and what needs confirmation.</div>
          </div>
          {/* v10.36.40f Homie family mode soft launch first-use flow END */}

          <div className="homieLegacyToolsSummaryLine">
            <strong>Legacy tools</strong>
            <span>Open one calm section at a time: Open First, Artifact Studio, Export Pack, Quality Review, Final Index, Family Folder.</span>
          </div>




          <details className="homieLegacyVaultMini homieLegacyToolDisclosure homieFamilyOpenFirstGuideControls" style={{ marginTop: 12 }}>
            <summary className="homieLegacyToolSummary">
              <span>
                <span className="homieLegacyToolSummaryTitle">Open First</span>
                <span className="homieLegacyToolSummaryMeta">Family starting guide</span>
              </span>
              <span className="homieLegacyToolSummaryIcon" aria-hidden="true">›</span>
            </summary>
            <div className="homieLegacyToolBody">
            <div className="homieRebuildSectionHead" style={{ gap: 10, alignItems: "flex-start" }}>
              <div>
                <div className="assistantSectionTitle">Open this first</div>
                <div className="small">A plain-language family guide for what FairlyOdd and Homie are, what to click first, and how to use the legacy tools.</div>
              </div>
            </div>

            <div className="assistantChipWrap" style={{ marginTop: 10 }}>
              <button className="tabBtn active" onClick={() => runHomieFamilyOpenFirstGuide("quick")}>Preview guide</button>
              <button className="tabBtn" disabled={!openFirstGuidePreview} onClick={() => exportHomieFamilyOpenFirstGuide("txt")}>Export TXT</button>
              <button className="tabBtn" disabled={!openFirstGuidePreview} onClick={() => exportHomieFamilyOpenFirstGuide("md")}>Export MD</button>
            </div>

            {openFirstGuidePreview ? (
              <div className="homieLegacyVaultList" style={{ marginTop: 10 }}>
                <div className="homieLegacyVaultItem" style={{ alignItems: "stretch" }}>
                  <strong>{openFirstGuidePreview.title}</strong>
                  <span>{openFirstGuidePreview.body.length > 560 ? openFirstGuidePreview.body.slice(0, 557) + "..." : openFirstGuidePreview.body}</span>
                  <span className="small">Built for family use: simple, gentle, and reviewable before relying on it.</span>
                </div>
              </div>
            ) : (
              <div className="small" style={{ marginTop: 10 }}>Preview creates a gentle starting guide that explains Homie, Timeline, Artifact Studio, and Family export pack.</div>
            )}
            </div>
          </details>

          <details className="homieLegacyVaultMini homieLegacyToolDisclosure homieArtifactStudioVisibleControls" style={{ marginTop: 12 }}>
            <summary className="homieLegacyToolSummary">
              <span>
                <span className="homieLegacyToolSummaryTitle">Artifact Studio</span>
                <span className="homieLegacyToolSummaryMeta">Draft letter, memory note, lesson, or status</span>
              </span>
              <span className="homieLegacyToolSummaryIcon" aria-hidden="true">›</span>
            </summary>
            <div className="homieLegacyToolBody">
              <div className="homieRebuildSectionHead" style={{ gap: 10, alignItems: "flex-start" }}>
              <div>
                <div className="assistantSectionTitle">Artifact Studio</div>
                <div className="small">Turn the timeline and check-ins into one family-ready draft. Preview first, then export.</div>
              </div>
              <select
                className="tabBtn"
                value={legacyArtifactStudioType}
                onChange={(event) => {
                  const nextType = event.target.value as HomieLegacyArtifactStudioType;
                  setLegacyArtifactStudioType(nextType);
                  setLegacyArtifactPreview(buildCurrentHomieLegacyArtifactStudioPreview(nextType));
                }}
                aria-label="Choose family artifact type"
              >
                <option value="letter">Letter</option>
                <option value="memory-note">Memory note</option>
                <option value="open-first">Open this first</option>
                <option value="life-lesson">Life lesson</option>
                <option value="project-status">Project status</option>
              </select>
            </div>

            <div className="assistantChipWrap" style={{ marginTop: 10 }}>
              <button className="tabBtn active" onClick={() => runHomieLegacyArtifactStudio(legacyArtifactStudioType, "quick")}>Preview artifact</button>
              <button className="tabBtn" disabled={!legacyArtifactPreview} onClick={() => exportHomieLegacyArtifactStudio("txt")}>Export TXT</button>
              <button className="tabBtn" disabled={!legacyArtifactPreview} onClick={() => exportHomieLegacyArtifactStudio("md")}>Export MD</button>
            </div>

            {legacyArtifactPreview ? (
              <div className="homieLegacyVaultList" style={{ marginTop: 10 }}>
                <div className="homieLegacyVaultItem" style={{ alignItems: "stretch" }}>
                  <strong>{legacyArtifactPreview.title}</strong>
                  <span>{legacyArtifactPreview.body.length > 520 ? legacyArtifactPreview.body.slice(0, 517) + "..." : legacyArtifactPreview.body}</span>
                  <span className="small">Review note: this is a draft from local Homie memory and timeline signals. Edit before final family use.</span>
                </div>
              </div>
            ) : (
              <div className="small" style={{ marginTop: 10 }}>Choose a type and click Preview artifact. Homie will keep it calm, useful, and reviewable.</div>
            )}
            </div>
          </details>

          {/* v10.36.29b family legacy pack grouped with Artifact Studio */}
          <details className="homieLegacyVaultMini homieLegacyToolDisclosure homieFamilyLegacyExportPackControls" style={{ marginTop: 12 }}>
            <summary className="homieLegacyToolSummary">
              <span>
                <span className="homieLegacyToolSummaryTitle">Export Pack</span>
                <span className="homieLegacyToolSummaryMeta">Bundle timeline, artifact, and vault notes</span>
              </span>
              <span className="homieLegacyToolSummaryIcon" aria-hidden="true">›</span>
            </summary>
            <div className="homieLegacyToolBody">
              <div className="homieRebuildSectionHead" style={{ gap: 10, alignItems: "flex-start" }}>
              <div>
                <div className="assistantSectionTitle">Family export pack</div>
                <div className="small">Bundle the timeline, selected artifact, and vault notes into one calm family file.</div>
              </div>
            </div>

            <div className="assistantChipWrap" style={{ marginTop: 10 }}>
              <button className="tabBtn active" onClick={() => runHomieFamilyLegacyExportPack("quick")}>Preview pack</button>
              <button className="tabBtn" disabled={!legacyExportPackPreview} onClick={() => exportHomieFamilyLegacyPack("txt")}>Export TXT</button>
              <button className="tabBtn" disabled={!legacyExportPackPreview} onClick={() => exportHomieFamilyLegacyPack("md")}>Export MD</button>
            </div>

            {legacyExportPackPreview ? (
              <div className="homieLegacyVaultList" style={{ marginTop: 10 }}>
                <div className="homieLegacyVaultItem" style={{ alignItems: "stretch" }}>
                  <strong>{legacyExportPackPreview.title}</strong>
                  <span>{legacyExportPackPreview.body.length > 560 ? legacyExportPackPreview.body.slice(0, 557) + "..." : legacyExportPackPreview.body}</span>
                  <span className="small">Includes timeline + selected artifact + vault notes. Review before final family use.</span>
                </div>
              </div>
            ) : (
              <div className="small" style={{ marginTop: 10 }}>Preview creates one clean pack from the current timeline, selected artifact, and saved legacy notes.</div>
            )}
            </div>
          </details>


          <details className="homieLegacyVaultMini homieLegacyToolDisclosure homieFamilyQualityReviewControls" style={{ marginTop: 12 }}>
            <summary className="homieLegacyToolSummary">
              <span>
                <span className="homieLegacyToolSummaryTitle">Quality Review</span>
                <span className="homieLegacyToolSummaryMeta">Check true, kind, useful, understandable</span>
              </span>
              <span className="homieLegacyToolSummaryIcon" aria-hidden="true">›</span>
            </summary>
            <div className="homieLegacyToolBody">
              <div className="homieRebuildSectionHead" style={{ gap: 10, alignItems: "flex-start" }}>
              <div>
                <div className="assistantSectionTitle">Family quality review</div>
                <div className="small">Before anything becomes final, check whether it is true, kind, useful, and understandable.</div>
              </div>
            </div>

            <div className="assistantChipWrap" style={{ marginTop: 10 }}>
              <button className="tabBtn active" onClick={() => runHomieLegacyQualityReview("quick")}>Review latest</button>
              <button className="tabBtn" disabled={!legacyQualityReview} onClick={() => copyHomieLegacyQualityCleanedVersion()}>Copy cleaned</button>
              <button className="tabBtn" disabled={!legacyQualityReview} onClick={() => exportHomieLegacyQualityCleanedVersion("txt")}>Export TXT</button>
              <button className="tabBtn" disabled={!legacyQualityReview} onClick={() => exportHomieLegacyQualityCleanedVersion("md")}>Export MD</button>
            </div>

            {legacyQualityReview ? (
              <div className="homieLegacyVaultList" style={{ marginTop: 10 }}>
                <div className="homieLegacyVaultItem" style={{ alignItems: "stretch" }}>
                  <strong>{legacyQualityReview.verdict === "family-ready-draft" ? "Family-ready draft" : "Needs human edit"}</strong>
                  {legacyQualityReview.checklist.map((item) => (
                    <span key={item.key}>{item.ok ? "✓" : "Needs edit"} — {item.label} {item.note}</span>
                  ))}
                  <span className="small">Source: {legacyQualityReview.sourceLabel}. Copy cleaned gives you a human-editable version before final family use.</span>
                </div>
              </div>
            ) : (
              <div className="small" style={{ marginTop: 10 }}>Review checks the latest Open First guide, Artifact Studio draft, or Family export pack before you treat it like final.</div>
            )}
            </div>
          </details>

          <details className="homieLegacyVaultMini homieLegacyToolDisclosure homieFamilyFinalManifestControls" style={{ marginTop: 12 }}>
            <summary className="homieLegacyToolSummary">
              <span>
                <span className="homieLegacyToolSummaryTitle">Final Index</span>
                <span className="homieLegacyToolSummaryMeta">Reading order and file manifest</span>
              </span>
              <span className="homieLegacyToolSummaryIcon" aria-hidden="true">›</span>
            </summary>
            <div className="homieLegacyToolBody">
              <div className="homieRebuildSectionHead" style={{ gap: 10, alignItems: "flex-start" }}>
              <div>
                <div className="assistantSectionTitle">Final family index</div>
                <div className="small">A simple manifest for the files your family should open, in the right order, with human-edited checkbox language.</div>
              </div>
            </div>

            <div className="assistantChipWrap" style={{ marginTop: 10 }}>
              <button className="tabBtn active" onClick={() => runHomieLegacyFinalManifest("quick")}>Generate final index</button>
              <button className="tabBtn" disabled={!legacyFinalManifestPreview} onClick={() => exportHomieLegacyFinalManifest("txt")}>Export TXT</button>
              <button className="tabBtn" disabled={!legacyFinalManifestPreview} onClick={() => exportHomieLegacyFinalManifest("md")}>Export MD</button>
            </div>

            {legacyFinalManifestPreview ? (
              <div className="homieLegacyVaultList" style={{ marginTop: 10 }}>
                <div className="homieLegacyVaultItem" style={{ alignItems: "stretch" }}>
                  <strong>{legacyFinalManifestPreview.title}</strong>
                  <span>{legacyFinalManifestPreview.body.length > 640 ? legacyFinalManifestPreview.body.slice(0, 637) + "..." : legacyFinalManifestPreview.body}</span>
                  <span className="small">Includes file list, reading order, human-edited checklist, and trust note. Review before final family use.</span>
                </div>
              </div>
            ) : (
              <div className="small" style={{ marginTop: 10 }}>Generate this after Open First, Artifact Studio, Family export pack, and Quality Review are previewed.</div>
            )}
            </div>
          </details>

          <details className="homieLegacyVaultMini homieLegacyToolDisclosure homieFamilyFolderExportControls" style={{ marginTop: 12 }}>
            <summary className="homieLegacyToolSummary">
              <span>
                <span className="homieLegacyToolSummaryTitle">Family Folder</span>
                <span className="homieLegacyToolSummaryMeta">One-click ZIP/fallback export</span>
              </span>
              <span className="homieLegacyToolSummaryIcon" aria-hidden="true">›</span>
            </summary>
            <div className="homieLegacyToolBody">
              <div className="homieRebuildSectionHead" style={{ gap: 10, alignItems: "flex-start" }}>
              <div>
                <div className="assistantSectionTitle">One-click family folder</div>
                <div className="small">Build one ZIP with Open First, Timeline, Selected Artifact, Quality Review, Family Export Pack, and Final Index.</div>
              </div>
            </div>

            <div className="assistantChipWrap" style={{ marginTop: 10 }}>
              <button className="tabBtn active" onClick={() => runHomieLegacyFamilyFolderExport("quick", "Homie, build the family folder", true)}>Build family folder</button>
            </div>
            <div className="small" style={{ marginTop: 8 }}><b>Last export:</b> {legacyFamilyFolderExportStatus}</div>

            {legacyFamilyFolderPreview ? (
              <div className="homieLegacyVaultList" style={{ marginTop: 10 }}>
                <div className="homieLegacyVaultItem" style={{ alignItems: "stretch" }}>
                  <strong>{legacyFamilyFolderPreview.title}</strong>
                  <span>{legacyFamilyFolderPreview.files.length} files prepared inside one family folder package.</span>
                  {legacyFamilyFolderPreview.files.slice(0, 6).map((file) => (
                    <span key={file.name}>{file.name} — {file.description}</span>
                  ))}
                  <span className="small">ZIP uses local browser packaging only. If ZIP fails, Homie falls back to exporting the files one by one.</span>
                </div>
              </div>
            ) : (
              <div className="small" style={{ marginTop: 10 }}>One click prepares every family-facing legacy file and downloads them together as a ZIP.</div>
            )}
            </div>
          </details>

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
                        <button className={`tabBtn ${voiceEngineMode === "external-http" ? "active" : ""}`} data-homie-top-bridge-button="v10.36.70b" onClick={() => void activateHomieLocalBridgeNow()}>{voiceEngineMode === "external-http" ? "Bridge on" : "Use bridge"}</button>
            <button className={`tabBtn ${voiceEngineMode === "external-http" ? "active" : ""}`} data-homie-v77-top-bridge="true" onClick={() => void homieV77UseLocalBridgeNow()}>{voiceEngineMode === "external-http" ? "Bridge on" : "Use bridge"}</button>
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
            <button className={"tabBtn " + (voiceEngineMode === "external-http" ? "active" : "")} data-homie-bridge-say-test="v10.36.73c" onClick={() => { voiceEngineMode === "external-http" ? void runHomieLocalBridgeSayTest() : void startVoice(false, true, false, false, "mic-proof"); }}>{voiceEngineMode === "external-http" ? "Bridge say test" : "Say test"}</button>
            <button className="tabBtn" onClick={() => void runMicTest()}>Mic permission</button>
            <button className="tabBtn active" onClick={() => { void runHomieMicProofTest(); }}>Say test</button>
            <button className="tabBtn" onClick={() => void runHomieRuntimeSelfCheck("quick")}>Self check</button>
            <button className={"tabBtn " + (homieCameraLive ? "active" : "")} onClick={() => void runHomieCameraPresenceCheck()}>{homieCameraLive ? "Stop camera" : "Start camera"}</button>
            <button className="tabBtn" onClick={() => { const digest = buildMorningDigest(); announce(digest, "good", true, trimForSpeech(digest)); }}>Read digest</button>
            {mode === "floating" && <button className="tabBtn" onClick={launchCompanion}>Pop out</button>}
          </div>

          <div className="homieRebuildVoiceMeta">
            <div className="small"><b>Voice engine:</b> {diagnostics.recognitionName} • {voiceModeLabel}</div>
            <div className="small"><b>Last transcript:</b> {diagnostics.lastTranscript || "—"}</div>
            <div className="small" data-homie-mic-reality="v10.36.67"><b>Mic reality:</b> Camera is visual only. For hearing, click Say test and watch Last transcript.</div>
            <div className="homieMicProofMeter" data-homie-mic-proof="v10.36.68">
              <div className="homieMicProofMeterHead">
                <span><b>Mic proof:</b> {homieMicProofStatus}</span>
                <span>{Math.round(homieMicPeak * 100)}% peak</span>
              </div>
              <div className="homieMicLevelTrack" aria-label="Mic signal meter">
                <span style={{ width: Math.max(4, Math.round(homieMicLevel * 100)) + "%" }} />
              </div>
              <div className="small">Permission means the browser may use the mic. Signal means audio moved. Transcript means Homie caught words. If words are wrong, use Correction or high-accuracy bridge.</div>
            </div>
            <div className="small"><b>Bridge:</b> {diagnostics.externalBridgeState} • {diagnostics.externalBridgeBaseUrl}</div>
            <div className="assistantChipWrap homieV77BridgeControls" data-homie-v77-bridge-controls="true">
              <button className={`tabBtn ${voiceEngineMode === "external-http" ? "active" : ""}`} onClick={() => void homieV77UseLocalBridgeNow()}>Use local bridge + check</button>
              <button className="tabBtn" onClick={() => void probeExternalVoice(false)}>Probe 8765</button>
              <button className={`tabBtn ${voiceEngineMode === "cloud" ? "active" : ""}`} onClick={() => { persistHomiePrefs({ homieVoiceEngineMode: "cloud" } as any); announce("Cloud mode is on. Local bridge is idle.", "idle", true, "Cloud mode."); void refreshVoiceDiagnostics(); }}>Cloud mode</button>
            </div>
            <div className="small homieV77BridgeHelp">If Homie says bridge not reachable: run the voice bridge BAT in a separate PowerShell and keep it open.</div>
            <div className="homieVisibleBridgeControls assistantChipWrap" data-homie-visible-bridge-controls="v10.36.70b">
              <button className={`tabBtn ${voiceEngineMode === "external-http" ? "active" : ""}`} onClick={() => void activateHomieLocalBridgeNow()}>Use local bridge</button>
              <button className="tabBtn" onClick={() => void probeExternalVoice(false)}>Probe 8765</button>
              <button className={`tabBtn ${voiceEngineMode === "cloud" ? "active" : ""}`} onClick={() => { persistHomiePrefs({ homieVoiceEngineMode: "cloud" } as any); announce("Cloud voice mode is on. Local bridge is idle.", "idle", true, "Cloud voice mode."); void refreshVoiceDiagnostics(); }}>Cloud mode</button>
            </div>
            <div className="small homieBridgeInlineTip">Bridge tip: your 8765 bridge can be healthy while Homie still says disabled if Cloud voice is selected. Use local bridge flips the saved mode.</div>
            <div className="small"><b>Camera:</b> {homieCameraPresenceStatus}</div>
            <div className="small"><b>Camera note:</b> Camera is visual only. Use Start listening, Hold to talk, or Talk by mic for voice.</div>
          </div>

          <div className={"homieCameraPreviewCard " + (homieCameraLive ? "live" : "")} data-homie-buddy-camera-preview="v10.36.66b">
            <div className="homieCameraPreviewHead">
              <div>
                <div className="assistantSectionTitle">Camera presence</div>
                <div className="small">Opt-in visual preview. Local only. Mic is separate.</div>
              </div>
              <span className={"badge " + (homieCameraLive ? "good" : "")}>{homieCameraLive ? "Live" : "Off"}</span>
            </div>
            <div className="homieCameraPreviewStage">
              {homieCameraLive ? (
                <video ref={homieCameraVideoRef} className="homieCameraPreviewVideo" autoPlay muted playsInline />
              ) : (
                <div className="homieCameraPreviewEmpty">
                  <span>Camera off</span>
                  <small>Click Start camera for simple light/motion signals. Use Start listening or Talk by mic for hearing.</small>
                </div>
              )}
              <canvas ref={homieCameraCanvasRef} className="homieCameraPreviewCanvas" aria-hidden="true" />
            </div>
            <div className="small"><b>Signal:</b> {homieCameraSignal}</div>
            <div className="small homieCameraTruthNote">Truth note: Homie is not identifying people or objects here, and the camera does not listen. This lane only reports simple brightness/motion signals unless a future vision model is explicitly added.</div>
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
      {mode === "floating" && !open && (
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


