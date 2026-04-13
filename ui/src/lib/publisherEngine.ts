
import { addOutcome } from "./outcomeTracker";
import { hasSecret } from "./secretsVault";

export type PublishTarget = { platform: string; status: "ready" | "queued" | "publishing" | "published" | "failed"; url?: string; message?: string; updatedAt: number };
export type PublisherJob = {
  id: string;
  sourceId?: string;
  sourceTitle: string;
  contentType: string;
  createdAt: number;
  updatedAt: number;
  autoPublish?: boolean;
  targets: PublishTarget[];
  payload?: any;
  logs: string[];
};
const KEY = "oddengine:publisher:jobs:v1";
function load<T>(fallback: T): T { try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; } }
function save(v: any) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch {} }
function uid() { return Math.random().toString(16).slice(2) + Date.now().toString(16); }
export function normalizePlatform(raw: string) { return String(raw || 'local').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-') || 'local'; }
export function listPublisherJobs(): PublisherJob[] { return load<PublisherJob[]>([]).sort((a,b)=>b.updatedAt-a.updatedAt); }
export function createPublisherJob(input: { sourceId?: string; sourceTitle: string; contentType: string; targets: string[]; autoPublish?: boolean; payload?: any }) {
  const existing = listPublisherJobs().find(x => x.sourceId && x.sourceId === input.sourceId);
  if (existing) return existing;
  const item: PublisherJob = {
    id: uid(),
    sourceId: String(input.sourceId || ''),
    sourceTitle: String(input.sourceTitle || 'Untitled asset'),
    contentType: String(input.contentType || 'asset'),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    autoPublish: !!input.autoPublish,
    targets: (input.targets || ['local']).map((platform) => ({ platform: normalizePlatform(platform), status: hasSecret(normalizePlatform(platform)) ? 'queued' : 'ready', updatedAt: Date.now() })),
    payload: input.payload || null,
    logs: ['publish handoff created'],
  };
  const next = [item, ...listPublisherJobs()].slice(0, 500);
  save(next);
  return item;
}
export function updatePublisherJob(job: PublisherJob) {
  const next = [job, ...listPublisherJobs().filter(x => x.id !== job.id)].sort((a,b)=>b.updatedAt-a.updatedAt);
  save(next);
  return job;
}
export function runPublisherJob(jobId: string) {
  const job = listPublisherJobs().find(x => x.id === jobId);
  if (!job) return null;
  const targets = job.targets.map((target, idx) => {
    const ok = hasSecret(target.platform) || target.platform === 'local' || target.platform === 'gumroad' || target.platform === 'etsy';
    const status: PublishTarget['status'] = ok ? 'published' : 'ready';
    return { ...target, status, url: ok ? `oddengine://${target.platform}/${job.id}/${idx+1}` : '', message: ok ? 'publish simulated / handoff ready' : 'missing token / key', updatedAt: Date.now() };
  });
  const next = { ...job, targets, updatedAt: Date.now(), logs: [`${new Date().toISOString()} publish run executed`, ...job.logs].slice(0, 100) };
  updatePublisherJob(next);
  targets.filter(t => t.status === 'published').forEach((t, i) => addOutcome({ sourceId: job.id, sourceType: 'publisher', title: `${job.sourceTitle} / ${t.platform}`, platform: t.platform, contentType: job.contentType, views: 100 * (i+1), clicks: 10 * (i+1), conversions: Math.max(1, i), revenue: Number((5 * (i+1)).toFixed(2)), roi: 100 + i * 25, notes: 'Auto-captured placeholder outcome from publish loop.' }));
  return next;
}
