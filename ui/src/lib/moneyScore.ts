import { loadJSON, saveJSON } from "./storage";
import type { MoneyMove } from "./moneyVacuum";

export type MoneyFeedbackOutcome = "win" | "mixed" | "loss";

export type MoneyFeedbackOutcomeSource = "estimated" | "actual";

export type MoneyFeedbackRecord = {
  id: string;
  ts: number;
  moveKey: string;
  panelId: string;
  lane: MoneyMove["lane"];
  kind: MoneyMove["kind"];
  actionId?: string;
  title: string;
  outcome: MoneyFeedbackOutcome;
  outcomeSource?: MoneyFeedbackOutcomeSource;
  estimatedUsd?: number | null;
  realizedUsd?: number | null;
  note?: string;
};

export type MoneyLearningBoost = {
  scoreDelta: number;
  confidenceDelta: number;
  panelDelta: number;
  laneDelta: number;
  repeatDelta: number;
  recentCount: number;
  wins: number;
  losses: number;
  mixed: number;
  realizedUsd: number;
  summary: string;
};

export type MoneyScorecard = {
  generatedAt: number;
  summary: {
    totalFeedback: number;
    wins: number;
    mixed: number;
    losses: number;
    realizedUsd: number;
    actualCapturedUsd: number;
    actualCapturedCount: number;
    learnedPanels: number;
    learnedLanes: number;
  };
  topPanels: Array<{ panelId: string; score: number; wins: number; losses: number; mixed: number; realizedUsd: number; lastTs: number }>;
  topLanes: Array<{ lane: MoneyMove["lane"]; score: number; wins: number; losses: number; mixed: number; realizedUsd: number; lastTs: number }>;
  recent: MoneyFeedbackRecord[];
};

const KEY = "oddengine:moneyScore:v1";
const MAX_RECORDS = 240;

