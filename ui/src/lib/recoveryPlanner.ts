import { loadJSON, saveJSON } from "./storage";
import type { MoneyMove } from "./moneyVacuum";
import type { IncomeScoutMove } from "./incomeScout";

const HEALTH_KEY = "oddengine:happyhealthy:v1";
const SETTINGS_KEY = "oddengine:moneyRecoveryPlanner:v1";

export type RecoveryMode = "auto" | "recovery" | "steady" | "push";
export type RecoveryDemandLevel = "low" | "medium" | "high";
export type RecoveryFocusLevel = "light" | "medium" | "deep";

export type RecoveryPlannerSettings = {
  mode: RecoveryMode;
  timeAvailableMin: number;
  preferNoUpfront: boolean;
  avoidCapitalRiskWhenLow: boolean;
  useHealthSync: boolean;
};

export type RecoverySnapshot = {
  generatedAt: number;
  source: "health-log" | "fallback";
  date: string;
  energy: number;
  pain: number;
  hydration: number;
  symptomLoad: number;
  redFlagCount: number;
  timeAvailableMin: number;
  mode: Exclude<RecoveryMode, "auto">;
  capacity: RecoveryDemandLevel;
  protectCapital: boolean;
  preferNoUpfront: boolean;
  summary: string;
};

export type RecoveryMoveMeta = {
  mode: Exclude<RecoveryMode, "auto">;
  capacity: RecoveryDemandLevel;
  effort: RecoveryDemandLevel;
  focus: RecoveryFocusLevel;
  minMinutes: number;
  capitalRisk: RecoveryDemandLevel;
  fit: "strong" | "good" | "stretch" | "not-today";
  fitLabel: string;
  delta: number;
  summary: string;
};

