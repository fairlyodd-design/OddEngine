import { loadJSON, saveJSON } from "./storage";

export type HomieCompanionAttitude = "steady" | "gentle" | "focused" | "playful";
export type HomieCompanionProactivity = "quiet" | "balanced" | "on-it";
export type HomieCompanionCheckIn = "light" | "supportive" | "direct";

export type HomieCompanionSettings = {
  attitude: HomieCompanionAttitude;
  proactivity: HomieCompanionProactivity;
  checkInStyle: HomieCompanionCheckIn;
  proactiveCheckins: boolean;
  ambientPresence: boolean;
  signature: string;
};

export const HOMIE_COMPANION_KEY = "oddengine:homie:companion:v1";
export const HOMIE_COMPANION_EVENT = "oddengine:homie-companion-changed";

export const DEFAULT_HOMIE_COMPANION: HomieCompanionSettings = {
  attitude: "gentle",
  proactivity: "balanced",
  checkInStyle: "supportive",
  proactiveCheckins: true,
  ambientPresence: true,
  signature: "I'm right here with you.",
};

export function loadHomieCompanion(): HomieCompanionSettings {
  const raw = loadJSON<Partial<HomieCompanionSettings> | null>(HOMIE_COMPANION_KEY, null);
  return { ...DEFAULT_HOMIE_COMPANION, ...(raw || {}) };
}

export function saveHomieCompanion(next: HomieCompanionSettings) {
  saveJSON(HOMIE_COMPANION_KEY, next);
  try {
    window.dispatchEvent(new CustomEvent(HOMIE_COMPANION_EVENT, { detail: next }));
  } catch {
    // noop
  }
}

export function patchHomieCompanion(patch: Partial<HomieCompanionSettings>) {
  saveHomieCompanion({ ...loadHomieCompanion(), ...patch });
}

export function describeCompanion(settings: HomieCompanionSettings) {
  const attitude = {
    steady: "calm, grounded, and in-your-corner",
    gentle: "soft-spoken, reassuring, and patient",
    focused: "direct, practical, and mission-minded",
    playful: "warm, curious, and lightly witty",
  }[settings.attitude];

  const pace = {
    quiet: "waits for you to lead",
    balanced: "checks in when it helps",
    "on-it": "leans forward with the next move",
  }[settings.proactivity];

  const checkIn = {
    light: "quick nudges without pressure",
    supportive: "grounded reassurance with the next step",
    direct: "clear truth-first prompts and decisions",
  }[settings.checkInStyle];

  return { attitude, pace, checkIn };
}

export function getCompanionSignals(settings: HomieCompanionSettings, missionReadiness: number, wakeReadiness: number, activePanel: string = "Home") {
  const readiness = Math.round((missionReadiness + wakeReadiness) / 2);
  const mood = missionReadiness >= 75
    ? "present"
    : missionReadiness >= 45
      ? "warming up"
      : "still staging";
  const headline = settings.attitude === "focused"
    ? `Homie is in ${mood} mode and ready to keep ${activePanel} moving.`
    : settings.attitude === "gentle"
      ? `Homie is in ${mood} mode and staying close without crowding you.`
      : settings.attitude === "playful"
        ? `Homie is in ${mood} mode and keeping the room light but useful.`
        : `Homie is in ${mood} mode and keeping things grounded.`;
  const body = settings.checkInStyle === "direct"
    ? `Readiness is ${readiness}%. I'll tell you the truth, keep the next move simple, and avoid noise.`
    : settings.checkInStyle === "light"
      ? `Readiness is ${readiness}%. Small check-ins, clean next steps, and no over-talking.`
      : `Readiness is ${readiness}%. I'll stay in your corner, keep context in view, and help one step at a time.`;
  return { readiness, mood, headline, body };
}

export function getCompanionModeLabel(activePanel: string) {
  const id = String(activePanel || "Home");
  if (["Trading", "TradingPanel", "TradingDeskPanel", "OptionsSniper", "OptionsSniperTerminal", "MarketGraph", "MarketGraphPanel", "MarketMap"].includes(id)) return "Trading mode";
  if (["Books", "Studio", "DirectorRoom", "WritingRoom", "MusicLab", "RenderLab"].includes(id)) return "Studio mode";
  if (["FamilyBudget", "DailyChores", "GroceryMeals", "Calendar", "Entertainment"].includes(id)) return "Family mode";
  if (["Preferences", "Homie"].includes(id)) return "Homie mode";
  return "Home mode";
}

export function getCompanionPresenceCopy(activePanel: string, settings: HomieCompanionSettings, readiness: number) {
  const mode = getCompanionModeLabel(activePanel);
  const lead = settings.attitude === "playful"
    ? "Homie feels alive, curious, and ready to keep you company."
    : settings.attitude === "focused"
      ? "Homie feels locked in and ready to help with the next clear move."
      : settings.attitude === "gentle"
        ? "Homie feels calm, close, and easy to lean on."
        : "Homie feels steady, grounded, and in your corner.";
  const detail = readiness >= 75
    ? "Readiness is strong, so Homie can stay present without crowding you."
    : readiness >= 45
      ? "Readiness is building, so Homie should feel supportive and low-pressure."
      : "Readiness is still warming up, so Homie should stay close and keep things simple.";
  return { mode, lead, detail };
}

export function getCompanionPrompts(context: "home" | "homie" | "preferences" = "home") {
  const base = [
    "Keep it simple and tell me the next best move.",
    "Stay with me on this and help me finish one thing cleanly.",
    "Ground me first, then help me move.",
    "Be direct and tell me what matters right now.",
  ];
  if (context === "homie") {
    return [
      "Talk to me like you're in my corner and help me sort this out.",
      "Help me focus without turning this into a giant checklist.",
      ...base.slice(1),
    ];
  }
  if (context === "preferences") {
    return [
      "Tune Homie so the vibe feels supportive, grounded, and clear.",
      "I want companion energy, not dashboard-helper energy.",
      ...base.slice(2),
    ];
  }
  return base;
}
