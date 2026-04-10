export interface WorkspaceSessionRecord {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  payload: any;
}

const STORAGE_KEY = 'oddengine_workspace_sessions_v1';

function loadAll(): WorkspaceSessionRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAll(records: WorkspaceSessionRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export function listWorkspaceSessions(): WorkspaceSessionRecord[] {
  return loadAll().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function saveWorkspaceSession(name: string, payload: any) {
  const now = Date.now();
  const records = loadAll();
  const existing = records.find((entry) => entry.name.toLowerCase() === name.trim().toLowerCase());
  if (existing) {
    existing.payload = payload;
    existing.updatedAt = now;
    saveAll(records);
    return existing;
  }
  const created: WorkspaceSessionRecord = {
    id: `workspace-${Math.random().toString(36).slice(2, 10)}`,
    name: name.trim() || 'Workspace session',
    createdAt: now,
    updatedAt: now,
    payload,
  };
  records.unshift(created);
  saveAll(records);
  return created;
}

export function loadWorkspaceSession(sessionId: string) {
  return loadAll().find((entry) => entry.id === sessionId) || null;
}

export function removeWorkspaceSession(sessionId: string) {
  const next = loadAll().filter((entry) => entry.id !== sessionId);
  saveAll(next);
}
