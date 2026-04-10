import { buildIncomeScoutBoard, type IncomeScoutMove } from "./incomeScout";
import { loadJSON, saveJSON } from "./storage";
import { buildRecoverySnapshot } from "./recoveryPlanner";

export type IncomeSniperFilters = {
  legitOnly: boolean;
  noUpfrontOnly: boolean;
  lowEnergyOnly: boolean;
  lowTimeOnly: boolean;
  fromHomeOnly: boolean;
  limit: number;
};

export type IncomeSniperOutcome = "win" | "mixed" | "loss";

export type IncomeSniperOutcomeRecord = {
  id: string;
  ts: number;
  laneKey: string;
  category: IncomeScoutMove["category"];
  panelId: string;
  title: string;
  outcome: IncomeSniperOutcome;
  realizedUsd?: number | null;
  note?: string;
};

export type IncomeSniperLaneStats = {
  laneKey: string;
  category: IncomeScoutMove["category"];
  panelId: string;
  title: string;
  wins: number;
  mixed: number;
  losses: number;
  actualUsd: number;
  actualCount: number;
  scoreBoost: number;
  lastTs: number;
};

export type IncomeSniperMove = IncomeScoutMove & {
  laneKey: string;
  fromHome: true;
  lowEnergyFriendly: boolean;
  lowTimeFriendly: boolean;
  actualUsd: number;
  actualCount: number;
  wins: number;
  mixed: number;
  losses: number;
  scoreBoost: number;
  sniperScore: number;
  sniperConfidence: number;
  fitReason: string;
};

export type IncomeSniperBoard = {
  generatedAt: number;
  filters: IncomeSniperFilters;
  headline: string;
  summary: {
    totalMoves: number;
    visibleMoves: number;
    noUpfrontMoves: number;
    lowEnergyMoves: number;
    lowTimeMoves: number;
    fromHomeMoves: number;
    visibleMonthlyUsd: number;
    visibleWeeklyUsd: number;
    visibleOneShotUsd: number;
    actualCapturedUsd: number;
    actualCapturedCount: number;
    categories: IncomeScoutMove["category"][];
  };
  todayBestMove: IncomeSniperMove | null;
  topMoves: IncomeSniperMove[];
  laneStats: IncomeSniperLaneStats[];
  allMoves: IncomeSniperMove[];
};

const FILTER_KEY = "oddengine:incomeSniper:filters:v1";
const OUTCOME_KEY = "oddengine:incomeSniper:outcomes:v1";
const MAX_RECORDS = 240;

function uid(prefix = "isn") {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36)}`;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function round2(n: number) {
  return Number((Number(n) || 0).toFixed(2));
}

function normalizeFilters(raw?: Partial<IncomeSniperFilters>): IncomeSniperFilters {
  return {
    legitOnly: raw?.legitOnly !== false,
    noUpfrontOnly: !!raw?.noUpfrontOnly,
    lowEnergyOnly: !!raw?.lowEnergyOnly,
    lowTimeOnly: !!raw?.lowTimeOnly,
    fromHomeOnly: raw?.fromHomeOnly !== false,
    limit: clamp(Number(raw?.limit || 8), 3, 16),
  };
}

export function getIncomeSniperFilters() {
  return normalizeFilters(loadJSON<Partial<IncomeSniperFilters>>(FILTER_KEY, {}));
}

export function saveIncomeSniperFilters(next: Partial<IncomeSniperFilters>) {
  const merged = normalizeFilters({ ...getIncomeSniperFilters(), ...next });
  saveJSON(FILTER_KEY, merged);
  return merged;
}

export function getIncomeSniperOutcomeRecords() {
  const raw = loadJSON<IncomeSniperOutcomeRecord[]>(OUTCOME_KEY, []);
  return Array.isArray(raw) ? raw : [];
}

function saveOutcomeRecords(records: IncomeSniperOutcomeRecord[]) {
  saveJSON(OUTCOME_KEY, records.slice(0, MAX_RECORDS));
}

export function getIncomeSniperLaneKey(move: Pick<IncomeScoutMove, "category" | "panelId" | "title">) {
  return [move.category, move.panelId, move.title]
    .map((part) => String(part || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80))
    .join("__");
}

export function recordIncomeSniperOutcome(
  move: Pick<IncomeScoutMove, "category" | "panelId" | "title">,
  opts?: { realizedUsd?: number | null; outcome?: IncomeSniperOutcome; note?: string }
) {
  const list = getIncomeSniperOutcomeRecords();
  const realizedUsd = opts?.realizedUsd != null ? Number(opts.realizedUsd) : null;
  const inferred: IncomeSniperOutcome = realizedUsd == null ? (opts?.outcome || "win") : realizedUsd > 0 ? "win" : realizedUsd < 0 ? "loss" : "mixed";
  const record: IncomeSniperOutcomeRecord = {
    id: uid("iso"),
    ts: Date.now(),
    laneKey: getIncomeSniperLaneKey(move),
    category: move.category,
    panelId: String(move.panelId || ""),
    title: String(move.title || "Income lane"),
    outcome: opts?.outcome || inferred,
    realizedUsd,
    note: opts?.note,
  };
  saveOutcomeRecords([record, ...list]);
  return record;
}

function parseMaybeNumber(raw: string | null | undefined) {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  const n = Number(trimmed.replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function normalizeOutcome(raw: string | null | undefined, fallback: IncomeSniperOutcome): IncomeSniperOutcome {
  const value = String(raw || "").trim().toLowerCase();
  if (value === "win" || value === "mixed" || value === "loss") return value;
  return fallback;
}

export function promptIncomeSniperOutcomeCapture(move: Pick<IncomeSniperMove, "title" | "category">) {
  try {
    const amountRaw = window.prompt(`Actual dollars made or saved for \"${move.title}\"?\nUse a negative number for a loss, 0 for a wash, or leave blank to skip.`, "");
    if (amountRaw == null) return undefined;
    const realizedUsd = parseMaybeNumber(amountRaw);
    const fallback: IncomeSniperOutcome = realizedUsd == null ? "win" : realizedUsd > 0 ? "win" : realizedUsd < 0 ? "loss" : "mixed";
    const outcomeRaw = window.prompt(`Outcome type for ${move.category}? win / mixed / loss`, fallback);
    if (outcomeRaw == null) return undefined;
    const outcome = normalizeOutcome(outcomeRaw, fallback);
    const noteRaw = window.prompt("Optional note for the income lane log", "");
    const note = noteRaw && String(noteRaw).trim() ? String(noteRaw).trim() : undefined;
    return { realizedUsd, outcome, note };
  } catch {
    return undefined;
  }
}

