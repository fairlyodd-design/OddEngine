import { create } from "zustand";
import type { AvatarKind, AvatarRuntime } from "../types/avatar";
import type { BridgeStatus, HomieBridgeEvent } from "../types/bridge";
import type { DesktopStatus, HomieMessage, HomieState, SpeechRuntime } from "../types/homie";
import { defaultMessageForState } from "./animationMachine";

type AvatarPatch = Partial<AvatarRuntime>;

type CompanionStore = {
  state: HomieState;
  message: HomieMessage;
  bridgeStatus: BridgeStatus;
  desktopStatus: DesktopStatus;
  recentEvents: HomieBridgeEvent[];
  avatar: AvatarRuntime;
  speech: SpeechRuntime;
  setState: (state: HomieState, message?: HomieMessage) => void;
  setBridgeStatus: (status: BridgeStatus) => void;
  setDesktopStatus: (status: DesktopStatus) => void;
  pushEvent: (event: HomieBridgeEvent) => void;
  setRecentEvents: (events: HomieBridgeEvent[]) => void;
  setAvatarSource: (sourceUrl: string) => void;
  setAvatarScale: (scale: number) => void;
  setAvatarLoading: (sourceUrl: string, kind: AvatarKind) => void;
  setAvatarReady: (patch: AvatarPatch) => void;
  setAvatarError: (error: string, sourceUrl?: string, kind?: AvatarKind) => void;
  useFallbackAvatar: () => void;
  setSpeechListening: (active: boolean, interimText?: string) => void;
  setSpeechSpeaking: (active: boolean, bubbleText?: string) => void;
  setSpeechLoop: (active: boolean) => void;
  setSpeechBubble: (text: string) => void;
  setSpeechAmplitude: (value: number) => void;
  setSpeechBargeState: (ready: boolean, barging?: boolean) => void;
  setSpeechWarmingMic: (active: boolean, bubbleText?: string) => void;
  setSpeechError: (error?: string) => void;
  clearSpeechBubble: () => void;
};

const fallbackAvatar: AvatarRuntime = {
  sourceUrl: "",
  status: "fallback",
  kind: "fallback",
  scale: 1,
  note: "Using fallback buddy"
};

const initialSpeech: SpeechRuntime = {
  listening: false,
  speaking: false,
  loopActive: false,
  bubbleText: "",
  interimText: "",
  amplitude: 0,
  bargeInReady: false,
  bargingIn: false,
  warmingMic: false,
  error: undefined
};

export const useCompanionStore = create<CompanionStore>((set) => ({
  state: "idle",
  message: defaultMessageForState("idle"),
  bridgeStatus: { ok: false },
  desktopStatus: { ok: false },
  recentEvents: [],
  avatar: fallbackAvatar,
  speech: initialSpeech,
  setState: (state, message) => set({
    state,
    message: message || defaultMessageForState(state)
  }),
  setBridgeStatus: (bridgeStatus) => set({ bridgeStatus }),
  setDesktopStatus: (desktopStatus) => set({ desktopStatus }),
  pushEvent: (event) => set((current) => ({
    recentEvents: [event, ...current.recentEvents].slice(0, 12)
  })),
  setRecentEvents: (recentEvents) => set({ recentEvents }),
  setAvatarSource: (sourceUrl) => set((current) => ({
    avatar: {
      ...current.avatar,
      sourceUrl
    }
  })),
  setAvatarScale: (scale) => set((current) => ({
    avatar: {
      ...current.avatar,
      scale
    }
  })),
  setAvatarLoading: (sourceUrl, kind) => set((current) => ({
    avatar: {
      ...current.avatar,
      sourceUrl,
      kind,
      status: "loading",
      error: undefined,
      note: `Loading ${kind.toUpperCase()} avatar`
    }
  })),
  setAvatarReady: (patch) => set((current) => ({
    avatar: {
      ...current.avatar,
      ...patch,
      status: "ready",
      error: undefined,
      note: patch.kind ? `${patch.kind.toUpperCase()} avatar ready` : current.avatar.note
    }
  })),
  setAvatarError: (error, sourceUrl, kind) => set((current) => ({
    avatar: {
      ...current.avatar,
      sourceUrl: sourceUrl ?? current.avatar.sourceUrl,
      kind: kind ?? current.avatar.kind,
      status: "error",
      error,
      note: "Avatar hit a hiccup"
    }
  })),
  useFallbackAvatar: () => set((current) => ({
    avatar: {
      ...fallbackAvatar,
      scale: current.avatar.scale || 1
    }
  })),
  setSpeechListening: (active, interimText) => set((current) => ({
    speech: {
      ...current.speech,
      listening: active,
      interimText: active ? (interimText ?? current.speech.interimText) : "",
      warmingMic: false,
      bargeInReady: false,
      bargingIn: false,
      error: undefined
    }
  })),
  setSpeechSpeaking: (active, bubbleText) => set((current) => ({
    speech: {
      ...current.speech,
      speaking: active,
      bubbleText: bubbleText ?? current.speech.bubbleText,
      amplitude: active ? Math.max(current.speech.amplitude, 0.55) : 0,
      warmingMic: false,
      bargeInReady: active ? current.speech.bargeInReady : false,
      bargingIn: active ? current.speech.bargingIn : false
    }
  })),
  setSpeechLoop: (active) => set((current) => ({
    speech: {
      ...current.speech,
      loopActive: active,
      warmingMic: active ? current.speech.warmingMic : false,
      bargeInReady: active ? current.speech.bargeInReady : false,
      bargingIn: active ? current.speech.bargingIn : false,
      error: active ? undefined : current.speech.error
    }
  })),
  setSpeechBubble: (text) => set((current) => ({
    speech: {
      ...current.speech,
      bubbleText: text
    }
  })),
  setSpeechAmplitude: (value) => set((current) => ({
    speech: {
      ...current.speech,
      amplitude: Math.max(0, Math.min(1, value))
    }
  })),
  setSpeechBargeState: (ready, barging) => set((current) => ({
    speech: {
      ...current.speech,
      bargeInReady: ready,
      bargingIn: barging ?? (ready ? current.speech.bargingIn : false),
      warmingMic: barging ? false : current.speech.warmingMic
    }
  })),
  setSpeechWarmingMic: (active, bubbleText) => set((current) => ({
    speech: {
      ...current.speech,
      warmingMic: active,
      bubbleText: bubbleText ?? current.speech.bubbleText,
      bargeInReady: active ? false : current.speech.bargeInReady,
      bargingIn: active ? false : current.speech.bargingIn
    }
  })),
  setSpeechError: (error) => set((current) => ({
    speech: {
      ...current.speech,
      error
    }
  })),
  clearSpeechBubble: () => set((current) => ({
    speech: {
      ...current.speech,
      bubbleText: "",
      interimText: "",
      amplitude: 0,
      warmingMic: false,
      bargeInReady: false,
      bargingIn: false,
      error: undefined
    }
  }))
}));
