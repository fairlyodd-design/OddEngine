import { loadJSON, saveJSON } from "./storage";
import { pushNotif } from "./notifs";
import { addBrainMemory, buildMorningDigest, logActivity, queuePanelAction, saveBrainNote } from "./brain";

export type AutoRule = {
  id: string;
  title: string;
  enabled: boolean;
  atMinute: number;
  tags: string[];
  message: string;
  lastFiredDay?: string;
};

export type PanelAutomationSettings = {
  tradingRefreshPrompt: boolean;
  budgetSyncCheck: boolean;
  growReminder: boolean;
  scheduledDailyDigest: boolean;
  digestMinute: number;
  newsRefreshPrompt: boolean;
};

const KEY = "oddengine:autos";
const PANEL_AUTOS_KEY = "oddengine:brain:panelAutos:v1";
const PANEL_AUTOS_STATE_KEY = "oddengine:brain:panelAutosState:v1";

const DEFAULT_PANEL_AUTOS: PanelAutomationSettings = {
  tradingRefreshPrompt: true,
  budgetSyncCheck: true,
  growReminder: true,
  scheduledDailyDigest: true,
  digestMinute: 8 * 60,
  newsRefreshPrompt: true,
};

let loopStarted = false;

export function getAutos(): AutoRule[] {
  return loadJSON<AutoRule[]>(KEY, []);
}
export function saveAutos(list: AutoRule[]) {
  saveJSON(KEY, list);
}

export function getPanelAutomationSettings(): PanelAutomationSettings {
  return { ...DEFAULT_PANEL_AUTOS, ...(loadJSON<Partial<PanelAutomationSettings>>(PANEL_AUTOS_KEY, {}) || {}) };
}

export function savePanelAutomationSettings(next: PanelAutomationSettings) {
  saveJSON(PANEL_AUTOS_KEY, next);
}

function dayKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function markPanelAutoFired(id: string) {
  const state = loadJSON<Record<string, string>>(PANEL_AUTOS_STATE_KEY, {});
  state[id] = dayKey(new Date());
  saveJSON(PANEL_AUTOS_STATE_KEY, state);
}

function canFirePanelAuto(id: string) {
  const state = loadJSON<Record<string, string>>(PANEL_AUTOS_STATE_KEY, {});
  return state[id] !== dayKey(new Date());
}

function maybeFirePanelAutomation(id: string, args: { title: string; body: string; tags: string[]; level?: "info" | "warn" | "error" | "success" }) {
  if (!canFirePanelAuto(id)) return;
  pushNotif({ title: args.title, body: args.body, tags: args.tags, level: args.level || "info" });
  addBrainMemory({ panelId: args.tags[0] || "Brain", kind: args.level === "error" ? "error" : "automation", title: args.title, body: args.body, tags: args.tags });
  logActivity({ kind: "system", panelId: args.tags[0] || "Brain", title: args.title, body: args.body, tags: args.tags });
  markPanelAutoFired(id);
}

function runPanelAutomations(now: Date) {
  const settings = getPanelAutomationSettings();

  if (settings.tradingRefreshPrompt) {
    const trading = loadJSON<any>("oddengine:trading:sniper:v4", null as any);
    const chain = loadJSON<any>("odd.trading.chainSnapshot", null as any);
    if (trading?.symbol && (!chain?.contracts?.length || (Array.isArray(chain.contracts) && !chain.contracts.length))) {
      maybeFirePanelAutomation("tradingRefreshPrompt", {
        title: "Trading refresh prompt",
        body: `AI noticed ${trading.symbol} is selected but no usable options chain is loaded. Refresh the chain before planning entries.`,
        tags: ["Trading", "Automation"],
        level: "warn",
      });
    }
  }

  if (settings.budgetSyncCheck) {
    const budget = loadJSON<any>("oddengine:familyBudget:v2", null as any);
    const sync = budget?.syncBridge || {};
    const lastHealth = sync.lastHealthISO ? new Date(sync.lastHealthISO).getTime() : 0;
    const stale = !lastHealth || (Date.now() - lastHealth) > 1000 * 60 * 60 * 24;
    if (sync.enabled && (sync.lastError || stale)) {
      maybeFirePanelAutomation("budgetSyncCheck", {
        title: "Budget sync check",
        body: sync.lastError ? `Backend sync needs attention: ${sync.lastError}` : "Budget sync looks stale. Run a health test before trusting snapshot pushes/pulls.",
        tags: ["FamilyBudget", "Automation"],
        level: sync.lastError ? "error" : "warn",
      });
    }
  }

  if (settings.growReminder) {
    const profile = loadJSON<any>("oddengine:grow:profile", null as any);
    const readings = loadJSON<any[]>("oddengine:grow:readings", []);
    const lastTs = readings.length ? Number(readings[readings.length - 1]?.ts || 0) : 0;
    const stale = !lastTs || (Date.now() - lastTs) > 1000 * 60 * 60 * 18;
    if (profile?.name && stale) {
      maybeFirePanelAutomation("growReminder", {
        title: "Grow reminder",
        body: !lastTs ? `Room ${profile.name} has no readings yet. Save a baseline snapshot.` : `Room ${profile.name} has not logged a fresh reading in a while. Save one before acting on stale data.`,
        tags: ["Grow", "Automation"],
        level: "warn",
      });
    }
  }

  if (settings.newsRefreshPrompt) {
    const news = loadJSON<any>("oddengine:news:v1", null as any);
    const lastUpdated = Number(news?.lastUpdated || 0);
    const stale = !lastUpdated || (Date.now() - lastUpdated) > 1000 * 60 * 60 * 8;
    if (stale) {
      maybeFirePanelAutomation("newsRefreshPrompt", {
        title: "News refresh prompt",
        body: "News desk looks stale. Refresh weather and headline lanes so Mission Control is current.",
        tags: ["News", "Automation"],
        level: "info",
      });
      queuePanelAction("News", "news:refresh");
    }
  }

  if (settings.scheduledDailyDigest) {
    const minute = now.getHours() * 60 + now.getMinutes();
    if (minute === settings.digestMinute && canFirePanelAuto("scheduledDailyDigest")) {
      const digest = buildMorningDigest();
      saveBrainNote({ panelId: "Brain", title: "Scheduled morning digest", body: digest, pinned: true });
      pushNotif({ title: "Morning digest ready", body: "Mission Control generated your scheduled digest.", tags: ["Brain", "Automation"], level: "success" });
      addBrainMemory({ panelId: "Brain", kind: "automation", title: "Scheduled digest generated", body: "Morning digest saved into Brain notes.", tags: ["automation", "digest"] });
      markPanelAutoFired("scheduledDailyDigest");
    }
  }
}

export function startAutomationLoop() {
  if (loopStarted) return;
  loopStarted = true;
  setInterval(() => {
    const now = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    const day = dayKey(now);
    const list = getAutos();
    let changed = false;

    for (const r of list) {
      if (!r.enabled) continue;
      if (r.atMinute !== mins) continue;
      if (r.lastFiredDay === day) continue;

      pushNotif({ title: r.title, body: r.message, tags: r.tags, level: "info" });
      r.lastFiredDay = day;
      changed = true;
    }
    if (changed) saveAutos(list);

    runPanelAutomations(now);
  }, 20_000);
}
