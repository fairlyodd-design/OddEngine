import { useEffect, useMemo, useState } from "react";

export type HomiePanelKind =
  | "Home"
  | "Homie"
  | "Books"
  | "GroceryMeals"
  | "FamilyBudget"
  | "Calendar"
  | "Preferences"
  | "Studio"
  | "Unknown";

export type HomieEmotion =
  | "idle"
  | "listening"
  | "speaking"
  | "thinking"
  | "happy"
  | "concerned"
  | "celebrating"
  | "focused"
  | "sleepy";

export type HomieMotionState = {
  blinkClosed: boolean;
  blinkProgress: number;
  breatheScale: number;
  headTiltDeg: number;
  bodyBobPx: number;
  armSwingDeg: number;
  handLiftPx: number;
  mouthOpen: number;
  emotion: HomieEmotion;
  panelLabel: string;
  palette: {
    shell: string;
    shellAccent: string;
    face: string;
    visor: string;
    line: string;
    glow: string;
  };
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function emotionFromPanel(panel: HomiePanelKind): HomieEmotion {
  switch (panel) {
    case "Books":
    case "Studio":
      return "focused";
    case "GroceryMeals":
      return "happy";
    case "FamilyBudget":
      return "concerned";
    case "Calendar":
      return "thinking";
    case "Preferences":
      return "listening";
    case "Home":
      return "idle";
    default:
      return "idle";
  }
}

export function panelLabel(panel: HomiePanelKind) {
  if (panel === "Books") return "Studio";
  if (panel === "Unknown") return "Everywhere";
  return panel;
}

export function paletteForEmotion(emotion: HomieEmotion) {
  const base = {
    shell: "#0c1220",
    shellAccent: "#1f2f54",
    face: "#f4f7fb",
    visor: "#7be7ff",
    line: "#b7caea",
    glow: "rgba(123,231,255,0.28)",
  };

  switch (emotion) {
    case "happy":
      return { ...base, visor: "#8df89f", glow: "rgba(141,248,159,0.28)" };
    case "concerned":
      return { ...base, visor: "#ffd27a", glow: "rgba(255,210,122,0.28)" };
    case "celebrating":
      return { ...base, visor: "#ff9cf8", glow: "rgba(255,156,248,0.28)" };
    case "focused":
      return { ...base, visor: "#8ec5ff", glow: "rgba(142,197,255,0.28)" };
    case "speaking":
      return { ...base, visor: "#95f1ff", glow: "rgba(149,241,255,0.32)" };
    case "listening":
      return { ...base, visor: "#82ffd9", glow: "rgba(130,255,217,0.28)" };
    default:
      return base;
  }
}

export function useHomieAnimationEmotion(options?: {
  panel?: HomiePanelKind;
  emotion?: HomieEmotion;
  speaking?: boolean;
  listening?: boolean;
}) {
  const panel = options?.panel ?? "Homie";
  const derivedEmotion =
    options?.emotion ??
    (options?.speaking
      ? "speaking"
      : options?.listening
      ? "listening"
      : emotionFromPanel(panel));

  const [now, setNow] = useState(() => Date.now());
  const [blinkClosed, setBlinkClosed] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 80);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const blink = () => {
      setBlinkClosed(true);
      window.setTimeout(() => setBlinkClosed(false), 120);
    };
    const id = window.setInterval(blink, 2600 + Math.round(Math.random() * 1800));
    return () => window.clearInterval(id);
  }, []);

  return useMemo<HomieMotionState>(() => {
    const t = now / 1000;
    const breatheScale = 1 + Math.sin(t * 1.4) * 0.018;
    const bodyBobPx = Math.sin(t * 1.4) * 3;
    const headTiltDeg =
      derivedEmotion === "concerned"
        ? -4 + Math.sin(t * 0.9) * 2
        : derivedEmotion === "happy"
        ? 2 + Math.sin(t * 1.3) * 2
        : Math.sin(t * 0.9) * 1.6;
    const armSwingDeg =
      derivedEmotion === "celebrating"
        ? Math.sin(t * 6) * 18
        : derivedEmotion === "speaking"
        ? Math.sin(t * 4.5) * 9
        : derivedEmotion === "listening"
        ? Math.sin(t * 1.8) * 4
        : Math.sin(t * 1.2) * 2.5;
    const handLiftPx =
      derivedEmotion === "celebrating"
        ? Math.abs(Math.sin(t * 5.2)) * 16
        : derivedEmotion === "speaking"
        ? Math.abs(Math.sin(t * 3.5)) * 7
        : 0;

    const mouthOpen = clamp(
      derivedEmotion === "speaking"
        ? 0.42 + Math.abs(Math.sin(t * 8)) * 0.52
        : derivedEmotion === "happy"
        ? 0.18
        : derivedEmotion === "concerned"
        ? 0.1
        : 0.05,
      0,
      1
    );

    return {
      blinkClosed,
      blinkProgress: blinkClosed ? 1 : 0,
      breatheScale,
      headTiltDeg,
      bodyBobPx,
      armSwingDeg,
      handLiftPx,
      mouthOpen,
      emotion: derivedEmotion,
      panelLabel: panelLabel(panel),
      palette: paletteForEmotion(derivedEmotion),
    };
  }, [blinkClosed, derivedEmotion, now, panel]);
}

export function homieReactionCopy(emotion: HomieEmotion, panel: HomiePanelKind) {
  const label = panelLabel(panel);
  switch (emotion) {
    case "happy":
      return `Homie is feeling upbeat about ${label}.`;
    case "concerned":
      return `Homie is watching ${label} closely.`;
    case "focused":
      return `Homie is locked in on ${label}.`;
    case "speaking":
      return `Homie is talking through the next move.`;
    case "listening":
      return `Homie is listening for your next command.`;
    case "celebrating":
      return `Homie is celebrating a win in ${label}.`;
    default:
      return `Homie is standing by in ${label}.`;
  }
}
