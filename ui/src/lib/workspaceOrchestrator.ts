import { loadJSON, saveJSON } from "./storage";
import { loadFreeformWorkspace, type FreeformPaneRect } from "./layoutMemory";

export type WorkspacePreset = {
  id: string;
  name: string;
  note?: string;
  panes: Record<string, FreeformPaneRect>;
};

const WORKSPACE_PRESETS_KEY = "oddengine:freeformWorkspacePresets:v1";

export function loadWorkspacePresets(): WorkspacePreset[] {
  const raw = loadJSON<any[]>(WORKSPACE_PRESETS_KEY, []);
  if (!Array.isArray(raw)) return [];
  return raw.filter(Boolean).map((item, idx) => ({
    id: String(item?.id || `preset-${idx + 1}`),
    name: String(item?.name || `Preset ${idx + 1}`),
    note: item?.note ? String(item.note) : undefined,
    panes: item?.panes && typeof item.panes === "object" ? item.panes : {},
  }));
}

export function saveWorkspacePresets(presets: WorkspacePreset[]) {
  saveJSON(WORKSPACE_PRESETS_KEY, presets);
}

export function captureWorkspacePreset(name: string, note?: string): WorkspacePreset {
  const panes = loadFreeformWorkspace();
  return {
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || `preset-${Date.now()}`,
    name,
    note,
    panes,
  };
}

export function upsertWorkspacePreset(preset: WorkspacePreset) {
  const presets = loadWorkspacePresets();
  const next = [preset, ...presets.filter((item) => item.id !== preset.id)].slice(0, 16);
  saveWorkspacePresets(next);
  return next;
}

export function emitOperatorCommand(command: string) {
  window.dispatchEvent(new CustomEvent("oddengine:operator-command", { detail: { command } }));
}