function buildLaneStats(moves: IncomeScoutMove[]) {
  const records = getIncomeSniperOutcomeRecords();
  const moveMap = new Map<string, IncomeScoutMove>();
  for (const move of moves) {
    moveMap.set(getIncomeSniperLaneKey(move), move);
  }
  const laneMap = new Map<string, IncomeSniperOutcomeRecord[]>();
  for (const row of records) {
    laneMap.set(row.laneKey, [...(laneMap.get(row.laneKey) || []), row]);
  }

  const stats: IncomeSniperLaneStats[] = Array.from(laneMap.entries()).map(([laneKey, rows]) => {
    const seed = moveMap.get(laneKey);
    const wins = rows.filter((row) => row.outcome === "win").length;
    const mixed = rows.filter((row) => row.outcome === "mixed").length;
    const losses = rows.filter((row) => row.outcome === "loss").length;
    const actualUsd = round2(rows.reduce((sum, row) => sum + Number(row.realizedUsd || 0), 0));
    const actualCount = rows.filter((row) => row.realizedUsd != null).length;
    const scoreBoost = clamp(wins * 4 + mixed - losses * 4 + Math.round(actualUsd / 25), -14, 18);
    const lastTs = Math.max(0, ...rows.map((row) => Number(row.ts || 0)));
    return {
      laneKey,
      category: seed?.category || rows[0]?.category || "Writing",
      panelId: seed?.panelId || rows[0]?.panelId || "Money",
      title: seed?.title || rows[0]?.title || "Income lane",
      wins,
      mixed,
      losses,
      actualUsd,
      actualCount,
      scoreBoost,
      lastTs,
    };
  });

  return stats.sort((a, b) => (b.scoreBoost * 100 + b.actualUsd) - (a.scoreBoost * 100 + a.actualUsd));
}

function moveMatchesFilters(move: IncomeSniperMove, filters: IncomeSniperFilters) {
  if (filters.legitOnly && !move.legit) return false;
  if (filters.noUpfrontOnly && !move.noUpfrontCost) return false;
  if (filters.lowEnergyOnly && !move.lowEnergyFriendly) return false;
  if (filters.lowTimeOnly && !move.lowTimeFriendly) return false;
  if (filters.fromHomeOnly && !move.fromHome) return false;
  return true;
}

