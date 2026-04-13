import { loadJSON, saveJSON } from "./storage";
import { listOutcomes, type MoneyOutcome } from "./outcomeTracker";
import { listPublisherJobs, runPublisherJob, type PublisherJob } from "./publisherEngine";
import { queueAutoProductionLoop } from "./productionLoop";

type AssetType = "book" | "music" | "art" | "video" | "cartoon" | "social" | "asset";

export type MoneyAutopilotSettings = {
  enabled: boolean;
  mode: "assist" | "full-auto";
  minConfidence: number;
  preferredPlatforms: string[];
};

export type MoneyAutopilotRecommendation = {
  id: string;
  title: string;
  body: string;
  reason: string;
  contentType: AssetType;
  platform: string;
  confidence: number;
  estimatedRevenue: number;
  panelId: string;
  cta: string;
  action: "publish-pending" | "queue-latest-handoff" | "open-studio";
  valueLabel?: string;
  lane?: string;
  score?: number;
  actionLabel?: string;
  moveKey?: string;
  kind?: AssetType;
  amountUsd?: number;
};

export type MoneyAutopilotQueueItem = MoneyAutopilotRecommendation & {
  moveKey: string;
  lane: string;
  score: number;
  valueLabel: string;
  actionLabel: string;
  kind: AssetType;
  amountUsd: number;
};

export type MoneyAutopilotQueue = {
  items: MoneyAutopilotQueueItem[];
  nextMove: MoneyAutopilotQueueItem | null;
};

export type MoneyAutopilotPlan = {
  settings: MoneyAutopilotSettings;
  topPlatform: string;
  topContentType: AssetType;
  pendingPublishCount: number;
  draftableStudioCount: number;
  recommendation: MoneyAutopilotRecommendation;
  alternatives: MoneyAutopilotRecommendation[];
  stats: {
    totalRevenue: number;
    totalOutcomes: number;
    avgRevenuePerOutcome: number;
    bestPlatformRevenue: number;
    bestContentRevenue: number;
  };
};

const SETTINGS_KEY = "oddengine:moneyAutopilot:v1";
const PROJECTS_KEY = "oddengine:studio:projects:v1";
const HANDOFF_KEY = "oddengine:studio:handoff:v1";

const DEFAULT_SETTINGS: MoneyAutopilotSettings = {
  enabled: true,
  mode: "assist",
  minConfidence: 70,
  preferredPlatforms: [],
};

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function platformStats(items: MoneyOutcome[]) {
  const map = new Map<string, { revenue: number; count: number; conversions: number; views: number }>();
  for (const item of items) {
    const key = String(item.platform || "local").toLowerCase();
    const row = map.get(key) || { revenue: 0, count: 0, conversions: 0, views: 0 };
    row.revenue += Number(item.revenue || 0);
    row.count += 1;
    row.conversions += Number(item.conversions || 0);
    row.views += Number(item.views || 0);
    map.set(key, row);
  }
  return [...map.entries()]
    .map(([platform, row]) => ({
      platform,
      ...row,
      avgRevenue: row.count ? row.revenue / row.count : 0,
      conversionRate: row.views ? row.conversions / row.views : 0,
      score: row.revenue + row.count * 3 + row.conversions * 1.5,
    }))
    .sort((a, b) => b.score - a.score);
}

function typeStats(items: MoneyOutcome[]) {
  const map = new Map<string, { revenue: number; count: number; conversions: number }>();
  for (const item of items) {
    const key = String(item.contentType || "social").toLowerCase();
    const row = map.get(key) || { revenue: 0, count: 0, conversions: 0 };
    row.revenue += Number(item.revenue || 0);
    row.count += 1;
    row.conversions += Number(item.conversions || 0);
    map.set(key, row);
  }
  return [...map.entries()]
    .map(([contentType, row]) => ({
      contentType: contentType as AssetType,
      ...row,
      avgRevenue: row.count ? row.revenue / row.count : 0,
      score: row.revenue + row.count * 2 + row.conversions,
    }))
    .sort((a, b) => b.score - a.score);
}

export function getMoneyAutopilotSettings(): MoneyAutopilotSettings {
  return { ...DEFAULT_SETTINGS, ...(loadJSON<Partial<MoneyAutopilotSettings>>(SETTINGS_KEY, {}) || {}) };
}

export function saveMoneyAutopilotSettings(next: Partial<MoneyAutopilotSettings>) {
  const merged = { ...getMoneyAutopilotSettings(), ...next };
  saveJSON(SETTINGS_KEY, merged);
  return merged;
}