function uid(prefix = "ms") {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36)}`;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function round2(n: number) {
  return Number((Number(n) || 0).toFixed(2));
}

function moveKeyFor(move: Pick<MoneyMove, "panelId" | "actionId" | "title" | "kind" | "lane">) {
  return [move.panelId, move.actionId || "open-panel", move.kind, move.lane, move.title]
    .map((part) => String(part || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 72))
    .join("__");
}

export function getMoneyFeedbackRecords() {
  const raw = loadJSON<MoneyFeedbackRecord[]>(KEY, []);
  return Array.isArray(raw) ? raw : [];
}

export function recordMoneyFeedback(
  move: Pick<MoneyMove, "panelId" | "lane" | "kind" | "actionId" | "title" | "amountUsd">,
  outcome: MoneyFeedbackOutcome = "win",
  opts?: { moveKey?: string; realizedUsd?: number | null; note?: string; estimatedUsd?: number | null; outcomeSource?: MoneyFeedbackOutcomeSource }
) {
  const list = getMoneyFeedbackRecords();
  const record: MoneyFeedbackRecord = {
    id: uid("ms"),
    ts: Date.now(),
    moveKey: opts?.moveKey || moveKeyFor(move),
    panelId: String(move.panelId || ""),
    lane: move.lane,
    kind: move.kind,
    actionId: move.actionId,
    title: String(move.title || "Untitled move"),
    outcome,
    outcomeSource: opts?.outcomeSource || (opts?.realizedUsd != null ? "actual" : "estimated"),
    estimatedUsd: opts?.estimatedUsd ?? move.amountUsd ?? null,
    realizedUsd: opts?.realizedUsd ?? move.amountUsd ?? null,
    note: opts?.note,
  };
  saveJSON(KEY, [record, ...list].slice(0, MAX_RECORDS));
  return record;
}

function scoreOutcome(record: MoneyFeedbackRecord) {
  const amount = Math.max(0, Number(record.realizedUsd || record.estimatedUsd || 0));
  const amountBoost = Math.min(6, Math.round(amount / 25));
  if (record.outcome === "win") return 3 + amountBoost;
  if (record.outcome === "mixed") return 1 + Math.min(2, amountBoost);
  return -3 - Math.min(3, Math.round(amount / 40));
}

function tally(records: MoneyFeedbackRecord[]) {
  const wins = records.filter((row) => row.outcome === "win").length;
  const mixed = records.filter((row) => row.outcome === "mixed").length;
  const losses = records.filter((row) => row.outcome === "loss").length;
  const realizedUsd = round2(records.reduce((sum, row) => {
    const sign = row.outcome === "loss" ? -1 : 1;
    return sum + sign * Math.max(0, Number(row.realizedUsd || row.estimatedUsd || 0));
  }, 0));
  const actualCapturedUsd = round2(records
    .filter((row) => row.outcomeSource === "actual")
    .reduce((sum, row) => {
      const sign = row.outcome === "loss" ? -1 : 1;
      return sum + sign * Math.max(0, Number(row.realizedUsd || 0));
    }, 0));
  const actualCapturedCount = records.filter((row) => row.outcomeSource === "actual").length;
  const score = records.reduce((sum, row) => sum + scoreOutcome(row), 0);
  const lastTs = Math.max(0, ...records.map((row) => Number(row.ts || 0)));
  return { wins, mixed, losses, realizedUsd, actualCapturedUsd, actualCapturedCount, score, lastTs };
}

export function getMoneyLearningBoost(move: Pick<MoneyMove, "panelId" | "lane" | "kind" | "actionId" | "title">): MoneyLearningBoost {
  const records = getMoneyFeedbackRecords();
  const moveKey = moveKeyFor(move);
  const panelRecords = records.filter((row) => row.panelId === move.panelId);
  const laneRecords = records.filter((row) => row.lane === move.lane);
  const moveRecords = records.filter((row) => row.moveKey === moveKey || (!!move.actionId && row.actionId === move.actionId));

  const panelTally = tally(panelRecords);
  const laneTally = tally(laneRecords);
  const moveTally = tally(moveRecords);
  const recentCount = moveRecords.filter((row) => Number(row.ts || 0) >= Date.now() - 45 * 24 * 3600 * 1000).length;

  const panelDelta = clamp(Math.round(panelTally.score / 4), -4, 6);
  const laneDelta = clamp(Math.round(laneTally.score / 5), -4, 5);
  const repeatDelta = clamp(Math.round(moveTally.score / 2) + Math.min(4, recentCount), -8, 10);
  const realizedBoost = clamp(Math.round((panelTally.realizedUsd + laneTally.realizedUsd + moveTally.realizedUsd) / 150), -4, 6);
  const scoreDelta = clamp(panelDelta + laneDelta + repeatDelta + realizedBoost, -12, 18);
  const confidenceDelta = clamp(Math.round((moveTally.wins - moveTally.losses) * 2 + (panelTally.wins - panelTally.losses) / 2 + recentCount), -8, 12);

  const parts = [] as string[];
  if (moveTally.wins) parts.push(`${moveTally.wins} win${moveTally.wins === 1 ? "" : "s"} on this move`);
  else if (panelTally.wins) parts.push(`${panelTally.wins} panel wins in ${move.panelId}`);
  if (laneTally.realizedUsd > 0) parts.push(`~$${Math.round(laneTally.realizedUsd).toLocaleString()} learned in ${move.lane.toLowerCase()}`);
  if (moveTally.losses) parts.push(`${moveTally.losses} miss${moveTally.losses === 1 ? "" : "es"} logged`);

  return {
    scoreDelta,
    confidenceDelta,
    panelDelta,
    laneDelta,
    repeatDelta,
    recentCount,
    wins: moveTally.wins + panelTally.wins,
    losses: moveTally.losses + panelTally.losses,
    mixed: moveTally.mixed + panelTally.mixed,
    realizedUsd: round2(moveTally.realizedUsd + panelTally.realizedUsd + laneTally.realizedUsd),
    summary: parts.join(" • ") || "No feedback history yet",
  };
}

export function buildMoneyScorecard(limit = 6): MoneyScorecard {
  const records = getMoneyFeedbackRecords();
  const wins = records.filter((row) => row.outcome === "win").length;
  const mixed = records.filter((row) => row.outcome === "mixed").length;
  const losses = records.filter((row) => row.outcome === "loss").length;
  const realizedUsd = round2(records.reduce((sum, row) => {
    const sign = row.outcome === "loss" ? -1 : 1;
    return sum + sign * Math.max(0, Number(row.realizedUsd || row.estimatedUsd || 0));
  }, 0));
  const actualCapturedUsd = round2(records.filter((row) => row.outcomeSource === "actual").reduce((sum, row) => {
    const sign = row.outcome === "loss" ? -1 : 1;
    return sum + sign * Math.max(0, Number(row.realizedUsd || 0));
  }, 0));
  const actualCapturedCount = records.filter((row) => row.outcomeSource === "actual").length;

  const panelMap = new Map<string, MoneyFeedbackRecord[]>();
  const laneMap = new Map<MoneyMove["lane"], MoneyFeedbackRecord[]>();
  for (const row of records) {
    panelMap.set(row.panelId, [...(panelMap.get(row.panelId) || []), row]);
    laneMap.set(row.lane, [...(laneMap.get(row.lane) || []), row]);
  }

  const topPanels = Array.from(panelMap.entries())
    .map(([panelId, rows]) => ({ panelId, ...tally(rows) }))
    .sort((a, b) => (b.score * 100 + b.realizedUsd) - (a.score * 100 + a.realizedUsd))
    .slice(0, limit);

  const topLanes = Array.from(laneMap.entries())
    .map(([lane, rows]) => ({ lane, ...tally(rows) }))
    .sort((a, b) => (b.score * 100 + b.realizedUsd) - (a.score * 100 + a.realizedUsd))
    .slice(0, Math.min(4, limit));

  return {
    generatedAt: Date.now(),
    summary: {
      totalFeedback: records.length,
      wins,
      mixed,
      losses,
      realizedUsd,
      actualCapturedUsd,
      actualCapturedCount,
      learnedPanels: panelMap.size,
      learnedLanes: laneMap.size,
    },
    topPanels,
    topLanes,
    recent: records.slice(0, Math.max(4, limit)),
  };
}