export function buildRecoveryAwareIncomeSniperBoard(limit = 8, filtersInput?: Partial<IncomeSniperFilters>): IncomeSniperBoard {
  const filters = normalizeFilters({ ...getIncomeSniperFilters(), ...(filtersInput || {}), limit });
  const base = buildIncomeScoutBoard(Math.max(limit * 2, 12));
  const recoverySnapshot = buildRecoverySnapshot();
  const laneStats = buildLaneStats(base.allMoves);
  const laneMap = new Map(laneStats.map((row) => [row.laneKey, row] as const));

  const allMoves: IncomeSniperMove[] = base.allMoves.map((move) => {
    const laneKey = getIncomeSniperLaneKey(move);
    const stats = laneMap.get(laneKey);
    const lowEnergyFriendly = move.recovery ? move.recovery.effort === "low" || move.recovery.fit === "strong" : false;
    const lowTimeFriendly = move.recovery ? move.recovery.minMinutes <= 30 : false;
    const scoreBoost = stats?.scoreBoost || 0;
    const filterBoost = (filters.noUpfrontOnly && move.noUpfrontCost ? 4 : 0) + (filters.lowEnergyOnly && lowEnergyFriendly ? 5 : 0) + (filters.lowTimeOnly && lowTimeFriendly ? 4 : 0) + (filters.fromHomeOnly ? 2 : 0);
    const sniperScore = clamp(move.score + scoreBoost + filterBoost, 0, 99);
    const sniperConfidence = clamp(move.confidence + Math.round((stats?.wins || 0) * 1.5) - (stats?.losses || 0) * 2 + Math.min(8, stats?.actualCount || 0), 25, 99);
    const fitBits = [] as string[];
    if (move.recovery?.fitLabel) fitBits.push(move.recovery.fitLabel);
    if (lowEnergyFriendly) fitBits.push("low-energy friendly");
    if (lowTimeFriendly) fitBits.push(`${move.recovery?.minMinutes || 30}m friendly`);
    if (stats?.actualUsd) fitBits.push(`actual ${stats.actualUsd >= 0 ? "$" : "-$"}${Math.round(Math.abs(stats.actualUsd)).toLocaleString()}`);
    return {
      ...move,
      laneKey,
      fromHome: true,
      lowEnergyFriendly,
      lowTimeFriendly,
      actualUsd: round2(stats?.actualUsd || 0),
      actualCount: stats?.actualCount || 0,
      wins: stats?.wins || 0,
      mixed: stats?.mixed || 0,
      losses: stats?.losses || 0,
      scoreBoost,
      sniperScore,
      sniperConfidence,
      fitReason: fitBits.join(" • ") || `${recoverySnapshot.mode} mode`,
    };
  });

  const visible = allMoves
    .filter((move) => moveMatchesFilters(move, filters))
    .sort((a, b) => (b.sniperScore * 100 + b.sniperConfidence) - (a.sniperScore * 100 + a.sniperConfidence))
    .slice(0, filters.limit);

  const visibleMonthlyUsd = round2(visible.filter((row) => row.amountUsd && row.amountPeriod === "month").reduce((sum, row) => sum + Number(row.amountUsd || 0), 0));
  const visibleWeeklyUsd = round2(visible.filter((row) => row.amountUsd && row.amountPeriod === "week").reduce((sum, row) => sum + Number(row.amountUsd || 0), 0));
  const visibleOneShotUsd = round2(visible.filter((row) => row.amountUsd && row.amountPeriod === "once").reduce((sum, row) => sum + Number(row.amountUsd || 0), 0));
  const actualCapturedUsd = round2(visible.reduce((sum, row) => sum + Number(row.actualUsd || 0), 0));
  const actualCapturedCount = visible.reduce((sum, row) => sum + Number(row.actualCount || 0), 0);
  const categories = Array.from(new Set(visible.map((row) => row.category))) as IncomeScoutMove["category"][];

  const headlineBits = [
    `${recoverySnapshot.mode} mode`,
    `${recoverySnapshot.timeAvailableMin}m`,
    `${visible.filter((row) => row.noUpfrontCost).length} no-upfront`,
    `${visible.filter((row) => row.lowEnergyFriendly).length} low-energy`,
  ];
  if (filters.lowTimeOnly) headlineBits.push("low-time filter on");
  if (actualCapturedUsd) headlineBits.push(`$${Math.round(actualCapturedUsd).toLocaleString()} actual logged`);

  return {
    generatedAt: Date.now(),
    filters,
    headline: `Income Sniper • ${headlineBits.join(" • ")}`,
    summary: {
      totalMoves: allMoves.length,
      visibleMoves: visible.length,
      noUpfrontMoves: visible.filter((row) => row.noUpfrontCost).length,
      lowEnergyMoves: visible.filter((row) => row.lowEnergyFriendly).length,
      lowTimeMoves: visible.filter((row) => row.lowTimeFriendly).length,
      fromHomeMoves: visible.filter((row) => row.fromHome).length,
      visibleMonthlyUsd,
      visibleWeeklyUsd,
      visibleOneShotUsd,
      actualCapturedUsd,
      actualCapturedCount,
      categories,
    },
    todayBestMove: visible[0] || null,
    topMoves: visible,
    laneStats: laneStats.slice(0, 6),
    allMoves,
  };
}
