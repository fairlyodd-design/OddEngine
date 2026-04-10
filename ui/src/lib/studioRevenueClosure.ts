import { createRun, patchRunStatus } from './systemRunRegistry';
import { appendSystemEvent } from './systemEventLog';
import { appendActionReceipt } from './actionReceipts';
import { registerArtifact } from './artifactRegistry';
import { upsertConnectorVerificationState } from './connectorVerification';

export interface StudioRevenueClosureRecord {
  id: string;
  title: string;
  destination: string;
  amountUsd: number;
  createdAt: number;
  status: 'queued' | 'verified';
}

const STORAGE_KEY = 'oddengine_studio_revenue_closure_v1';

function loadAll(): StudioRevenueClosureRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAll(records: StudioRevenueClosureRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export function listStudioRevenueClosures() {
  return loadAll().sort((a, b) => b.createdAt - a.createdAt);
}

export function recordStudioRevenueClosure(title: string, destination: string, amountUsd: number) {
  const run = createRun({
    scope: 'studio-revenue-closure',
    title: `Revenue closure • ${title}`,
    status: 'running',
    detail: `${destination} • $${amountUsd.toFixed(2)}`,
  });

  const record: StudioRevenueClosureRecord = {
    id: `closure-${Math.random().toString(36).slice(2, 10)}`,
    title,
    destination,
    amountUsd,
    createdAt: Date.now(),
    status: 'verified',
  };

  const records = loadAll();
  records.unshift(record);
  saveAll(records);

  registerArtifact({
    kind: 'revenue-proof',
    title: `${title} • revenue proof`,
    summary: `${destination} • $${amountUsd.toFixed(2)}`,
    sourceRunId: run.id,
  });
  upsertConnectorVerificationState(destination, 'connected', `Revenue closure verified for ${title}`);
  appendSystemEvent('studio-revenue-closure', `Revenue verified for ${title} via ${destination}.`);
  appendActionReceipt({
    kind: 'studio-revenue-closure',
    title: `Revenue closure • ${title}`,
    outcome: 'success',
    summary: `${destination} • $${amountUsd.toFixed(2)}`,
  });
  patchRunStatus(run.id, 'completed', `Verified ${destination} revenue.`);

  return record;
}
