import { loadJSON } from "./storage";
import { getMoneyLearningBoost, type MoneyLearningBoost } from "./moneyScore";
import { buildIncomeScoutBoard } from "./incomeScout";
import { applyRecoveryToMoneyMove, buildRecoverySnapshot, type RecoveryMoveMeta } from "./recoveryPlanner";

export type MoneyMove = {
  id: string;
  panelId: string;
  lane: "Earn" | "Save" | "Build" | "Protect";
  kind: "earn" | "save" | "build" | "protect";
  title: string;
  body: string;
  valueLabel: string;
  score: number;
  confidence: number;
  level: "good" | "warn" | "error";
  actionId?: string;
  actionLabel?: string;
  amountUsd?: number;
  amountPeriod?: "week" | "month" | "once";
  tags: string[];
  learning?: MoneyLearningBoost;
  recovery?: RecoveryMoveMeta;
};

export type MoneyVacuumScan = {
  generatedAt: number;
  headline: string;
  summary: {
    totalMoves: number;
    earnMoves: number;
    saveMoves: number;
    buildMoves: number;
    protectMoves: number;
    visibleMonthlyUsd: number;
    visibleWeeklyUsd: number;
    visibleOneShotUsd: number;
  };
  topMoves: MoneyMove[];
  allMoves: MoneyMove[];
};