type HealthDay = {
  date: string;
  pain: number;
  hydration: number;
  energy: number;
  notes?: string;
  redFlags?: {
    fever?: boolean;
    blood?: boolean;
    severePain?: boolean;
    dehydration?: boolean;
    chestPain?: boolean;
    confusion?: boolean;
  };
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function round(n: number) {
  return Number((Number(n) || 0).toFixed(1));
}

export function getRecoveryPlannerSettings(): RecoveryPlannerSettings {
  const raw = loadJSON<Partial<RecoveryPlannerSettings>>(SETTINGS_KEY, {});
  return {
    mode: raw?.mode === "recovery" || raw?.mode === "steady" || raw?.mode === "push" || raw?.mode === "auto" ? raw.mode : "auto",
    timeAvailableMin: clamp(Number(raw?.timeAvailableMin || 30), 10, 240),
    preferNoUpfront: raw?.preferNoUpfront !== false,
    avoidCapitalRiskWhenLow: raw?.avoidCapitalRiskWhenLow !== false,
    useHealthSync: raw?.useHealthSync !== false,
  };
}

export function saveRecoveryPlannerSettings(next: Partial<RecoveryPlannerSettings>) {
  const merged = { ...getRecoveryPlannerSettings(), ...next };
  const normalized: RecoveryPlannerSettings = {
    ...merged,
    timeAvailableMin: clamp(Number(merged.timeAvailableMin || 30), 10, 240),
  };
  saveJSON(SETTINGS_KEY, normalized);
  return normalized;
}

function latestHealthDay(): HealthDay | null {
  const raw = loadJSON<{ entries?: HealthDay[] }>(HEALTH_KEY, { entries: [] });
  const entries = Array.isArray(raw?.entries) ? raw.entries.slice() : [];
  if (!entries.length) return null;
  entries.sort((a, b) => String(b?.date || "").localeCompare(String(a?.date || "")));
  return entries[0] || null;
}

function resolveMode(settings: RecoveryPlannerSettings, health: HealthDay | null): Exclude<RecoveryMode, "auto"> {
  if (settings.mode !== "auto") return settings.mode;
  const energy = Number(health?.energy ?? 5);
  const pain = Number(health?.pain ?? 4);
  const redFlagCount = Object.values(health?.redFlags || {}).filter(Boolean).length;
  if (redFlagCount >= 2 || pain >= 8 || energy <= 3) return "recovery";
  if (energy >= 7 && pain <= 4) return "push";
  return "steady";
}

export function buildRecoverySnapshot(settingsInput?: Partial<RecoveryPlannerSettings>): RecoverySnapshot {
  const settings = { ...getRecoveryPlannerSettings(), ...(settingsInput || {}) } as RecoveryPlannerSettings;
  const health = settings.useHealthSync ? latestHealthDay() : null;
  const redFlagCount = Object.values(health?.redFlags || {}).filter(Boolean).length;
  const energy = clamp(Number(health?.energy ?? 5), 0, 10);
  const pain = clamp(Number(health?.pain ?? 4), 0, 10);
  const hydration = clamp(Number(health?.hydration ?? 4), 0, 30);
  const symptomLoad = clamp(round(pain * 0.62 + redFlagCount * 1.2 + (hydration <= 3 ? 1.2 : hydration <= 5 ? 0.5 : 0) + (energy <= 3 ? 1.0 : energy <= 5 ? 0.35 : -0.25)), 0, 10);
  const mode = resolveMode(settings, health);
  const capacity: RecoveryDemandLevel = energy >= 7 && symptomLoad <= 4 ? "high" : energy >= 4 && symptomLoad <= 7 ? "medium" : "low";
  const protectCapital = settings.avoidCapitalRiskWhenLow && (capacity === "low" || redFlagCount > 0 || symptomLoad >= 7);
  const summary = `${mode} mode • ${settings.timeAvailableMin}m window • energy ${energy}/10 • symptom load ${symptomLoad}/10`;
  return {
    generatedAt: Date.now(),
    source: health ? "health-log" : "fallback",
    date: health?.date || new Date().toISOString().slice(0, 10),
    energy,
    pain,
    hydration,
    symptomLoad,
    redFlagCount,
    timeAvailableMin: clamp(Number(settings.timeAvailableMin || 30), 10, 240),
    mode,
    capacity,
    protectCapital,
    preferNoUpfront: settings.preferNoUpfront !== false,
    summary,
  };
}

function hasAny(text: string, needles: string[]) {
  return needles.some((needle) => text.includes(needle));
}

function classifyDemandBase(item: { panelId?: string; title?: string; body?: string; tags?: string[]; kind?: string; noUpfrontCost?: boolean }) {
  const bag = [item.panelId || "", item.title || "", item.body || "", ...(item.tags || [])].join(" ").toLowerCase();
  let effort: RecoveryDemandLevel = "medium";
  let focus: RecoveryFocusLevel = "medium";
  let minMinutes = 25;
  let capitalRisk: RecoveryDemandLevel = item.noUpfrontCost ? "low" : "medium";
  let symptomFriendly = true;

  if (String(item.panelId || "").toLowerCase() === "trading" || hasAny(bag, ["trading", "options", "contract", "chain"])) {
    effort = "high";
    focus = "deep";
    minMinutes = 35;
    capitalRisk = "high";
    symptomFriendly = false;
  } else if (String(item.panelId || "").toLowerCase() === "familybudget" || item.kind === "save" || hasAny(bag, ["budget", "subscription", "debt", "coupon", "cheap-week", "savings"])) {
    effort = "low";
    focus = hasAny(bag, ["avalanche", "payoff"]) ? "medium" : "light";
    minMinutes = hasAny(bag, ["transactions", "reports"]) ? 20 : 15;
    capitalRisk = "low";
    symptomFriendly = true;
  } else if (String(item.panelId || "").toLowerCase() === "cryptogames" || hasAny(bag, ["games", "sats", "surveys", "user-testing"])) {
    effort = hasAny(bag, ["survey", "user-testing"]) ? "low" : "medium";
    focus = "light";
    minMinutes = hasAny(bag, ["survey", "user-testing"]) ? 15 : 20;
    capitalRisk = "low";
    symptomFriendly = true;
  } else if (String(item.panelId || "").toLowerCase() === "mining" || hasAny(bag, ["mining", "payout", "pool", "hashrate"])) {
    effort = hasAny(bag, ["investigate", "repair"]) ? "medium" : "low";
    focus = hasAny(bag, ["investigate", "compare"]) ? "medium" : "light";
    minMinutes = 15;
    capitalRisk = "low";
    symptomFriendly = true;
  } else if (hasAny(bag, ["ebook", "writing", "template", "gpt", "app", "saas", "launch", "sellable", "affiliate", "listing", "build"])) {
    effort = hasAny(bag, ["app", "saas"]) ? "high" : "medium";
    focus = hasAny(bag, ["launch", "pricing", "listing"]) ? "deep" : "medium";
    minMinutes = effort === "high" ? 60 : 35;
    capitalRisk = item.noUpfrontCost ? "low" : "medium";
    symptomFriendly = false;
  }

  return { effort, focus, minMinutes, capitalRisk, symptomFriendly };
}

function fitLabel(delta: number) {
  if (delta >= 9) return { fit: "strong", fitLabel: "strong fit" } as const;
  if (delta >= 2) return { fit: "good", fitLabel: "good fit" } as const;
  if (delta >= -6) return { fit: "stretch", fitLabel: "stretch" } as const;
  return { fit: "not-today", fitLabel: "not today" } as const;
}

function buildRecoveryMeta(item: { panelId?: string; title?: string; body?: string; tags?: string[]; kind?: string; noUpfrontCost?: boolean }, snapshot: RecoverySnapshot): RecoveryMoveMeta {
  const demand = classifyDemandBase(item);
  let delta = 0;

  if (snapshot.timeAvailableMin < demand.minMinutes) {
    delta -= clamp(Math.round((demand.minMinutes - snapshot.timeAvailableMin) / 7), 2, 16);
  } else {
    delta += snapshot.timeAvailableMin >= demand.minMinutes * 1.8 ? 4 : 2;
  }

  if (snapshot.capacity === "low") {
    delta += demand.effort === "low" ? 8 : demand.effort === "medium" ? -2 : -16;
    delta += demand.focus === "light" ? 4 : demand.focus === "medium" ? -1 : -12;
  } else if (snapshot.capacity === "medium") {
    delta += demand.effort === "low" ? 4 : demand.effort === "medium" ? 3 : -5;
    delta += demand.focus === "deep" ? -3 : 2;
  } else {
    delta += demand.effort === "high" ? 7 : 3;
    delta += demand.focus === "deep" ? 4 : 2;
  }

  if (snapshot.symptomLoad >= 7) {
    delta += demand.symptomFriendly ? 5 : -10;
  } else if (snapshot.symptomLoad <= 3 && demand.effort === "high") {
    delta += 3;
  }

  if (snapshot.mode === "recovery") {
    delta += demand.effort === "low" ? 6 : demand.effort === "medium" ? -2 : -12;
    delta += demand.symptomFriendly ? 4 : -6;
  } else if (snapshot.mode === "steady") {
    delta += demand.effort === "medium" ? 4 : 1;
  } else if (snapshot.mode === "push") {
    delta += demand.focus === "deep" ? 5 : 2;
    delta += demand.effort === "high" ? 4 : 0;
  }

  if (snapshot.preferNoUpfront) {
    delta += item.noUpfrontCost || item.kind === "save" ? 4 : -2;
  }

  if (snapshot.protectCapital && demand.capitalRisk === "high") delta -= 18;
  else if (snapshot.protectCapital && demand.capitalRisk === "medium") delta -= 6;

  const fit = fitLabel(delta);
  const summary = `${fit.fitLabel} • ${snapshot.timeAvailableMin}m ${snapshot.mode} window • ${demand.effort} effort / ${demand.focus} focus`;
  return {
    mode: snapshot.mode,
    capacity: snapshot.capacity,
    effort: demand.effort,
    focus: demand.focus,
    minMinutes: demand.minMinutes,
    capitalRisk: demand.capitalRisk,
    fit: fit.fit,
    fitLabel: fit.fitLabel,
    delta,
    summary,
  };
}

export function applyRecoveryToMoneyMove(move: MoneyMove, snapshotInput?: RecoverySnapshot): MoneyMove {
  const snapshot = snapshotInput || buildRecoverySnapshot();
  const recovery = buildRecoveryMeta(move as any, snapshot);
  return {
    ...move,
    score: clamp(Number(move.score || 0) + recovery.delta, 0, 99),
    confidence: clamp(Number(move.confidence || 0) + Math.round(recovery.delta / 2), 0, 99),
    recovery,
  };
}

export function applyRecoveryToIncomeScoutMove(move: IncomeScoutMove, snapshotInput?: RecoverySnapshot): IncomeScoutMove {
  const snapshot = snapshotInput || buildRecoverySnapshot();
  const recovery = buildRecoveryMeta(move as any, snapshot);
  return {
    ...move,
    score: clamp(Number(move.score || 0) + recovery.delta, 0, 99),
    confidence: clamp(Number(move.confidence || 0) + Math.round(recovery.delta / 2), 0, 99),
    recovery,
  };
}
