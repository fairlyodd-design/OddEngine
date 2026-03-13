import { isDesktop, oddApi } from "./odd";

export type HomieDesktopActionId =
  | "open-home"
  | "open-studio"
  | "open-grocery"
  | "open-family-budget"
  | "open-preferences"
  | "open-calendar"
  | "open-output-folder"
  | "open-packet-folder"
  | "reveal-latest-output"
  | "toggle-mic"
  | "toggle-camera"
  | "open-voice-settings";

export type HomieDesktopAction = {
  id: HomieDesktopActionId;
  label: string;
  description: string;
  requiresDesktop?: boolean;
  kind: "panel" | "path" | "toggle" | "settings";
};

const LS_MUTE = "oddengine:homie:micMuted:v1";
const LS_CAMERA = "oddengine:homie:cameraEnabled:v1";
const LS_LAST_OUTPUT_FOLDER = "oddengine:studio:lastOutputFolder:v1";
const LS_LAST_OUTPUT_FILE = "oddengine:studio:lastOutputFile:v1";
const LS_PACKET_FOLDER = "oddengine:studio:lastPacketFolder:v1";

function readString(key: string, fallback = "") {
  try {
    return String(localStorage.getItem(key) || fallback);
  } catch {
    return fallback;
  }
}

function readBool(key: string, fallback = false) {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function saveBool(key: string, value: boolean) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export function getHomieDesktopActions(): HomieDesktopAction[] {
  return [
    { id: "open-home", label: "Open Home", description: "Jump back to the OS home panel.", kind: "panel" },
    { id: "open-studio", label: "Open Studio", description: "Jump to the Studio workspace.", kind: "panel" },
    { id: "open-grocery", label: "Open Grocery", description: "Jump to Grocery Meals.", kind: "panel" },
    { id: "open-family-budget", label: "Open Family Budget", description: "Jump to Family Budget.", kind: "panel" },
    { id: "open-preferences", label: "Open Preferences", description: "Open the Connections & Secrets setup hub.", kind: "settings" },
    { id: "open-calendar", label: "Open Calendar", description: "Jump to Calendar.", kind: "panel" },
    { id: "open-output-folder", label: "Open Output Folder", description: "Open the latest known Studio output folder.", kind: "path", requiresDesktop: true },
    { id: "open-packet-folder", label: "Open Packet Folder", description: "Open the latest known packet export folder.", kind: "path", requiresDesktop: true },
    { id: "reveal-latest-output", label: "Reveal Latest Output", description: "Reveal the latest known render file or preview export.", kind: "path", requiresDesktop: true },
    { id: "toggle-mic", label: "Toggle Mic", description: "Mute or unmute Homie voice input.", kind: "toggle" },
    { id: "toggle-camera", label: "Toggle Camera", description: "Enable or disable Homie vision mode.", kind: "toggle" },
    { id: "open-voice-settings", label: "Open Voice Settings", description: "Jump to Preferences for mic / camera / voice setup.", kind: "settings" },
  ];
}

export function getHomieDesktopState() {
  return {
    desktop: isDesktop(),
    micMuted: readBool(LS_MUTE, false),
    cameraEnabled: readBool(LS_CAMERA, false),
    lastOutputFolder: readString(LS_LAST_OUTPUT_FOLDER, ""),
    lastOutputFile: readString(LS_LAST_OUTPUT_FILE, ""),
    packetFolder: readString(LS_PACKET_FOLDER, ""),
  };
}

export async function runHomieDesktopAction(
  actionId: HomieDesktopActionId,
  opts?: { onNavigate?: (panelId: string) => void },
): Promise<{ ok: boolean; message: string }> {
  const nav = opts?.onNavigate;
  const api = oddApi();
  const state = getHomieDesktopState();

  switch (actionId) {
    case "open-home":
      nav?.("Home");
      return { ok: true, message: "Opened Home." };
    case "open-studio":
      nav?.("Books");
      return { ok: true, message: "Opened Studio." };
    case "open-grocery":
      nav?.("GroceryMeals");
      return { ok: true, message: "Opened Grocery Meals." };
    case "open-family-budget":
      nav?.("FamilyBudget");
      return { ok: true, message: "Opened Family Budget." };
    case "open-preferences":
    case "open-voice-settings":
      nav?.("Preferences");
      return { ok: true, message: "Opened Preferences." };
    case "open-calendar":
      nav?.("Calendar");
      return { ok: true, message: "Opened Calendar." };
    case "toggle-mic": {
      const next = !state.micMuted;
      saveBool(LS_MUTE, next);
      return { ok: true, message: next ? "Mic muted." : "Mic live." };
    }
    case "toggle-camera": {
      const next = !state.cameraEnabled;
      saveBool(LS_CAMERA, next);
      return { ok: true, message: next ? "Camera enabled." : "Camera disabled." };
    }
    case "open-output-folder":
      if (!state.lastOutputFolder) return { ok: false, message: "No output folder saved yet." };
      if (api.openPath) {
        await api.openPath(state.lastOutputFolder);
        return { ok: true, message: "Opened output folder." };
      }
      return { ok: false, message: "Desktop openPath is not available." };
    case "open-packet-folder":
      if (!state.packetFolder) return { ok: false, message: "No packet folder saved yet." };
      if (api.openPath) {
        await api.openPath(state.packetFolder);
        return { ok: true, message: "Opened packet folder." };
      }
      return { ok: false, message: "Desktop openPath is not available." };
    case "reveal-latest-output":
      if (!state.lastOutputFile) return { ok: false, message: "No output file saved yet." };
      if (api.openPath) {
        await api.openPath(state.lastOutputFile);
        return { ok: true, message: "Revealed latest output." };
      }
      return { ok: false, message: "Desktop openPath is not available." };
    default:
      return { ok: false, message: "Unknown Homie desktop action." };
  }
}

export function buildHomieDesktopSummary() {
  const state = getHomieDesktopState();
  return {
    desktop: state.desktop,
    mic: state.micMuted ? "Muted" : "Live",
    camera: state.cameraEnabled ? "Enabled" : "Disabled",
    outputFolderReady: !!state.lastOutputFolder,
    outputFileReady: !!state.lastOutputFile,
    packetFolderReady: !!state.packetFolder,
  };
}
