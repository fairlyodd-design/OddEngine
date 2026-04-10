import type { AvatarRuntime } from "./avatar";

export type HomieState = "idle" | "listening" | "talking" | "alert" | "celebrate";

export type DesktopStatus = {
  ok: boolean;
  bounds?: { width: number; height: number; x: number; y: number };
  alwaysOnTop?: boolean;
  display?: { id: number; label: string };
  displays?: Array<{ id: number; label: string }>;
};

export type HomieMessage = {
  title: string;
  body: string;
};

export type SpeechRuntime = {
  listening: boolean;
  speaking: boolean;
  loopActive: boolean;
  bubbleText: string;
  interimText: string;
  amplitude: number;
  bargeInReady: boolean;
  bargingIn: boolean;
  warmingMic: boolean;
  error?: string;
};

export type HomieSceneConfig = {
  avatar: AvatarRuntime;
};