function loadStudioProjects() {
  const list = loadJSON<any[]>(PROJECTS_KEY, []);
  return Array.isArray(list) ? list : [];
}

function latestStudioCandidate(bestType: AssetType) {
  const items = loadStudioProjects()
    .filter((x) => x && typeof x === "object")
    .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
  const draftable = items.filter((x) => ["Idea", "Planning", "Producing", "Packaging", "Ready"].includes(String(x.status || "")));
  return draftable.find((x) => String(x.type || "").toLowerCase() === String(bestType).toLowerCase()) || draftable[0] || null;
}

function pendingJobs(jobs: PublisherJob[]) {
  return jobs.filter((job) => (job.targets || []).some((t) => ["queued", "ready", "publishing"].includes(String(t.status || ""))));
}

export function buildMoneyAutopilotPlan(): MoneyAutopilotPlan {
  const settings = getMoneyAutopilotSettings();
  const outcomes = listOutcomes();
  const publishers = listPublisherJobs();
  const pending = pendingJobs(publishers);
  const platformRank = platformStats(outcomes);
  const contentRank = typeStats(outcomes);
  const preferredPlatform = settings.preferredPlatforms.find(Boolean);
  const topPlatform = preferredPlatform || platformRank[0]?.platform || "youtube";
  const topContentType = contentRank[0]?.contentType || "social";
  const latestDraft = latestStudioCandidate(topContentType);
  const latestHandoff = loadJSON<any>(HANDOFF_KEY, null as any);
  const totalRevenue = outcomes.reduce((sum, item) => sum + Number(item.revenue || 0), 0);
  const avgRevenue = outcomes.length ? totalRevenue / outcomes.length : 0;
  const suggestions: MoneyAutopilotRecommendation[] = [];

  if (pending.length) {
    const job = pending[0];
    const firstTarget = (job.targets || []).find((x) => ["queued", "ready", "publishing"].includes(String(x.status || ""))) || job.targets?.[0];
    suggestions.push({
      id: "publish-pending",
      title: `Finish shipping ${job.sourceTitle}`,
      body: `There ${pending.length === 1 ? "is" : "are"} ${pending.length} publish job${pending.length === 1 ? "" : "s"} waiting. The fastest money move is to ship what is already built.`,
      reason: "Pending publish queue usually beats starting from scratch.",
      contentType: (job.contentType || topContentType) as AssetType,
      platform: String(firstTarget?.platform || topPlatform),
      confidence: clamp(88 + pending.length * 2, 0, 99),
      estimatedRevenue: Number((platformRank[0]?.avgRevenue || avgRevenue || 15).toFixed(2)),
      panelId: "PublisherHub",
      cta: "Run Money Autopilot",
      action: "publish-pending",
    });
  }

  if (latestHandoff?.projectId || latestHandoff?.title) {
    suggestions.push({
      id: "queue-latest-handoff",
      title: `Push ${latestHandoff?.title || "latest studio handoff"} to ${topPlatform}`,
      body: `Your strongest platform looks like ${topPlatform}, and the latest studio bundle is ready for the next hop.`,
      reason: "Latest finished handoff + best platform is the cleanest growth loop.",
      contentType: (latestHandoff?.type || topContentType) as AssetType,
      platform: topPlatform,
      confidence: clamp(80 + Math.round((platformRank[0]?.avgRevenue || 0) / 5), 0, 97),
      estimatedRevenue: Number((platformRank[0]?.avgRevenue || avgRevenue || 12).toFixed(2)),
      panelId: "Books",
      cta: "Queue autopilot publish",
      action: "queue-latest-handoff",
    });
  }

  if (latestDraft) {
    suggestions.push({
      id: "open-studio",
      title: `Create another ${topContentType} for ${topPlatform}`,
      body: `Outcome data says ${topContentType} performs best, and ${topPlatform} is currently your highest-paying lane.`,
      reason: "Content type + platform picked from real tracked outcomes.",
      contentType: topContentType,
      platform: topPlatform,
      confidence: clamp(72 + Math.round((contentRank[0]?.avgRevenue || 0) / 4), 0, 94),
      estimatedRevenue: Number((((contentRank[0]?.avgRevenue || 0) + (platformRank[0]?.avgRevenue || 0)) / 2 || 10).toFixed(2)),
      panelId: "Books",
      cta: "Open Studio",
      action: "open-studio",
    });
  }

  if (!suggestions.length) {
    suggestions.push({
      id: "bootstrap-social",
      title: `Start with a ${topContentType} pack for ${topPlatform}`,
      body: "There is not enough revenue history yet, so Money Autopilot is biasing toward the fastest learning loop.",
      reason: "Need more tracked outcomes to optimize harder.",
      contentType: topContentType,
      platform: topPlatform,
      confidence: 66,
      estimatedRevenue: 8,
      panelId: "Books",
      cta: "Open Studio",
      action: "open-studio",
    });
  }

  suggestions.sort((a, b) => b.confidence - a.confidence || b.estimatedRevenue - a.estimatedRevenue);

  return {
    settings,
    topPlatform,
    topContentType,
    pendingPublishCount: pending.length,
    draftableStudioCount: loadStudioProjects().filter((x) => ["Idea", "Planning", "Producing", "Packaging", "Ready"].includes(String(x?.status || ""))).length,
    recommendation: suggestions[0],
    alternatives: suggestions.slice(1, 4),
    stats: {
      totalRevenue,
      totalOutcomes: outcomes.length,
      avgRevenuePerOutcome: avgRevenue,
      bestPlatformRevenue: platformRank[0]?.revenue || 0,
      bestContentRevenue: contentRank[0]?.revenue || 0,
    },
  };
}

