import { loadJSON, saveJSON } from "./storage";
import type { Prefs } from "./prefs";
import type { HomiePresenceState } from "./homiePresence";

export const HOMIE_WAKE_FLOW_KEY = "oddengine:homie:wakeFlow:v1";
export const HOMIE_WAKE_FLOW_EVENT = "oddengine:homie-wake-flow-changed";

export type ListeningMode = "wake-word" | "push-to-talk" | "manual";
export type ConversationDepth = "tight" | "balanced" | "deep";
export type SessionState = "idle" | "listening" | "thinking" | "speaking";

export type HomieWakeFlowState = {
  listeningMode: ListeningMode;
  wakePhrase: string;
  followupWindowSec: number;
  autoListenAfterWake: boolean;
  bargeInEnabled: boolean;
  conciseReplies: boolean;
  conversationDepth: ConversationDepth;
  desktopAutoOpen: boolean;
  sessionState: SessionState;
  sessionActive: boolean;
  lastWakeAt: number | null;
  lastUserAt: number | null;
  lastAssistantAt: number | null;
  lastHeardText: string;
  lastReplyPreview: string;
  lastUpdated: number;
};

export type FlowCheck = {
  id: string;
  label: string;
  ready: boolean;
  note: string;
};

export const DEFAULT_HOMIE_WAKE_FLOW: HomieWakeFlowState = {
  listeningMode: "wake-word",
  wakePhrase: "Hey Homie",
  followupWindowSec: 18,
  autoListenAfterWake: true,
  bargeInEnabled: true,
  conciseReplies: false,
  conversationDepth: "balanced",
  desktopAutoOpen: true,
  sessionState: "idle",
  sessionActive: false,
  lastWakeAt: null,
  lastUserAt: null,
  lastAssistantAt: null,
  lastHeardText: "",
  lastReplyPreview: "",
  lastUpdated: Date.now(),
};

function mergeFlow(raw: Partial<HomieWakeFlowState> | null | undefined): HomieWakeFlowState {
  return {
    ...DEFAULT_HOMIE_WAKE_FLOW,
    ...(raw || {}),
    lastUpdated: typeof raw?.lastUpdated === "number" ? raw.lastUpdated : Date.now(),
  };
}

export function loadHomieWakeFlow(): HomieWakeFlowState {
  return mergeFlow(loadJSON<Partial<HomieWakeFlowState> | null>(HOMIE_WAKE_FLOW_KEY, null));
}

export function saveHomieWakeFlow(next: HomieWakeFlowState) {
  const payload = { ...next, lastUpdated: Date.now() };
  saveJSON(HOMIE_WAKE_FLOW_KEY, payload);
  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(new CustomEvent(HOMIE_WAKE_FLOW_EVENT, { detail: payload }));
    } catch {
      // no-op
    }
  }
}

export function patchHomieWakeFlow(patch: Partial<HomieWakeFlowState>) {
  saveHomieWakeFlow({ ...loadHomieWakeFlow(), ...patch, lastUpdated: Date.now() });
}

export function enableWakeConversationBaseline() {
  patchHomieWakeFlow({
    listeningMode: "wake-word",
    wakePhrase: "Hey Homie",
    followupWindowSec: 18,
    autoListenAfterWake: true,
    bargeInEnabled: true,
    conciseReplies: false,
    conversationDepth: "balanced",
    desktopAutoOpen: true,
    sessionState: "idle",
    sessionActive: false,
    lastReplyPreview: "Homie is staged for wake-word conversation mode and ready to guide the OS.",
  });
}

export function markWakeHeard(text = "Wake phrase heard") {
  patchHomieWakeFlow({
    sessionActive: true,
    sessionState: "listening",
    lastWakeAt: Date.now(),
    lastHeardText: text,
  });
}

export function markUserTurn(text: string) {
  patchHomieWakeFlow({
    sessionActive: true,
    sessionState: "thinking",
    lastUserAt: Date.now(),
    lastHeardText: text,
  });
}

export function markAssistantTurn(text: string) {
  patchHomieWakeFlow({
    sessionActive: true,
    sessionState: "speaking",
    lastAssistantAt: Date.now(),
    lastReplyPreview: text,
  });
}

export function endConversationSession() {
  patchHomieWakeFlow({
    sessionState: "idle",
    sessionActive: false,
  });
}

function bridgeConfigured(prefs: Prefs) {
  return prefs.ai.homieVoiceEngineMode === "cloud" || Boolean((prefs.ai.homieExternalVoiceBaseUrl || "").trim());
}

