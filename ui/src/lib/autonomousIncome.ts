import { loadJSON, saveJSON } from "./storage";
import { buildMoneyAutopilotPlan, runMoneyAutopilotAction } from "./moneyAutopilot";
import { autoDraftListingsFromWinners, listCommerceListings, publishCommerceListing } from "./commerceEngine";
import { listPublisherJobs } from "./publisherEngine";

export type AutonomousMode = "off" | "assist" | "full-auto";
export type CycleKind = "publish-pending" | "productize-winner" | "publish-listing" | "queue-next-create" | "observe";

export type AutonomousSettings = {
  enabled: boolean;
  mode: AutonomousMode;
  intervalMinutes: number;
  autoPublishProducts: boolean;
  autoDraftProducts: boolean;
  maxActionsPerCycle: number;
  quietHours: { start: number; end: number };
};

export type AutonomousAction = {
  kind: CycleKind;
  title: string;
  status: "planned" | "done" | "skipped" | "failed";
  details: string;
};

export type AutonomousCycle = {
  id: string;
  ts: number;
  summary: string;
  recommendationTitle: string;
  actions: AutonomousAction[];
  listingIds: string[];
};

const SETTINGS_KEY = "oddengine:incomeAutopilot:v1";
const CYCLES_KEY = "oddengine:incomeAutopilot:cycles:v1";
const LAST_RUN_KEY = "oddengine:incomeAutopilot:lastRun:v1";
export const INCOME_AUTOPILOT_EVENT = "oddengine:income-autopilot-changed";

const DEFAULT_SETTINGS: AutonomousSettings = {
  enabled: true,
  mode: "assist",
  intervalMinutes: 180,
  autoPublishProducts: false,
  autoDraftProducts: true,
  maxActionsPerCycle: 3,
  quietHours: { start: 1, end: 7 },
};

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function emit() {
  try { window.dispatchEvent(new CustomEvent(INCOME_AUTOPILOT_EVENT)); } catch {}
}

export function getAutonomousSettings(): AutonomousSettings {
  const raw = loadJSON<Partial<AutonomousSettings>>(SETTINGS_KEY, {}) || {};
  return {
    ...DEFAULT_SETTINGS,
    ...raw,
    quietHours: { ...DEFAULT_SETTINGS.quietHours, ...(raw.quietHours || {}) },
  };
}

export function saveAutonomousSettings(next: Partial<AutonomousSettings>) {
  const current = getAutonomousSettings();
  const merged = {
    ...current,
    ...next,
    quietHours: { ...current.quietHours, ...(next.quietHours || {}) },
  };
  saveJSON(SETTINGS_KEY, merged);
  emit();
  return merged;
}

export function listAutonomousCycles(): AutonomousCycle[] {
  return loadJSON<AutonomousCycle[]>(CYCLES_KEY, []).sort((a, b) => Number(b.ts || 0) - Number(a.ts || 0));
}

function saveCycle(cycle: AutonomousCycle) {
  const next = [cycle, ...listAutonomousCycles()].slice(0, 200);
  saveJSON(CYCLES_KEY, next);
  saveJSON(LAST_RUN_KEY, cycle.ts);
  emit();
  return cycle;
}

export function shouldRunAutonomousCycle(now = new Date()) {
  const settings = getAutonomousSettings();
  if (!settings.enabled || settings.mode === "off") return false;
  const hour = now.getHours();
  const quiet = settings.quietHours || { start: 1, end: 7 };
  const insideQuiet = quiet.start <= quiet.end ? hour >= quiet.start && hour < quiet.end : hour >= quiet.start || hour < quiet.end;
  if (insideQuiet) return false;
  const last = Number(loadJSON<number>(LAST_RUN_KEY, 0) || 0);
  return !last || (Date.now() - last) >= settings.intervalMinutes * 60 * 1000;
}

export function runAutonomousCycle() {
  const settings = getAutonomousSettings();
  const plan = buildMoneyAutopilotPlan();
  const actions: AutonomousAction[] = [];
  const listingIds: string[] = [];
  const pendingPublish = listPublisherJobs().filter((job) => (job.targets || []).some((t) => ["queued", "ready", "publishing"].includes(String(t.status || ""))));

  if (pendingPublish.length && actions.length < settings.maxActionsPerCycle) {
    const res = runMoneyAutopilotAction("publish-pending" as any);
    actions.push({ kind: "publish-pending", title: "Finish pending publish jobs", status: res?.ok ? "done" : "skipped", details: res?.reason || "No publish jobs advanced." });
  }

  if (settings.autoDraftProducts && actions.length < settings.maxActionsPerCycle) {
    const drafted = autoDraftListingsFromWinners();
    drafted.forEach((x) => listingIds.push(x.id));
    actions.push({ kind: "productize-winner", title: "Draft product listings from current winner", status: drafted.length ? "done" : "skipped", details: drafted.length ? `${drafted.length} product listings drafted.` : "No new winners to productize right now." });
  }

  const readyListings = listCommerceListings().filter((x) => x.status === "queued" || (settings.autoPublishProducts && x.status === "draft"));
  if (settings.autoPublishProducts && readyListings.length && actions.length < settings.maxActionsPerCycle) {
    const listing = readyListings[0];
    const published = publishCommerceListing(listing.id);
    if (published) listingIds.push(published.id);
    actions.push({ kind: "publish-listing", title: `Publish ${listing.title}`, status: published ? "done" : "failed", details: published?.url || "Listing publish failed." });
  }

  if (actions.length < settings.maxActionsPerCycle) {
    const res = runMoneyAutopilotAction();
    actions.push({ kind: "queue-next-create", title: plan.recommendation.title, status: res?.ok ? "done" : "skipped", details: res?.reason || "Autopilot recommendation was noted but not executed." });
  }

  if (!actions.length) {
    actions.push({ kind: "observe", title: "Observe current pipeline state", status: "done", details: "No action was stronger than waiting for more data." });
  }

  return saveCycle({
    id: uid(),
    ts: Date.now(),
    summary: `Mode ${settings.mode}. ${actions.filter((x) => x.status === "done").length} actions executed.`,
    recommendationTitle: plan.recommendation.title,
    actions,
    listingIds,
  });
}

let started = false;
export function startAutonomousIncomeLoop() {
  if (started) return;
  started = true;
  const tick = () => {
    try {
      if (shouldRunAutonomousCycle()) runAutonomousCycle();
    } catch {}
  };
  tick();
  window.setInterval(tick, 60_000);
}
