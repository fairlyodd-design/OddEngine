import { getPanelMeta, normalizePanelId } from "./brain";
import { loadJSON, saveJSON } from "./storage";

export type WindowSession = {
  id: string;
  panelId: string;
  title: string;
  windowType: string;
  targetDisplayId?: string;
  width: number;
  height: number;
  launchedAt: number;
  status: "open" | "restored" | "closed";
  source?: string;
};

export type WorkspaceSnapshot = {
  id: string;
  name: string;
  savedAt: number;
  activePanelId: string;
  activeWorkspaceName?: string;
  sessions: WindowSession[];
};

const SESSIONS_KEY = "oddengine:true-window-sessions:v10.26.19c";
const SNAPSHOTS_KEY = "oddengine:true-workspace-snapshots:v10.26.19c";

function slug(value: string) {
  return String(value || "workspace")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "workspace";
}

export function listWindowSessions(): WindowSession[] {
  return loadJSON<WindowSession[]>(SESSIONS_KEY, []);
}

export function saveWindowSessions(items: WindowSession[]) {
  saveJSON(SESSIONS_KEY, items.slice(0, 80));
}

export function registerWindowSession(input: {
  panelId: string;
  width: number;
  height: number;
  targetDisplayId?: string;
  source?: string;
}) {
  const panelId = normalizePanelId(input.panelId || "Home");
  const meta = getPanelMeta(panelId);
  const session: WindowSession = {
    id: `${panelId}-${Date.now()}`,
    panelId,
    title: meta.title,
    windowType: `panel-${panelId}`,
    targetDisplayId: input.targetDisplayId || "",
    width: Math.max(320, Math.round(Number(input.width || 1280))),
    height: Math.max(240, Math.round(Number(input.height || 840))),
    launchedAt: Date.now(),
    status: "open",
    source: input.source || "manual",
  };
  saveWindowSessions([session, ...listWindowSessions().filter((item) => item.panelId !== panelId)].slice(0, 80));
  return session;
}

export function closeWindowSession(panelId: string) {
  const target = normalizePanelId(panelId || "");
  saveWindowSessions(listWindowSessions().map((item) => item.panelId === target ? { ...item, status: "closed" as const } : item));
}

export function listWorkspaceSnapshots(): WorkspaceSnapshot[] {
  return loadJSON<WorkspaceSnapshot[]>(SNAPSHOTS_KEY, []);
}

export function saveWorkspaceSnapshots(items: WorkspaceSnapshot[]) {
  saveJSON(SNAPSHOTS_KEY, items.slice(0, 16));
}

export function createWorkspaceSnapshot(input: {
  name: string;
  activePanelId: string;
  activeWorkspaceName?: string;
  sessions?: WindowSession[];
}) {
  const snapshot: WorkspaceSnapshot = {
    id: `${slug(input.name)}-${Date.now()}`,
    name: String(input.name || "Workspace Snapshot"),
    savedAt: Date.now(),
    activePanelId: normalizePanelId(input.activePanelId || "Home"),
    activeWorkspaceName: input.activeWorkspaceName || "",
    sessions: (input.sessions?.length ? input.sessions : listWindowSessions()).slice(0, 30),
  };
  saveWorkspaceSnapshots([snapshot, ...listWorkspaceSnapshots().filter((item) => item.name !== snapshot.name)].slice(0, 16));
  return snapshot;
}