export function getWakeConversationChecks(flow: HomieWakeFlowState, presence: HomiePresenceState, prefs: Prefs): FlowCheck[] {
  const voiceReady = prefs.ai.homieVoiceEnabled && bridgeConfigured(prefs);
  const wakeReady = presence.wakeWordEnabled && flow.listeningMode === "wake-word" && Boolean(flow.wakePhrase.trim());
  const conversationReady = presence.conversationMode && flow.followupWindowSec >= 8;
  const handoffReady = flow.autoListenAfterWake && flow.desktopAutoOpen;
  const memoryReady = presence.memoryContextEnabled;
  const naturalReady = flow.bargeInEnabled && !flow.conciseReplies;
  return [
    {
      id: "voice",
      label: "Voice path",
      ready: voiceReady,
      note: voiceReady ? "Voice is enabled and Homie has a usable engine path." : "Voice still needs an enabled toggle or working bridge path.",
    },
    {
      id: "wake",
      label: "Wake phrase",
      ready: wakeReady,
      note: wakeReady ? `Wake word is armed as “${flow.wakePhrase}”.` : "Wake phrase is still staged or wake-word mode is not armed yet.",
    },
    {
      id: "conversation",
      label: "Conversation follow-up",
      ready: conversationReady,
      note: conversationReady ? `Homie will keep the conversation alive for about ${flow.followupWindowSec}s after each turn.` : "Conversation mode or follow-up timing still needs tuning.",
    },
    {
      id: "handoff",
      label: "Wake → listen handoff",
      ready: handoffReady,
      note: handoffReady ? "Wake detection can open a listening window automatically." : "Wake detection still needs a cleaner handoff into the listening state.",
    },
    {
      id: "memory",
      label: "Context carry-forward",
      ready: memoryReady,
      note: memoryReady ? "Homie can carry context across turns instead of feeling stateless." : "Memory/context is still off, so follow-up conversation will feel thinner.",
    },
    {
      id: "natural",
      label: "Natural flow",
      ready: naturalReady,
      note: naturalReady ? "Barge-in is on and replies can feel conversational instead of clipped." : "Natural flow is still conservative or overly terse.",
    },
  ];
}

export function getWakeConversationReadiness(flow: HomieWakeFlowState, presence: HomiePresenceState, prefs: Prefs) {
  const checks = getWakeConversationChecks(flow, presence, prefs);
  const readyCount = checks.filter((item) => item.ready).length;
  const readiness = Math.round((readyCount / Math.max(checks.length, 1)) * 100);
  return { checks, readyCount, total: checks.length, readiness };
}

export type FlowStage = {
  id: string;
  label: string;
  done: boolean;
  note: string;
};

export function getWakeConversationStages(flow: HomieWakeFlowState, presence: HomiePresenceState, prefs: Prefs): FlowStage[] {
  const ready = getWakeConversationReadiness(flow, presence, prefs);
  const voiceReady = ready.checks.find((item) => item.id === "voice")?.ready ?? false;
  const wakeReady = ready.checks.find((item) => item.id === "wake")?.ready ?? false;
  const convoReady = ready.checks.find((item) => item.id === "conversation")?.ready ?? false;
  const sessionLive = flow.sessionActive && flow.sessionState !== "idle";
  return [
    {
      id: "arm",
      label: "Arm the wake flow",
      done: voiceReady && wakeReady,
      note: wakeReady ? `Listening in ${flow.listeningMode} mode with “${flow.wakePhrase}”.` : "Finish voice path + wake phrase setup first.",
    },
    {
      id: "listen",
      label: "Open the listening window",
      done: wakeReady && flow.autoListenAfterWake,
      note: flow.autoListenAfterWake ? `Homie listens for about ${flow.followupWindowSec}s after wake.` : "Auto-listen after wake is still off.",
    },
    {
      id: "carry",
      label: "Carry the conversation",
      done: convoReady,
      note: convoReady ? `Conversation depth is ${flow.conversationDepth} with follow-up memory turned ${presence.memoryContextEnabled ? "on" : "off"}.` : "Conversation follow-up still needs more room or context.",
    },
    {
      id: "session",
      label: "Keep the session alive",
      done: sessionLive,
      note: sessionLive ? `Current session state: ${flow.sessionState}.` : "No active session is open right now, which is normal until wake + speech start.",
    },
  ];
}