function toQueueItem(rec: MoneyAutopilotRecommendation, index: number): MoneyAutopilotQueueItem {
  const amountUsd = Number(rec.estimatedRevenue || 0);
  const contentType = rec.contentType || "social";
  return {
    ...rec,
    moveKey: rec.moveKey || rec.id || `money-move-${index + 1}`,
    lane: rec.lane || "Money Autopilot",
    score: typeof rec.score === "number" ? rec.score : Math.round((Number(rec.confidence || 0) * 100) + amountUsd),
    valueLabel: rec.valueLabel || `$${amountUsd.toFixed(2)} est.`,
    actionLabel: rec.actionLabel || rec.cta || `Open ${rec.panelId || "Money"}`,
    kind: rec.kind || contentType,
    amountUsd,
  };
}

export function buildMoneyAutopilotQueue(limit = 8): MoneyAutopilotQueue {
  const plan = buildMoneyAutopilotPlan();
  const queueItems = [plan.recommendation, ...(plan.alternatives || [])]
    .filter(Boolean)
    .slice(0, Math.max(1, limit))
    .map((rec, index) => toQueueItem(rec, index));
  return {
    items: queueItems,
    nextMove: queueItems[0] || null,
  };
}

export function runMoneyAutopilotAction(plan?: MoneyAutopilotPlan) {
  const next = plan || buildMoneyAutopilotPlan();
  const choice = next.recommendation;
  if (!choice) return { ok: false, reason: "No recommendation available." };

  if (choice.action === "publish-pending") {
    const jobs = pendingJobs(listPublisherJobs());
    const first = jobs[0];
    if (!first) return { ok: false, reason: "No pending publish jobs found." };
    const result = runPublisherJob(first.id);
    return { ok: !!result, reason: result ? `Ran publish job for ${first.sourceTitle}.` : "Failed to run queued publish job.", job: result };
  }

  if (choice.action === "queue-latest-handoff") {
    const handoff = loadJSON<any>(HANDOFF_KEY, null as any);
    if (handoff) {
      const currentTargets = Array.isArray(handoff?.distribution?.targets) ? handoff.distribution.targets : [];
      const targets = Array.from(new Set([choice.platform, ...currentTargets].filter(Boolean)));
      handoff.distribution = { ...(handoff.distribution || {}), targets };
      const job = queueAutoProductionLoop({ handoff, mode: next.settings.mode === "full-auto" ? "full-auto" : "assisted", autoPublish: true });
      return { ok: !!job, reason: job ? `Queued ${handoff.title || "latest handoff"} to ${choice.platform}.` : "Could not queue the latest handoff.", job };
    }
    return { ok: false, reason: "No studio handoff available to queue." };
  }

  if (choice.action === "open-studio") {
    const candidate = latestStudioCandidate(choice.contentType);
    if (candidate) {
      try {
        localStorage.setItem("oddengine:studio:active", JSON.stringify(candidate.id));
      } catch {}
      return { ok: true, reason: `Focused studio project ${candidate.title}.`, projectId: candidate.id };
    }
    return { ok: false, reason: "No draftable studio project found." };
  }

  return { ok: false, reason: "Unsupported autopilot action." };
}
