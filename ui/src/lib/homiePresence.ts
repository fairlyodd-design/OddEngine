import { loadJSON, saveJSON } from "./storage";
import type { Prefs } from "./prefs";

export const HOMIE_PRESENCE_KEY = "oddengine:homie:presence:v1";
export const HOMIE_PRESENCE_EVENT = "oddengine:homie-presence-changed";

export type HomiePresenceState = {
  conversationMode: boolean;
  wakeWordEnabled: boolean;
  visionEnabled: boolean;
  presenceActionsEnabled: boolean;
  memoryContextEnabled: boolean;
  desktopControlsEnabled: boolean;
  missionControlEnabled: boolean;
  checkInStyle: "gentle" | "balanced" | "active";
  statusNote: string;
  lastUpdated: number;
};

export const DEFAULT_HOMIE_PRESENCE: HomiePresenceState = {
  conversationMode: true,
  wakeWordEnabled: false,
  visionEnabled: false,
  presenceActionsEnabled: true,
  memoryContextEnabled: true,
  desktopControlsEnabled: true,
  missionControlEnabled: true,
  checkInStyle: "balanced",
  statusNote: "Homie is online and ready to help with guided setup, daily flow, and mission control.",
  lastUpdated: Date.now(),
};

function mergePresence(raw: Partial<HomiePresenceState> | null | undefined): HomiePresenceState {
  return {
    ...DEFAULT_HOMIE_PRESENCE,
    ...(raw || {}),
    lastUpdated: typeof raw?.lastUpdated === "number" ? raw.lastUpdated : Date.now(),
  };
}

export function loadHomiePresence(): HomiePresenceState {
  return mergePresence(loadJSON<Partial<HomiePresenceState> | null>(HOMIE_PRESENCE_KEY, null));
}

export function saveHomiePresence(next: HomiePresenceState) {
  const payload = { ...next, lastUpdated: Date.now() };
  saveJSON(HOMIE_PRESENCE_KEY, payload);
  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(new CustomEvent(HOMIE_PRESENCE_EVENT, { detail: payload }));
    } catch {
      // no-op
    }
  }
}

export function patchHomiePresence(patch: Partial<HomiePresenceState>) {
  saveHomiePresence({ ...loadHomiePresence(), ...patch, lastUpdated: Date.now() });
}

export function enableHomieMissionControlBaseline() {
  patchHomiePresence({
    conversationMode: true,
    wakeWordEnabled: true,
    visionEnabled: true,
    presenceActionsEnabled: true,
    memoryContextEnabled: true,
    desktopControlsEnabled: true,
    missionControlEnabled: true,
    checkInStyle: "balanced",
    statusNote: "Homie mission control baseline is enabled for daily guidance, conversation, and desktop help.",
  });
}

export type HomieMissionCheck = {
  id: string;
  label: string;
  ready: boolean;
  note: string;
};

export function getHomieMissionChecks(presence: HomiePresenceState, prefs: Prefs): HomieMissionCheck[] {
  const bridgeConfigured =
    prefs.ai.homieVoiceEngineMode === "cloud" ||
    Boolean((prefs.ai.homieExternalVoiceBaseUrl || "").trim());
  const voiceReady = prefs.ai.homieVoiceEnabled && bridgeConfigured;
  return [
    {
      id: "voice",
      label: "Voice foundation",
      ready: voiceReady,
      note: voiceReady
        ? `Voice is enabled in ${prefs.ai.homieVoiceEngineMode} mode with ${prefs.ai.homieVoiceProfile} profile.`
        : "Voice still needs a working mode, bridge path, or enabled toggle.",
    },
    {
      id: "conversation",
      label: "Conversation mode",
      ready: presence.conversationMode,
      note: presence.conversationMode
        ? "Homie can stay in a guided conversation flow instead of one-shot replies."
        : "Conversation mode is off, so Homie behaves more like a quick helper than a companion.",
    },
    {
      id: "wake",
      label: "Wake word",
      ready: presence.wakeWordEnabled,
      note: presence.wakeWordEnabled
        ? "Wake flow is marked ready for hands-off conversation mode later."
        : "Wake flow is still staged and needs to be marked ready.",
    },
    {
      id: "vision",
      label: "Vision layer",
      ready: presence.visionEnabled,
      note: presence.visionEnabled
        ? "Homie is allowed to grow into camera / vision presence."
        : "Vision is still intentionally off until the camera layer is ready.",
    },
    {
      id: "memory",
      label: "Memory + context",
      ready: presence.memoryContextEnabled,
      note: presence.memoryContextEnabled
        ? "Homie can use local context to keep the OS feeling continuous."
        : "Memory/context is limited, so Homie acts more stateless.",
    },
    {
      id: "desktop",
      label: "Desktop controls",
      ready: presence.desktopControlsEnabled,
      note: presence.desktopControlsEnabled
        ? "Desktop helper actions are allowed when the shell is running in desktop mode."
        : "Desktop helper actions are intentionally locked down right now.",
    },
    {
      id: "mission",
      label: "Mission control",
      ready: presence.missionControlEnabled,
      note: presence.missionControlEnabled
        ? "Home + Preferences + Homie are linked as one guided mission-control flow."
        : "Mission-control guidance is still treated like a loose collection of rooms.",
    },
  ];
}

export function getHomieMissionReadiness(presence: HomiePresenceState, prefs: Prefs) {
  const checks = getHomieMissionChecks(presence, prefs);
  const readyCount = checks.filter((item) => item.ready).length;
  const readiness = Math.round((readyCount / Math.max(checks.length, 1)) * 100);
  return { checks, readyCount, total: checks.length, readiness };
}
