import { loadJSON, saveJSON } from "./storage";

export type GlobalRunStatus = "queued" | "running" | "blocked" | "completed" | "failed";

export type SystemRun = {
  id: string;
  scope: string;
  title: string;
  panelId?: string;
  source?: string;
  sourceId?: string;
  status: GlobalRunStatus;
  explanation?: string;
  userActionNeeded?: string;
  artifactIds?: string[];
  receiptIds?: string[];
  connectorKeys?: string[];
  createdAt: number;
  updatedAt: number;
};

const KEY = "oddengine:systemTruth:runs:v1";
const EVENT = "oddengine:system-truth:runs";

function uid() {
  return `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function save(runs: SystemRun[]) {
  saveJSON(KEY, runs.slice(0, 300));
  try { window.dispatchEvent(new CustomEvent(EVENT)); } catch {}
}

export function listSystemRuns(): SystemRun[] {
  return loadJSON<SystemRun[]>(KEY, []).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export function getSystemRun(id: string) {
  return listSystemRuns().find((item) => item.id === id) || null;
}

export function createSystemRun(input: Omit<Partial<SystemRun>, "id" | "createdAt" | "updatedAt"> & Pick<SystemRun, "scope" | "title">): SystemRun {
  const run: SystemRun = {
    id: uid(),
    scope: input.scope,
    title: input.title,
    panelId: input.panelId,
    source: input.source,
    sourceId: input.sourceId,
    status: input.status || "queued",
    explanation: input.explanation,
    userActionNeeded: input.userActionNeeded,
    artifactIds: input.artifactIds || [],
    receiptIds: input.receiptIds || [],
    connectorKeys: input.connectorKeys || [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  save([run, ...listSystemRuns().filter((item) => item.id !== run.id)]);
  return run;
}

export function upsertSystemRun(run: SystemRun) {
  run.updatedAt = Date.now();
  save([run, ...listSystemRuns().filter((item) => item.id !== run.id)]);
  return run;
}

export function updateSystemRun(id: string, patch: Partial<SystemRun>) {
  const current = getSystemRun(id);
  if (!current) return null;
  const next = { ...current, ...patch, updatedAt: Date.now() };
  upsertSystemRun(next);
  return next;
}

export function touchSystemRunBySource(source: string, sourceId: string, patch: Partial<SystemRun> & Pick<SystemRun, "scope" | "title">) {
  const current = listSystemRuns().find((item) => item.source === source && item.sourceId === sourceId);
  if (current) return updateSystemRun(current.id, patch);
  return createSystemRun({ ...patch, source, sourceId });
}

export function attachArtifactToRun(runId: string, artifactId: string) {
  const current = getSystemRun(runId);
  if (!current) return null;
  const artifactIds = Array.from(new Set([...(current.artifactIds || []), artifactId]));
  return updateSystemRun(runId, { artifactIds });
}

export function attachReceiptToRun(runId: string, receiptId: string) {
  const current = getSystemRun(runId);
  if (!current) return null;
  const receiptIds = Array.from(new Set([...(current.receiptIds || []), receiptId]));
  return updateSystemRun(runId, { receiptIds });
}

export function summarizeRunStatus() {
  const runs = listSystemRuns();
  return {
    queued: runs.filter((item) => item.status === "queued").length,
    running: runs.filter((item) => item.status === "running").length,
    blocked: runs.filter((item) => item.status === "blocked").length,
    completed: runs.filter((item) => item.status === "completed").length,
    failed: runs.filter((item) => item.status === "failed").length,
  };
}

export const SYSTEM_RUN_EVENT = EVENT;
