import { loadJSON, saveJSON } from "./storage";

export type RegisteredArtifact = {
  id: string;
  title: string;
  kind: string;
  source: string;
  sourceId?: string;
  runId?: string;
  status: "ready" | "render-needed" | "published" | "failed";
  createdAt: number;
  updatedAt: number;
};

const KEY = "oddengine:systemTruth:artifacts:v1";
const EVENT = "oddengine:system-truth:artifacts";

function uid() {
  return `registry-artifact-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function save(items: RegisteredArtifact[]) {
  saveJSON(KEY, items.slice(0, 300));
  try { window.dispatchEvent(new CustomEvent(EVENT)); } catch {}
}

export function listRegisteredArtifacts(): RegisteredArtifact[] {
  return loadJSON<RegisteredArtifact[]>(KEY, []).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export function upsertRegisteredArtifact(input: Omit<RegisteredArtifact, "updatedAt"> & { updatedAt?: number }) {
  const artifact: RegisteredArtifact = { ...input, updatedAt: input.updatedAt || Date.now() };
  save([artifact, ...listRegisteredArtifacts().filter((item) => item.id !== artifact.id)]);
  return artifact;
}

export function registerArtifact(input: Omit<RegisteredArtifact, "id" | "createdAt" | "updatedAt"> & { id?: string; createdAt?: number }) {
  return upsertRegisteredArtifact({
    id: input.id || uid(),
    title: input.title,
    kind: input.kind,
    source: input.source,
    sourceId: input.sourceId,
    runId: input.runId,
    status: input.status,
    createdAt: input.createdAt || Date.now(),
  });
}

export const ARTIFACT_REGISTRY_EVENT = EVENT;
