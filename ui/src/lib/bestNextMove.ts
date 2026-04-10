import { loadJSON } from "./storage";
import { getActivity, normalizePanelId } from "./brain";

const TRADING_JOURNAL_KEY = "oddengine:trading:journal:v1";
const DONE_KEY = "oddengine:calendar:done:v1";

type MoveSeverity = "high" | "medium" | "low";

type CalendarLike = {
  id: string;
  title?: string;
  date: string;
  time?: string;
  panelId?: string;
};

export type BestNextMove = {
  id: string;
  title: string;
  body: string;
  cta: string;
  panelId: string;
  secondaryLabel: string;
  secondaryPanelId: string;
  severity: MoveSeverity;
  score: number;
  reason: string;
  chip: string;
};

function unwrapGuardedData<T = any>(raw: any): T | null {
  if (raw && typeof raw === "object" && raw.data && typeof raw.version === "string") return raw.data as T;
  return raw as T;
}

function parseEventDate(ev: CalendarLike) {
  const base = new Date(ev.date + "T00:00:00");
  if (ev.time && /^\d{2}:\d{2}$/.test(ev.time)) {
    const [hh, mm] = ev.time.split(":").map((x) => Number(x));
    base.setHours(hh || 0, mm || 0, 0, 0);
  }
  return base;
}

function hoursAgo(ts?: number | null) {
  if (!ts) return null;
  return (Date.now() - ts) / 36e5;
}

function countUndoneToday(todayEvents: CalendarLike[]) {
  const doneMap = loadJSON<Record<string, number>>(DONE_KEY, {} as any) || {};
  return todayEvents.filter((ev) => !doneMap?.[ev.id]).length;
}

function lastTouchedHours(panelId: string) {
  const hit = getActivity().find((a) => normalizePanelId(a.panelId || "") === normalizePanelId(panelId));
  return hoursAgo(hit?.ts || null);
}

function buildMoneySnapshot() {
  const tradingRaw = unwrapGuardedData<any>(loadJSON<any>(TRADING_JOURNAL_KEY, [] as any));
  const tradingEntries = Array.isArray(tradingRaw) ? tradingRaw : [];
  const tradingPnl = tradingEntries.reduce((sum: number, item: any) => sum + Number(item?.pnl || 0), 0);
  const tradingWins = tradingEntries.filter((item: any) => Number(item?.pnl || 0) > 0).length;
  const tradingLosses = tradingEntries.filter((item: any) => Number(item?.pnl || 0) < 0).length;
  const latestTrade = tradingEntries[0]?.createdAt || tradingEntries[tradingEntries.length - 1]?.createdAt || null;

  const pokerRaw = unwrapGuardedData<any>(loadJSON<any>("oddengine:poker:v1", null as any));
  const pokerSessions = Array.isArray(pokerRaw?.sessions) ? pokerRaw.sessions : [];
  const pokerCurrent = Number(pokerRaw?.bankroll?.current || 0);
  const latestPoker = pokerSessions[0]?.endedAt || pokerSessions[pokerSessions.length - 1]?.endedAt || null;

  const groceryRaw = unwrapGuardedData<any>(loadJSON<any>("oddengine:grocery:v1", null as any));
  const groceryEstimated = Number(groceryRaw?.saverPack?.estimatedBasket || groceryRaw?.estimatedBasket || 0);
  const groceryCouponMatches = Array.isArray(groceryRaw?.couponFeed) ? groceryRaw.couponFeed.length : 0;

  return {
    tradingEntries,
    tradingPnl,
    tradingWins,
    tradingLosses,
    tradingCount: tradingEntries.length,
    latestTrade,
    pokerCurrent,
    pokerCount: pokerSessions.length,
    latestPoker,
    groceryEstimated,
    groceryCouponMatches,
  };
}