function uid(prefix = "mv") {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36)}`;
}

function asNum(value: any, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function currency(n: number) {
  return `$${Math.round(n).toLocaleString()}`;
}

function parseDollarText(text: any): number {
  const src = String(text || "");
  const nums = (src.match(/\$?\d+(?:\.\d+)?/g) || []).map((part) => Number(String(part).replace(/[^0-9.]/g, ""))).filter((n) => Number.isFinite(n));
  if (!nums.length) return 0;
  return Math.max(...nums);
}

function estimateItemPrice(item: string) {
  const text = String(item || "").toLowerCase();
  if (["chicken", "beef", "sausage", "turkey", "fish"].some((t) => text.includes(t))) return 6.5;
  if (["eggs", "milk", "yogurt", "cheese"].some((t) => text.includes(t))) return 4.2;
  if (["rice", "beans", "oatmeal", "bread", "pasta", "potatoes"].some((t) => text.includes(t))) return 2.5;
  if (["berries", "banana", "apple", "fruit", "vegetable", "broccoli", "carrots", "salad"].some((t) => text.includes(t))) return 3.1;
  if (["snack", "chips", "crackers", "juice"].some((t) => text.includes(t))) return 3.9;
  return 4.0;
}

function addMove(list: MoneyMove[], move: Omit<MoneyMove, "id">) {
  list.push({ id: uid(move.kind), ...move });
}

function tradingMove(list: MoneyMove[]) {
  const trading = loadJSON<any>("oddengine:trading:sniper:v4", {} as any) || {};
  const chain = loadJSON<any>("odd.trading.chainSnapshot", null as any) || null;
  const symbol = String(trading.symbol || chain?.symbol || "").trim().toUpperCase();
  const contracts = Array.isArray(chain?.contracts) ? chain.contracts : [];
  if (!symbol) {
    addMove(list, {
      panelId: "Trading",
      lane: "Earn",
      kind: "earn",
      title: "Seed the active trading lane",
      body: "Trading is one of the fastest money lanes in the OS, but it needs an active symbol before Brain can rank contracts and risk.",
      valueLabel: "Fast leverage lane waiting",
      score: 58,
      confidence: 54,
      level: "warn",
      actionId: "panel:trading",
      actionLabel: "Open Trading",
      tags: ["trading", "earn", "setup"],
    });
    return;
  }
  if (!contracts.length) {
    addMove(list, {
      panelId: "Trading",
      lane: "Earn",
      kind: "earn",
      title: `Load the ${symbol} chain and rank the best contract`,
      body: `${symbol} is already active, so the fastest next move is loading a fresh options chain and letting Brain run the safer contract plan.`,
      valueLabel: `${symbol} lane primed`,
      score: 74,
      confidence: 68,
      level: "warn",
      actionId: "panel:trading",
      actionLabel: "Open Trading",
      tags: ["trading", symbol, "options"],
    });
    return;
  }
  const focusable = contracts.filter((row: any) => Number(row?.score || row?.compositeScore || 0) > 0).length || contracts.length;
  addMove(list, {
    panelId: "Trading",
    lane: "Earn",
    kind: "earn",
    title: `Run the live ${symbol} trading chain`,
    body: `${contracts.length} contracts are loaded for ${symbol}. Brain can tighten the setup, focus the cleanest contract, and draft a trade plan from real chain context.`,
    valueLabel: `${focusable} contracts ready`,
    score: 88,
    confidence: 76,
    level: "good",
    actionId: "trading:chain-safe-focus-plan",
    actionLabel: "Run trading chain",
    tags: ["trading", symbol, "chain"],
  });
}

function familyBudgetMoves(list: MoneyMove[]) {
  const budget = loadJSON<any>("oddengine:familyBudget:v2", null as any) || {};
  const accounts = Array.isArray(budget.accounts) ? budget.accounts : [];
  const recurring = Array.isArray(budget.recurring) ? budget.recurring : [];
  const txs = Array.isArray(budget.transactions) ? budget.transactions : [];
  if (!accounts.length) {
    addMove(list, {
      panelId: "FamilyBudget",
      lane: "Save",
      kind: "save",
      title: "Seed accounts so leak detection can work",
      body: "Budget cannot surface real money leaks until the household accounts are in place.",
      valueLabel: "Savings lane blocked",
      score: 55,
      confidence: 52,
      level: "warn",
      actionId: "panel:budget",
      actionLabel: "Open Budget",
      tags: ["budget", "seed"],
    });
    return;
  }
  const subs = recurring.filter((row: any) => String(row?.type || "").toLowerCase() === "subscription");
  const subTotal = subs.reduce((sum: number, row: any) => sum + Math.max(0, asNum(row?.amount)), 0);
  if (subTotal > 0) {
    addMove(list, {
      panelId: "FamilyBudget",
      lane: "Save",
      kind: "save",
      title: "Audit recurring subscriptions and bills",
      body: `${subs.length} subscription-style recurring items are visible. Tightening the weakest lines is one of the easiest monthly savings moves in the OS.`,
      valueLabel: `${currency(subTotal)}/mo visible recurring spend`,
      score: 84,
      confidence: 80,
      level: "good",
      actionId: "budget:reports",
      actionLabel: "Open reports",
      amountUsd: Number(subTotal.toFixed(2)),
      amountPeriod: "month",
      tags: ["budget", "subscriptions", "save"],
    });
  }
  const liabilities = accounts.filter((row: any) => ["CREDIT_CARD", "LOAN"].includes(String(row?.type || "").toUpperCase()) && Math.abs(asNum(row?.balance)) > 0);
  const monthlyInterest = liabilities.reduce((sum: number, row: any) => {
    const bal = Math.abs(asNum(row?.balance));
    const apr = Math.max(0, asNum(row?.apr));
    return sum + ((bal * apr) / 100) / 12;
  }, 0);
  if (monthlyInterest > 0) {
    addMove(list, {
      panelId: "FamilyBudget",
      lane: "Save",
      kind: "save",
      title: "Run avalanche payoff against active interest drag",
      body: `${liabilities.length} liabilities are carrying estimated monthly interest. The avalanche lane is the cleanest save-more move when the debt data is seeded.`,
      valueLabel: `~${currency(monthlyInterest)}/mo interest drag`,
      score: 86,
      confidence: 77,
      level: "good",
      actionId: "budget:payoff-avalanche",
      actionLabel: "Run avalanche payoff",
      amountUsd: Number(monthlyInterest.toFixed(2)),
      amountPeriod: "month",
      tags: ["budget", "debt", "interest"],
    });
  }
  if (accounts.length && !txs.length) {
    addMove(list, {
      panelId: "FamilyBudget",
      lane: "Save",
      kind: "save",
      title: "Import transactions to reveal real leaks",
      body: "Accounts are seeded, but without transactions Brain cannot spot merchant creep, category drift, or repeated overspend.",
      valueLabel: "Leak map not loaded",
      score: 68,
      confidence: 65,
      level: "warn",
      actionId: "budget:transactions",
      actionLabel: "Open transactions",
      tags: ["budget", "transactions", "save"],
    });
  }
}

function groceryMove(list: MoneyMove[]) {
  const state = loadJSON<any>("oddengine:groceryMeals:v1", null as any) || {};
  const groceryList = Array.isArray(state.groceryList) ? state.groceryList : [];
  const priceBook = state.priceBook && typeof state.priceBook === "object" ? state.priceBook : {};
  const goalNum = Number(String(state.basketGoal || "").replace(/[^0-9.]/g, "")) || 0;
  const est = groceryList.reduce((sum: number, item: string) => sum + Number(priceBook[item] || estimateItemPrice(item) || 0), 0);
  const delta = goalNum ? est - goalNum : 0;
  if (!groceryList.length) {
    addMove(list, {
      panelId: "GroceryMeals",
      lane: "Save",
      kind: "save",
      title: "Build the pantry-aware grocery list",
      body: "The meal plan is not saving real money until the pantry-aware list exists and the coupon lane can work off it.",
      valueLabel: "Savings lane waiting",
      score: 62,
      confidence: 66,
      level: "warn",
      actionId: "grocery:build-list",
      actionLabel: "Build grocery list",
      tags: ["grocery", "save", "list"],
    });
    return;
  }
  if (delta > 0) {
    addMove(list, {
      panelId: "GroceryMeals",
      lane: "Save",
      kind: "save",
      title: "Push the grocery plan into cheap-week mode",
      body: `The estimated basket is above the current goal, so the fastest household savings move is a cheap-week pass plus coupon matching before checkout.`,
      valueLabel: `${currency(delta)} over goal this week`,
      score: 82,
      confidence: 74,
      level: "good",
      actionId: "grocery:cheap-week",
      actionLabel: "Run cheap week",
      amountUsd: Number(delta.toFixed(2)),
      amountPeriod: "week",
      tags: ["grocery", "cheap-week", "coupons"],
    });
  } else {
    const softSave = Math.max(6, est * 0.08);
    addMove(list, {
      panelId: "GroceryMeals",
      lane: "Save",
      kind: "save",
      title: "Refresh the coupon lane before shopping",
      body: `The grocery plan is already pretty close to target. A coupon refresh and store-plan pass can still shave off a little more before checkout.`,
      valueLabel: `Maybe save ${currency(softSave)} this run`,
      score: 61,
      confidence: 58,
      level: "good",
      actionId: "grocery:coupon-lane",
      actionLabel: "Refresh coupon lane",
      amountUsd: Number(softSave.toFixed(2)),
      amountPeriod: "week",
      tags: ["grocery", "coupons", "save"],
    });
  }
}

function cryptoGamesMove(list: MoneyMove[]) {
  const state = loadJSON<any>("oddengine:cryptoGames:v4", null as any) || {};
  const games = (Array.isArray(state.games) ? state.games : []).filter((row: any) => !row?.disabled);
  const sessions = Array.isArray(state.sessions) ? state.sessions : [];
  const payouts = Array.isArray(state.payouts) ? state.payouts : [];
  if (!games.length) return;
  const sevenDayTs = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentSessions = sessions.filter((row: any) => Number(row?.endedAt || row?.startedAt || 0) >= sevenDayTs);
  const recentPayouts = payouts.filter((row: any) => Number(row?.ts || 0) >= sevenDayTs);
  const byGame = new Map<string, { minutes: number; sats: number }>();
  for (const row of recentSessions) {
    const key = String(row?.gameName || "").trim();
    if (!key) continue;
    const cur = byGame.get(key) || { minutes: 0, sats: 0 };
    cur.minutes += Math.max(0, asNum(row?.minutes));
    cur.sats += Math.max(0, asNum(row?.satsEarned));
    byGame.set(key, cur);
  }
  for (const row of recentPayouts) {
    const key = String(row?.gameName || "").trim();
    if (!key) continue;
    const cur = byGame.get(key) || { minutes: 0, sats: 0 };
    cur.sats += Math.max(0, asNum(row?.sats));
    byGame.set(key, cur);
  }
  let best: any = null;
  let bestRate = -1;
  for (const game of games) {
    const stats = byGame.get(String(game?.name || ""));
    const rate = stats && stats.minutes > 0 ? (stats.sats / stats.minutes) * 60 : Math.max(0, asNum(game?.estimatedSatsPerHour));
    if (rate > bestRate) {
      best = game;
      bestRate = rate;
    }
  }
  if (!best) return;
  addMove(list, {
    panelId: "CryptoGames",
    lane: "Earn",
    kind: "earn",
    title: `Run the top Game Time loop: ${best.name}`,
    body: `Game Time already has enough data to point at the strongest sats lane instead of guessing. Use the sessions lane to keep only the games that actually pay.`,
    valueLabel: `${Math.round(Math.max(0, bestRate))} sats/hr lane`,
    score: Math.max(56, Math.min(78, 58 + Math.round(bestRate / 5))),
    confidence: recentSessions.length || recentPayouts.length ? 72 : 56,
    level: recentSessions.length || recentPayouts.length ? "good" : "warn",
    actionId: "panel:games",
    actionLabel: "Open Game Time",
    tags: ["crypto-games", "sats", "earn"],
  });
}

function miningMove(list: MoneyMove[]) {
  const state = loadJSON<any>("oddengine:mining:v1", null as any) || {};
  const miners = Array.isArray(state.miners) ? state.miners : [];
  const pools = Array.isArray(state.pools) ? state.pools : [];
  const payouts = Array.isArray(state.payouts) ? state.payouts : [];
  if (!miners.length && !pools.length) return;
  if (!payouts.length) {
    addMove(list, {
      panelId: "Mining",
      lane: "Protect",
      kind: "protect",
      title: "Log mining payouts so the radar can spot dead time",
      body: "Mining hardware and pools are seeded, but payout history is still missing, so Brain cannot protect the lane from hidden downtime.",
      valueLabel: "Payout radar not calibrated",
      score: 60,
      confidence: 64,
      level: "warn",
      actionId: "panel:mining",
      actionLabel: "Open Mining",
      tags: ["mining", "payouts", "protect"],
    });
    return;
  }
  const lastTs = Math.max(...payouts.map((row: any) => asNum(row?.ts)));
  const hrs = Math.round(Math.max(0, (Date.now() - lastTs) / 3600000));
  addMove(list, {
    panelId: "Mining",
    lane: hrs > 24 ? "Protect" : "Earn",
    kind: hrs > 24 ? "protect" : "earn",
    title: hrs > 24 ? "Investigate mining payout slowdown" : "Keep the mining lane tuned and logging",
    body: hrs > 24
      ? `The most recent mining payout is getting old. Checking miner health and pool thresholds is one of the best protect-the-income moves right now.`
      : `Mining is paying recently enough that the main move is keeping payout logs current and comparing pools before drift gets expensive.`,
    valueLabel: hrs > 24 ? `${hrs}h since last payout` : `${payouts.length} logged payouts`,
    score: hrs > 24 ? 73 : 52,
    confidence: 70,
    level: hrs > 24 ? "warn" : "good",
    actionId: "panel:mining",
    actionLabel: "Open Mining",
    tags: ["mining", hrs > 24 ? "alert" : "steady", "protect"],
  });
}


function incomeScoutMoves(list: MoneyMove[]) {
  const scout = buildIncomeScoutBoard(10);
  for (const idea of scout.topMoves) {
    addMove(list, {
      panelId: idea.panelId,
      lane: ["Games", "Surveys", "Trading"].includes(idea.category) ? "Earn" : idea.category === "Savings" ? "Save" : idea.category === "Mining" ? "Protect" : "Build",
      kind: ["Games", "Surveys", "Trading"].includes(idea.category) ? "earn" : idea.category === "Savings" ? "save" : idea.category === "Mining" ? "protect" : "build",
      title: idea.title,
      body: idea.body,
      valueLabel: idea.valueLabel,
      score: idea.score,
      confidence: idea.confidence,
      level: idea.score >= 72 ? "good" : idea.score >= 55 ? "warn" : "good",
      actionId: idea.actionId,
      actionLabel: idea.actionLabel,
      amountUsd: idea.amountUsd,
      amountPeriod: idea.amountPeriod,
      tags: ["income-scout", ...idea.tags],
    });
  }
}

function buildMoves(list: MoneyMove[]) {
  const moneyOffers = loadJSON<any>("oddengine:money:offers:v1", null as any) || {};
  const sellables = loadJSON<any[]>("oddengine:money:sellables:v1", []) || [];
  const listedOrBuilding = sellables.filter((row: any) => ["Building", "Listed", "Selling"].includes(String(row?.status || "")));
  const bestSellable = listedOrBuilding.slice().sort((a: any, b: any) => parseDollarText(b?.price) - parseDollarText(a?.price))[0] || sellables[0];
  if (bestSellable) {
    const price = parseDollarText(bestSellable?.price);
    addMove(list, {
      panelId: "Money",
      lane: "Build",
      kind: "build",
      title: `Push the next sellable live: ${bestSellable.title}`,
      body: `Money already has a shippable asset in motion. Brain should keep routing attention toward the item closest to launch instead of spreading effort across too many ideas.`,
      valueLabel: price ? `${currency(price)} visible offer` : String(bestSellable?.status || "Building"),
      score: bestSellable?.status === "Listed" ? 87 : bestSellable?.status === "Selling" ? 83 : 79,
      confidence: 78,
      level: "good",
      actionId: "panel:money",
      actionLabel: "Open Money",
      amountUsd: price || undefined,
      amountPeriod: price ? "once" : undefined,
      tags: ["money", "sellable", "ship"],
    });
  } else {
    const offers = Array.isArray(moneyOffers.offers) ? moneyOffers.offers : [];
    addMove(list, {
      panelId: "Money",
      lane: "Build",
      kind: "build",
      title: offers.length ? "Rank the drafted offers by speed to cash" : "Draft the first fast-cash offer ladder",
      body: offers.length
        ? "Money has drafted offers, so the move now is to pick one buyer, one promise, and one fast ship path instead of building everything at once."
        : "There is no monetized offer on the board yet. Naming one small offer is the fastest way to turn the OS into something that can actually sell.",
      valueLabel: offers.length ? `${offers.length} drafted offers` : "Offer lane empty",
      score: offers.length ? 72 : 67,
      confidence: 70,
      level: offers.length ? "good" : "warn",
      actionId: "panel:money",
      actionLabel: "Open Money",
      tags: ["money", "offers", "build"],
    });
  }

  const saas = loadJSON<any>("oddengine:optionssaas:v1", null as any) || {};
  const filled = [saas?.productName, saas?.targetUser, saas?.promise, saas?.pricing?.entry].filter((v: any) => String(v || "").trim()).length;
  if (filled >= 3) {
    const entryPrice = parseDollarText(saas?.pricing?.entry || saas?.pricing?.pro || saas?.pricing?.lifetime);
    addMove(list, {
      panelId: "OptionsSaaS",
      lane: "Build",
      kind: "build",
      title: "Turn the Options SaaS brief into a real launch asset",
      body: `The buyer, promise, and starter pricing are seeded. That is enough signal for Brain to push toward a listing page, waitlist, or MVP route map instead of more ideation.`,
      valueLabel: entryPrice ? `${currency(entryPrice)} entry point seeded` : `${filled}/4 MVP blocks`,
      score: 76,
      confidence: 73,
      level: "good",
      actionId: "panel:saas",
      actionLabel: "Open Options SaaS",
      amountUsd: entryPrice || undefined,
      amountPeriod: entryPrice ? "once" : undefined,
      tags: ["saas", "build", "launch"],
    });
  }

  tradingMove(list);
  familyBudgetMoves(list);
  groceryMove(list);
  cryptoGamesMove(list);
  miningMove(list);
  incomeScoutMoves(list);
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function applyMoneyLearning(move: MoneyMove): MoneyMove {
  const learning = getMoneyLearningBoost(move);
  return {
    ...move,
    score: clamp(move.score + learning.scoreDelta, 0, 99),
    confidence: clamp(move.confidence + learning.confidenceDelta, 0, 99),
    learning,
  };
}

export function buildMoneyVacuumScan(limit = 8): MoneyVacuumScan {
  const baseMoves: MoneyMove[] = [];
  buildMoves(baseMoves);
  const recoverySnapshot = buildRecoverySnapshot();
  const allMoves = baseMoves.map(applyMoneyLearning).map((move) => applyRecoveryToMoneyMove(move, recoverySnapshot));
  const sorted = allMoves
    .slice()
    .sort((a, b) => (b.score * 100 + b.confidence) - (a.score * 100 + a.confidence))
    .slice(0, Math.max(1, limit));
  const summary = {
    totalMoves: sorted.length,
    earnMoves: sorted.filter((row) => row.kind === "earn").length,
    saveMoves: sorted.filter((row) => row.kind === "save").length,
    buildMoves: sorted.filter((row) => row.kind === "build").length,
    protectMoves: sorted.filter((row) => row.kind === "protect").length,
    visibleMonthlyUsd: Number(sorted.filter((row) => row.amountUsd && row.amountPeriod === "month").reduce((sum, row) => sum + Number(row.amountUsd || 0), 0).toFixed(2)),
    visibleWeeklyUsd: Number(sorted.filter((row) => row.amountUsd && row.amountPeriod === "week").reduce((sum, row) => sum + Number(row.amountUsd || 0), 0).toFixed(2)),
    visibleOneShotUsd: Number(sorted.filter((row) => row.amountUsd && row.amountPeriod === "once").reduce((sum, row) => sum + Number(row.amountUsd || 0), 0).toFixed(2)),
  };
  const headlineParts = [
    summary.visibleMonthlyUsd ? `${currency(summary.visibleMonthlyUsd)}/mo visible` : "",
    summary.visibleWeeklyUsd ? `${currency(summary.visibleWeeklyUsd)}/wk visible` : "",
    summary.visibleOneShotUsd ? `${currency(summary.visibleOneShotUsd)} one-shot paths` : "",
  ].filter(Boolean);
  return {
    generatedAt: Date.now(),
    headline: headlineParts.length ? `Money vacuum scan: ${headlineParts.join(" • ")} • ${recoverySnapshot.mode} ${recoverySnapshot.timeAvailableMin}m window` : `Money vacuum scan: ${sorted.length} ranked moves ready • ${recoverySnapshot.mode} ${recoverySnapshot.timeAvailableMin}m window`,
    summary,
    topMoves: sorted,
    allMoves,
  };
}

export function buildMoneyVacuumDigest(limit = 6) {
  const scan = buildMoneyVacuumScan(limit);
  const lines = [
    `**Money Vacuum Scan**`,
    `Generated ${new Date(scan.generatedAt).toLocaleString()}`,
    "",
    `- Moves ranked: ${scan.summary.totalMoves}`,
    `- Earn / Save / Build / Protect: ${scan.summary.earnMoves} / ${scan.summary.saveMoves} / ${scan.summary.buildMoves} / ${scan.summary.protectMoves}`,
  ];
  if (scan.summary.visibleMonthlyUsd) lines.push(`- Visible monthly savings/opportunity: ${currency(scan.summary.visibleMonthlyUsd)}/mo`);
  if (scan.summary.visibleWeeklyUsd) lines.push(`- Visible weekly savings/opportunity: ${currency(scan.summary.visibleWeeklyUsd)}/wk`);
  if (scan.summary.visibleOneShotUsd) lines.push(`- Visible one-shot offer paths: ${currency(scan.summary.visibleOneShotUsd)}`);
  lines.push("", "**Top moves**");
  scan.topMoves.forEach((move, idx) => {
    lines.push(`- ${idx + 1}. ${move.title} — ${move.valueLabel}`);
    lines.push(`  ${move.body}`);
  });
  return lines.join("\n").trim();
}
