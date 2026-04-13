import { loadJSON, saveJSON } from "./storage";

export type RenderJobLike = { id: string; [key: string]: any };

const BUS_KEY = "__ODD_RENDER_JOBS__";
const EVENT_NAME = "odd-render-jobs-updated";

function getHost(): any {
  return globalThis as any;
}

export function getRenderJobBus<T extends RenderJobLike>(): T[] {
  const host = getHost();
  const current = host[BUS_KEY];
  return Array.isArray(current) ? current : [];
}

export function setRenderJobBus<T extends RenderJobLike>(jobs: T[]): T[] {
  const safeJobs = Array.isArray(jobs) ? jobs : [];
  const host = getHost();
  host[BUS_KEY] = safeJobs;
  try {
    host.dispatchEvent?.(new CustomEvent(EVENT_NAME, { detail: { jobs: safeJobs } }));
  } catch {}
  return safeJobs;
}

export function syncRenderJobBusFromStorage<T extends RenderJobLike>(storageKey: string): T[] {
  const jobs = loadJSON<T[]>(storageKey, []);
  return setRenderJobBus(jobs);
}

export function persistRenderJobs<T extends RenderJobLike>(storageKey: string, jobs: T[]): T[] {
  const synced = setRenderJobBus(jobs);
  saveJSON(storageKey, synced);
  try {
    globalThis.dispatchEvent?.(new StorageEvent("storage", { key: storageKey }));
  } catch {}
  return synced;
}

export function subscribeRenderJobBus(listener: (jobs: RenderJobLike[]) => void): () => void {
  const host = getHost();
  const handler = (event?: Event) => {
    const maybeDetail = (event as CustomEvent | undefined)?.detail as { jobs?: RenderJobLike[] } | undefined;
    listener(Array.isArray(maybeDetail?.jobs) ? maybeDetail!.jobs! : getRenderJobBus());
  };
  host.addEventListener?.(EVENT_NAME, handler as EventListener);
  return () => host.removeEventListener?.(EVENT_NAME, handler as EventListener);
}

export const RENDER_JOB_BUS_EVENT = EVENT_NAME;