export function buildBestNextMoves(input: {
  currentRoutine: { mode: "active" | "next"; ev: CalendarLike } | null;
  nextTrading: CalendarLike | null;
  nextWriting: CalendarLike | null;
  nextFamily: CalendarLike | null;
  todayEvents: CalendarLike[];
}): BestNextMove[] {
  const money = buildMoneySnapshot();
  const undoneToday = countUndoneToday(input.todayEvents);
  const tradingTouchedHrs = lastTouchedHours("Trading");
  const groceryTouchedHrs = lastTouchedHours("GroceryMeals");
  const writerTouchedHrs = lastTouchedHours("Books");

  const moves: BestNextMove[] = [];

  if (input.currentRoutine?.ev) {
    moves.push({
      id: "routine-current",
      title: input.currentRoutine.mode === "active" ? "Finish the current routine step" : "Queue up the next routine step",
      body: `${input.currentRoutine.ev.title || "Routine step"} is the cleanest way to keep momentum right now.`,
      cta: input.currentRoutine.mode === "active" ? "Open current step" : "Open next step",
      panelId: input.currentRoutine.ev.panelId || "RoutineLauncher",
      secondaryLabel: "Calendar",
      secondaryPanelId: "Calendar",
      severity: "high",
      score: input.currentRoutine.mode === "active" ? 96 : 88,
      reason: "Time-bound routine item is live.",
      chip: input.currentRoutine.mode === "active" ? "⚡ Now" : "⏭️ Next",
    });
  }

  if (!input.nextTrading) {
    moves.push({
      id: "schedule-trading",
      title: "Schedule the next trading check-in",
      body: "Lock in a premarket scan block so the money lane stays intentional instead of reactive.",
      cta: "+ Add trading check-in",
      panelId: "Trading",
      secondaryLabel: "Calendar",
      secondaryPanelId: "Calendar",
      severity: "high",
      score: 92,
      reason: "No next trading block exists.",
      chip: "🎯 Money",
    });
  } else if ((tradingTouchedHrs == null || tradingTouchedHrs > 16) && money.tradingCount > 0) {
    moves.push({
      id: "review-trading",
      title: "Review Trading before the next setup",
      body: `You have ${money.tradingCount} journal ${money.tradingCount === 1 ? "entry" : "entries"}. Refresh the lane before the next scan or setup.`,
      cta: "Open Trading",
      panelId: "Trading",
      secondaryLabel: "Calendar",
      secondaryPanelId: "Calendar",
      severity: "medium",
      score: 81,
      reason: "Trading has history but has not been touched recently.",
      chip: "📈 Review",
    });
  }

  if (money.tradingCount === 0) {
    moves.push({
      id: "first-trade-note",
      title: "Capture your first trade note",
      body: "Open Trading, scan a symbol, and save one journal entry so Home can coach from real outcomes.",
      cta: "Open Trading",
      panelId: "Trading",
      secondaryLabel: "Open Home",
      secondaryPanelId: "Home",
      severity: "high",
      score: 90,
      reason: "No trading journal entries yet.",
      chip: "📝 Start",
    });
  }

  if (money.groceryCouponMatches > 0 && (groceryTouchedHrs == null || groceryTouchedHrs > 10)) {
    moves.push({
      id: "grocery-savings",
      title: "Convert coupon matches into real savings",
      body: `You have ${money.groceryCouponMatches} coupon matches and about $${Math.round(money.groceryEstimated || 0)} in basket planning ready to use.`,
      cta: "Open Grocery Meals",
      panelId: "GroceryMeals",
      secondaryLabel: "Open Home",
      secondaryPanelId: "Home",
      severity: money.groceryCouponMatches >= 5 ? "high" : "medium",
      score: Math.min(89, 72 + money.groceryCouponMatches * 3),
      reason: "Coupon-backed grocery move is available.",
      chip: "🛒 Save",
    });
  }

  if (!input.nextWriting && (writerTouchedHrs == null || writerTouchedHrs > 24)) {
    moves.push({
      id: "writing-block",
      title: "Protect a writing block",
      body: "Studio momentum stays real when a concrete writing block exists on the calendar.",
      cta: "Open Studio",
      panelId: "Books",
      secondaryLabel: "Calendar",
      secondaryPanelId: "Calendar",
      severity: "low",
      score: 60,
      reason: "No upcoming writing block found.",
      chip: "✍️ Create",
    });
  }

  if (!input.nextFamily) {
    moves.push({
      id: "family-night",
      title: "Set tonight’s family anchor",
      body: "Even one simple family block makes the rest of the OS feel grounded and intentional.",
      cta: "Open Entertainment",
      panelId: "Entertainment",
      secondaryLabel: "Calendar",
      secondaryPanelId: "Calendar",
      severity: "low",
      score: 58,
      reason: "No family entertainment block is scheduled.",
      chip: "🎬 Family",
    });
  }

  if (undoneToday >= 3) {
    moves.push({
      id: "triage-tasks",
      title: "Triage today’s top tasks",
      body: `${undoneToday} tasks are still open today. Knock out the top one before context switching again.`,
      cta: "Open Calendar",
      panelId: "Calendar",
      secondaryLabel: "Run Routine",
      secondaryPanelId: "RoutineLauncher",
      severity: undoneToday >= 5 ? "high" : "medium",
      score: Math.min(87, 68 + undoneToday * 4),
      reason: "Task load is building.",
      chip: "✅ Queue",
    });
  }

  if (!moves.length) {
    moves.push({
      id: "digest",
      title: "Run the operator digest",
      body: "Use Home to pivot into the strongest move across money, routine, and family ops.",
      cta: "Open Brain",
      panelId: "Brain",
      secondaryLabel: "Run Routine",
      secondaryPanelId: "RoutineLauncher",
      severity: "medium",
      score: 55,
      reason: "No urgent move beat the baseline digest.",
      chip: "🧠 Digest",
    });
  }

  return moves.sort((a, b) => b.score - a.score).slice(0, 3);
}
