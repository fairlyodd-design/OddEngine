import { getPanelMeta } from "./brain";
import { buildRecoveryAwareIncomeSniperBoard, getIncomeSniperOutcomeRecords } from "./incomeSniper";
import { buildRecoverySnapshot } from "./recoveryPlanner";

export type IncomeForgeLaneId = string;

export type IncomeForgeLane = {
  id: IncomeForgeLaneId;
  title: string;
  platform: string;
  panelId: string;
  actionLabel: string;
  upfront: string;
  effort: string;
  minMinutes: number;
  weeklyPotentialUsd: number;
  score: number;
  whyNow: string;
  shipToday: string;
  categoryLabel: string;
};

export type IncomeForgeWeekRow = {
  laneId: IncomeForgeLaneId;
  label: string;
  actualUsd: number;
  logs: number;
};

export type IncomeForgeBoard = {
  generatedAt: number;
  headline: string;
  shipOneThingToday: string;
  todayShipLane: IncomeForgeLane | null;
  lanes: IncomeForgeLane[];
  weeklyScoreboard: {
    totalActualUsd: number;
    totalLogs: number;
    rows: IncomeForgeWeekRow[];
  };
};

const LANE_TO_CATEGORY: Record<IncomeForgeLaneId, string[]> = {
  kdp: ["Writing / eBooks"],
  gumroad: ["Templates"],
  gpt: ["GPTs"],
  template: ["Templates"],
  affiliate: ["Affiliate content"],
  app: ["Apps"],
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function round2(n: number) {
  return Number((Number(n) || 0).toFixed(2));
}

function categoryActualUsd(categoryLabels: string[]) {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const rows = getIncomeSniperOutcomeRecords().filter((row) => Number(row.ts || 0) >= weekAgo && categoryLabels.includes(String(row.category)));
  return {
    actualUsd: round2(rows.reduce((sum, row) => sum + Number(row.realizedUsd || 0), 0)),
    logs: rows.filter((row) => row.realizedUsd != null).length,
  };
}

export function buildPhoenixIncomeForgeBoard(limit = 6): IncomeForgeBoard {
  const recovery = buildRecoverySnapshot();
  const sniper = buildRecoveryAwareIncomeSniperBoard(12);
  const moveByCategory = new Map(sniper.allMoves.map((move) => [String(move.category), move] as const));

  const lanes: IncomeForgeLane[] = [
    {
      id: "kdp",
      title: "KDP booklet / eBook lane",
      platform: "Amazon KDP",
      panelId: "Books",
      actionLabel: "Open Writers Lounge",
      upfront: "$0",
      effort: recovery.capacity === "low" ? "medium" : "high",
      minMinutes: 60,
      weeklyPotentialUsd: 80,
      score: 72,
      whyNow: "Low upfront cost and reusable catalog potential.",
      shipToday: "Outline one tiny guide, workbook, or story booklet and create the listing draft.",
      categoryLabel: "Writing / eBooks",
    },
    {
      id: "gumroad",
      title: "Gumroad micro-offer lane",
      platform: "Gumroad",
      panelId: "Money",
      actionLabel: "Open Money",
      upfront: "$0",
      effort: "low",
      minMinutes: 25,
      weeklyPotentialUsd: 70,
      score: 84,
      whyNow: "Fastest legit ship path for checklists, packs, and tiny offers.",
      shipToday: "Bundle one checklist, tracker, or mini-pack and publish a simple offer page.",
      categoryLabel: "Templates",
    },
    {
      id: "gpt",
      title: "GPT lane",
      platform: "GPT builder / store",
      panelId: "OptionsSaaS",
      actionLabel: "Open Options SaaS",
      upfront: "$0+",
      effort: "medium",
      minMinutes: 45,
      weeklyPotentialUsd: 90,
      score: 78,
      whyNow: "Fast to prototype and useful as a trust/lead engine even before payout scales.",
      shipToday: "Ship one focused GPT around a real pain point and write a clean use-case card.",
      categoryLabel: "GPTs",
    },
    {
      id: "template",
      title: "Template pack lane",
      platform: "Gumroad / direct",
      panelId: "Builder",
      actionLabel: "Open Builder",
      upfront: "$0",
      effort: "low",
      minMinutes: 30,
      weeklyPotentialUsd: 75,
      score: 86,
      whyNow: "Great low-energy product lane when you already have design/build skills.",
      shipToday: "Polish one worksheet, dashboard starter, or prompt pack and export the sales version.",
      categoryLabel: "Templates",
    },
    {
      id: "affiliate",
      title: "Affiliate content lane",
      platform: "Blog / socials / product pages",
      panelId: "Money",
      actionLabel: "Open Money",
      upfront: "$0",
      effort: "low",
      minMinutes: 20,
      weeklyPotentialUsd: 45,
      score: 70,
      whyNow: "Slow build, but good when recovery is rough and you need a low-pressure ship lane.",
      shipToday: "Write one recommendation post or roundup tied to a tool or niche you actually use.",
      categoryLabel: "Affiliate content",
    },
    {
      id: "app",
      title: "Micro-app lane",
      platform: "Direct / Gumroad / itch",
      panelId: "Builder",
      actionLabel: "Open Builder",
      upfront: "$0",
      effort: "high",
      minMinutes: 90,
      weeklyPotentialUsd: 150,
      score: 74,
      whyNow: "Highest upside when energy is solid and you can finish a useful little tool.",
      shipToday: "Cut one real-use micro feature into a sellable mini app instead of a giant platform.",
      categoryLabel: "Apps",
    },
  ].map((lane) => {
    const move = moveByCategory.get(String(lane.categoryLabel));
    const recoveryBoost = recovery.capacity === "low"
      ? lane.effort === "low" ? 8 : lane.effort === "medium" ? -2 : -10
      : recovery.capacity === "medium"
        ? lane.effort === "high" ? -2 : 4
        : lane.effort === "high" ? 8 : 3;
    const timeBoost = recovery.timeAvailableMin >= lane.minMinutes ? 6 : recovery.timeAvailableMin >= Math.max(15, lane.minMinutes / 2) ? 1 : -6;
    const moveBoost = move ? Math.round((move.sniperScore - 70) / 3) : 0;
    const score = clamp(lane.score + recoveryBoost + timeBoost + moveBoost, 45, 97);
    const whyBits = [lane.whyNow];
    if (move?.fitReason) whyBits.push(move.fitReason);
    if (recovery.timeAvailableMin < lane.minMinutes) whyBits.push("Time is tight, so this is more of a partial-ship lane today.");
    return {
      ...lane,
      score,
      whyNow: whyBits.join(" "),
    };
  }).sort((a, b) => b.score - a.score).slice(0, Math.max(3, limit));

  const rows: IncomeForgeWeekRow[] = (Object.keys(LANE_TO_CATEGORY) as IncomeForgeLaneId[]).map((laneId) => {
    const totals = categoryActualUsd(LANE_TO_CATEGORY[laneId]);
    const lane = lanes.find((item) => item.id === laneId);
    return {
      laneId,
      label: lane?.title || laneId.toUpperCase(),
      actualUsd: totals.actualUsd,
      logs: totals.logs,
    };
  }).sort((a, b) => Math.abs(b.actualUsd) - Math.abs(a.actualUsd));

  const top = lanes[0] || null;
  const headline = top
    ? `${top.title} is the strongest ship lane right now for ${recovery.mode} mode.`
    : "Income Forge needs a few more signals before it can rank a best ship lane.";
  const shipOneThingToday = top
    ? `${top.shipToday} Route through ${getPanelMeta(top.panelId).title} and finish one sellable chunk.`
    : "Pick one tiny sellable and finish the version that can actually be posted today.";

  return {
    generatedAt: Date.now(),
    headline,
    shipOneThingToday,
    todayShipLane: top,
    lanes,
    weeklyScoreboard: {
      totalActualUsd: round2(rows.reduce((sum, row) => sum + row.actualUsd, 0)),
      totalLogs: rows.reduce((sum, row) => sum + row.logs, 0),
      rows,
    },
  };
}
