import React, { lazy } from "react";

type ModuleWithDefault<T extends React.ComponentType<any>> = { default: T };
type PanelLoader<T extends React.ComponentType<any>> = () => Promise<ModuleWithDefault<T>>;

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function isChunkFetchError(err: unknown) {
  const msg = String((err as any)?.message || err || "");
  return /Failed to fetch dynamically imported module|Importing a module script failed|fetch dynamically imported|Loading chunk|module script/i.test(msg);
}

async function importWithRetry<T extends React.ComponentType<any>>(loader: PanelLoader<T>, label: string, attempts = 4): Promise<ModuleWithDefault<T>> {
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await loader();
    } catch (err) {
      lastErr = err;
      if (!isChunkFetchError(err) && attempt >= 2) {
        break;
      }
      await wait(180 * attempt);
    }
  }
  const text = String((lastErr as any)?.message || lastErr || "Unknown lazy import failure");
  throw new Error(`[${label}] ${text}`);
}

export function lazyWithRetry<T extends React.ComponentType<any>>(loader: PanelLoader<T>, label: string) {
  return lazy(() => importWithRetry(loader, label));
}

const panelWarmers: Record<string, () => Promise<any>> = {
  Home: () => import("../panels/Home"),
  Trading: () => import("../panels/Trading"),
  Homie: () => import("../panels/Homie"),
  Brain: () => import("../panels/Brain"),
  OddBrain: () => import("../panels/OddBrain"),
  Money: () => import("../panels/Money"),
  Calendar: () => import("../panels/Calendar"),
};

const warmCache = new Map<string, Promise<any>>();

export function prewarmPanelModule(panelId: string) {
  const key = String(panelId || "").trim();
  const loader = panelWarmers[key];
  if (!loader) return Promise.resolve(null);
  if (warmCache.has(key)) return warmCache.get(key)!;
  const job = importWithRetry(loader as any, key, 3).catch(() => null);
  warmCache.set(key, job);
  return job;
}

export function preloadPanelModules(panelIds: string[]) {
  let cancelled = false;
  let timeoutHandle: number | null = null;
  let idleHandle: number | null = null;

  const run = () => {
    if (cancelled) return;
    panelIds.forEach((id, index) => {
      window.setTimeout(() => {
        if (!cancelled) void prewarmPanelModule(id);
      }, index * 120);
    });
  };

  if (typeof (window as any).requestIdleCallback === "function") {
    idleHandle = (window as any).requestIdleCallback(run, { timeout: 1600 });
  } else {
    timeoutHandle = window.setTimeout(run, 150);
  }

  return () => {
    cancelled = true;
    if (timeoutHandle !== null) window.clearTimeout(timeoutHandle);
    if (idleHandle !== null && typeof (window as any).cancelIdleCallback === "function") {
      (window as any).cancelIdleCallback(idleHandle);
    }
  };
}
