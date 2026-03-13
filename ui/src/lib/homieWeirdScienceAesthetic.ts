import type { CSSProperties } from "react";

export type HomieMood =
  | "warm"
  | "listening"
  | "speaking"
  | "thinking"
  | "truthful-warning"
  | "celebrating";

export type HomieTheme = {
  mood: HomieMood;
  title: string;
  subtitle: string;
  panelGlow: string;
  avatarGlow: string;
  accent: string;
  text: string;
  chipBg: string;
  chipText: string;
  cardBorder: string;
  overlayStyle: CSSProperties;
};

const THEMES: Record<HomieMood, HomieTheme> = {
  warm: {
    mood: "warm",
    title: "Warm Lab Companion",
    subtitle: "Friendly, grounded, and ready to help the family.",
    panelGlow: "radial-gradient(circle at top, rgba(255,145,77,0.18), rgba(0,0,0,0) 55%)",
    avatarGlow: "0 0 42px rgba(255, 170, 92, 0.28)",
    accent: "#ffb36b",
    text: "#fdf2e8",
    chipBg: "rgba(255,179,107,0.14)",
    chipText: "#ffd2ad",
    cardBorder: "rgba(255,179,107,0.28)",
    overlayStyle: {
      background:
        "linear-gradient(135deg, rgba(255,138,76,0.08), rgba(78,148,255,0.04))",
    },
  },
  listening: {
    mood: "listening",
    title: "Listening",
    subtitle: "Mic is on. Homie is focused and paying attention.",
    panelGlow: "radial-gradient(circle at top, rgba(78,148,255,0.20), rgba(0,0,0,0) 55%)",
    avatarGlow: "0 0 42px rgba(109, 178, 255, 0.30)",
    accent: "#88bbff",
    text: "#eef5ff",
    chipBg: "rgba(136,187,255,0.14)",
    chipText: "#cfe1ff",
    cardBorder: "rgba(136,187,255,0.28)",
    overlayStyle: {
      background:
        "linear-gradient(135deg, rgba(78,148,255,0.10), rgba(122,213,255,0.04))",
    },
  },
  speaking: {
    mood: "speaking",
    title: "Speaking",
    subtitle: "Homie is replying with calm, clear guidance.",
    panelGlow: "radial-gradient(circle at top, rgba(129,255,193,0.18), rgba(0,0,0,0) 55%)",
    avatarGlow: "0 0 42px rgba(129,255,193,0.24)",
    accent: "#8dffbf",
    text: "#ecfff5",
    chipBg: "rgba(141,255,191,0.12)",
    chipText: "#cbffe0",
    cardBorder: "rgba(141,255,191,0.24)",
    overlayStyle: {
      background:
        "linear-gradient(135deg, rgba(63,210,157,0.09), rgba(0,0,0,0.02))",
    },
  },
  thinking: {
    mood: "thinking",
    title: "Thinking",
    subtitle: "Processing context and choosing the next best step.",
    panelGlow: "radial-gradient(circle at top, rgba(180,110,255,0.18), rgba(0,0,0,0) 55%)",
    avatarGlow: "0 0 42px rgba(187,124,255,0.24)",
    accent: "#c495ff",
    text: "#f6ecff",
    chipBg: "rgba(196,149,255,0.12)",
    chipText: "#e3ccff",
    cardBorder: "rgba(196,149,255,0.24)",
    overlayStyle: {
      background:
        "linear-gradient(135deg, rgba(166,102,255,0.10), rgba(255,142,232,0.04))",
    },
  },
  "truthful-warning": {
    mood: "truthful-warning",
    title: "Truthful Warning",
    subtitle: "Something needs attention. Homie keeps it kind and real.",
    panelGlow: "radial-gradient(circle at top, rgba(255,91,91,0.18), rgba(0,0,0,0) 55%)",
    avatarGlow: "0 0 42px rgba(255, 110, 110, 0.24)",
    accent: "#ff8e8e",
    text: "#fff0f0",
    chipBg: "rgba(255,142,142,0.12)",
    chipText: "#ffd5d5",
    cardBorder: "rgba(255,142,142,0.24)",
    overlayStyle: {
      background:
        "linear-gradient(135deg, rgba(255,91,91,0.11), rgba(255,173,112,0.03))",
    },
  },
  celebrating: {
    mood: "celebrating",
    title: "Celebrating",
    subtitle: "A small win deserves a little spark without losing focus.",
    panelGlow: "radial-gradient(circle at top, rgba(255,214,79,0.20), rgba(0,0,0,0) 55%)",
    avatarGlow: "0 0 46px rgba(255,214,79,0.26)",
    accent: "#ffd65e",
    text: "#fff8d8",
    chipBg: "rgba(255,214,94,0.12)",
    chipText: "#fff0ad",
    cardBorder: "rgba(255,214,94,0.26)",
    overlayStyle: {
      background:
        "linear-gradient(135deg, rgba(255,214,79,0.10), rgba(255,161,79,0.04))",
    },
  },
};

export function getHomieTheme(mood: HomieMood): HomieTheme {
  return THEMES[mood] || THEMES.warm;
}

export function getTruthfulEncouragement(
  mood: HomieMood,
  nextAction?: string,
): string {
  const action = nextAction ? ` Next clean move: ${nextAction}.` : "";
  switch (mood) {
    case "truthful-warning":
      return `Something still needs attention, but you're closer than it feels.${action}`;
    case "thinking":
      return `I'm sorting the signal from the noise so we can move with clarity.${action}`;
    case "listening":
      return `I'm with you. Tell me what's off and we'll steady it.${action}`;
    case "speaking":
      return `Here's the honest read and the practical next step.${action}`;
    case "celebrating":
      return `That worked. Let's enjoy the win and keep the momentum clean.${action}`;
    default:
      return `We're building something real here. I'll keep it warm, helpful, and truthful.${action}`;
  }
}

export const HOMIE_LOOK_AND_FEEL_NOTES = [
  "Retro-futurist garage-lab glow",
  "Warm family-safe sci-fi energy",
  "Rounded silhouette and softer facial shapes",
  "Subtle overlay effects instead of loud gimmicks",
  "Truthful encouragement over empty hype",
];
