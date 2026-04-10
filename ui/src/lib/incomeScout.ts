import { loadJSON } from "./storage";
import { applyRecoveryToIncomeScoutMove, buildRecoverySnapshot, type RecoveryMoveMeta } from "./recoveryPlanner";

export type IncomeScoutCategory = "Games" | "Surveys" | "Writing" | "Apps" | "GPTs" | "Templates" | "Affiliate" | "Mining" | "Trading" | "Savings";

export type IncomeScoutMove = {
  id: string;
  category: IncomeScoutCategory;
  panelId: string;
  title: string;
  body: string;
  score: number;
  confidence: number;
  noUpfrontCost: boolean;
  legit: true;
  valueLabel: string;
  actionId?: string;
  actionLabel?: string;
  amountUsd?: number;
  amountPeriod?: "week" | "month" | "once";
  tags: string[];
  recovery?: RecoveryMoveMeta;
};

export type IncomeScoutBoard = {
  generatedAt: number;
  headline: string;
  summary: {
    totalMoves: number;
    noUpfrontMoves: number;
    visibleMonthlyUsd: number;
    visibleWeeklyUsd: number;
    visibleOneShotUsd: number;
    categories: IncomeScoutCategory[];
  };
  topMoves: IncomeScoutMove[];
  allMoves: IncomeScoutMove[];
};

function uid(prefix = "isc") {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36)}`;
}

function parseDollarText(text: any): number {
  const src = String(text || "");
  const nums = (src.match(/\$?\d+(?:\.\d+)?/g) || [])
    .map((part) => Number(String(part).replace(/[^0-9.\-]/g, "")))
    .filter((n) => Number.isFinite(n));
  if (!nums.length) return 0;
  return Math.max(...nums);
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function add(list: IncomeScoutMove[], move: Omit<IncomeScoutMove, "id" | "legit">) {
  list.push({ id: uid(move.category.toLowerCase()), legit: true, ...move });
}

function buildGameScout(list: IncomeScoutMove[]) {
  const state = loadJSON<any>("oddengine:cryptoGames:v4", null as any) || {};
  const games = Array.isArray(state.games) ? state.games.filter((row: any) => !row?.disabled) : [];
  const sessions = Array.isArray(state.sessions) ? state.sessions : [];
  const payouts = Array.isArray(state.payouts) ? state.payouts : [];
  if (!games.length) {
    add(list, {
      category: "Games",
      panelId: "CryptoGames",
      title: "Seed Game Time with legit earn-to-play tests",
      body: "Use short sessions to test only real payout paths and keep a simple journal. This is a low-energy lane that does not require spending money upfront.",
      score: 56,
      confidence: 64,
      noUpfrontCost: true,
      valueLabel: "No-upfront test lane",
      actionId: "panel:games",
      actionLabel: "Open Game Time",
      tags: ["games", "sats", "no-pay"],
    });
    return;
  }
  const recentPayoutSats = payouts.slice(0, 10).reduce((sum: number, row: any) => sum + Math.max(0, Number(row?.sats || 0)), 0);
  const recentSessions = sessions.slice(0, 10).length;
  add(list, {
    category: "Games",
    panelId: "CryptoGames",
    title: recentPayoutSats > 0 ? "Double down on the Game Time lane that is already paying" : "Run short payout-proving Game Time sessions",
    body: recentPayoutSats > 0
      ? "Game Time already has payout evidence, so the scout move is to keep only the highest-yield loops and cut the dead games quickly."
      : "Use the journal to test games in tiny sessions and keep only the ones that show real sats or payout proof.",
    score: recentPayoutSats > 0 ? 74 : 61,
    confidence: recentSessions > 0 ? 72 : 58,
    noUpfrontCost: true,
    valueLabel: recentPayoutSats > 0 ? `${recentPayoutSats.toLocaleString()} sats logged` : `${games.length} games staged`,
    actionId: "panel:games",
    actionLabel: "Open Game Time",
    tags: ["games", "journal", "legit"],
  });
}

function buildSurveyScout(list: IncomeScoutMove[]) {
  add(list, {
    category: "Surveys",
    panelId: "Money",
    title: "Use low-energy survey or user-testing windows as filler income",
    body: "Keep this lane for rough health days or short downtime. Brain should treat it as filler cash, not your main engine, and only keep legit no-upfront paths.",
    score: 43,
    confidence: 52,
    noUpfrontCost: true,
    valueLabel: "Filler cash lane",
    actionId: "panel:money",
    actionLabel: "Open Money",
    tags: ["surveys", "user-testing", "low-energy"],
  });
}

function buildWritingScout(list: IncomeScoutMove[]) {
  const sellables = loadJSON<any[]>("oddengine:money:sellables:v1", []) || [];
  const books = sellables.filter((row: any) => String(row?.kind || "") === "Book");
  const active = books.find((row: any) => ["Building", "Listed", "Selling"].includes(String(row?.status || ""))) || books[0];
  if (active) {
    const price = parseDollarText(active.price);
    add(list, {
      category: "Writing",
      panelId: "Money",
      title: `Ship the next short ebook: ${active.title}`,
      body: "The writing lane is already seeded, so the scout move is to finish a short practical ebook and get it listed instead of expanding scope.",
      score: 76,
      confidence: 73,
      noUpfrontCost: true,
      valueLabel: price ? `$${Math.round(price)} listing path` : String(active.status || "Book lane active"),
      actionId: "panel:money",
      actionLabel: "Open Money",
      amountUsd: price || undefined,
      amountPeriod: price ? "once" : undefined,
      tags: ["writing", "ebook", "kdp"],
    });
    return;
  }
  add(list, {
    category: "Writing",
    panelId: "Money",
    title: "Turn one FairlyOdd skill into a short no-fluff ebook",
    body: "Writing is one of the cleanest legitimate from-home lanes because it can reuse knowledge you already have from trading, budgeting, mining, or routine systems.",
    score: 62,
    confidence: 66,
    noUpfrontCost: true,
    valueLabel: "Low-cost digital asset",
    actionId: "panel:money",
    actionLabel: "Open Money",
    tags: ["writing", "ebook", "digital"],
  });
}

function buildAppScout(list: IncomeScoutMove[]) {
  const sellables = loadJSON<any[]>("oddengine:money:sellables:v1", []) || [];
  const app = sellables.find((row: any) => String(row?.kind || "") === "App") || null;
  const saas = loadJSON<any>("oddengine:optionssaas:v1", null as any) || {};
  const filled = [saas?.productName, saas?.targetUser, saas?.promise, saas?.pricing?.entry].filter((v: any) => String(v || "").trim()).length;
  const appPrice = parseDollarText(app?.price || saas?.pricing?.entry || saas?.pricing?.pro || saas?.pricing?.lifetime);
  add(list, {
    category: "Apps",
    panelId: app ? "Money" : "OptionsSaaS",
    title: app ? `Package the app offer that is closest to cash: ${app.title}` : "Turn one OS panel into a tiny paid app or utility",
    body: app
      ? "The app lane already exists, so the highest-ROI move is packaging, screenshots, and a listing page rather than more feature creep."
      : "A small useful desktop or dashboard utility can become a clean from-home income lane when it solves one real pain fast.",
    score: app ? 82 : clamp(58 + filled * 5, 58, 77),
    confidence: app ? 75 : clamp(52 + filled * 4, 52, 70),
    noUpfrontCost: true,
    valueLabel: appPrice ? `$${Math.round(appPrice)} offer seeded` : `${Math.max(filled, 1)}/4 app blocks ready`,
    actionId: app ? "panel:money" : "panel:saas",
    actionLabel: app ? "Open Money" : "Open Options SaaS",
    amountUsd: appPrice || undefined,
    amountPeriod: appPrice ? "once" : undefined,
    tags: ["apps", "desktop", "ship"],
  });
}

function buildGptScout(list: IncomeScoutMove[]) {
  const sellables = loadJSON<any[]>("oddengine:money:sellables:v1", []) || [];
  const gpt = sellables.find((row: any) => String(row?.kind || "") === "GPT") || null;
  const price = parseDollarText(gpt?.price);
  add(list, {
    category: "GPTs",
    panelId: "Money",
    title: gpt ? `List the GPT companion offer: ${gpt.title}` : "Package one FairlyOdd GPT-style coach or companion",
    body: gpt
      ? "The GPT lane is already on the board, so the scout move is to tighten onboarding, promise, and listing copy."
      : "A focused GPT helper can reuse the exact expertise already living inside FairlyOdd OS and turn it into a legit digital product.",
    score: gpt ? 79 : 64,
    confidence: gpt ? 72 : 60,
    noUpfrontCost: true,
    valueLabel: price ? `$${Math.round(price)} recurring idea` : "Digital no-inventory lane",
    actionId: "panel:money",
    actionLabel: "Open Money",
    amountUsd: price || undefined,
    amountPeriod: price ? "month" : undefined,
    tags: ["gpts", "digital", "coach"],
  });
}

function buildTemplateScout(list: IncomeScoutMove[]) {
  const sellables = loadJSON<any[]>("oddengine:money:sellables:v1", []) || [];
  const template = sellables.find((row: any) => String(row?.kind || "") === "Template") || null;
  const price = parseDollarText(template?.price);
  add(list, {
    category: "Templates",
    panelId: "Money",
    title: template ? `Ship the template pack: ${template.title}` : "Bundle one panel into a simple template or starter pack",
    body: "Templates are a clean legit lane because they turn work you already did into repeatable digital inventory with almost no extra energy once shipped.",
    score: template ? 77 : 63,
    confidence: template ? 70 : 61,
    noUpfrontCost: true,
    valueLabel: price ? `$${Math.round(price)} digital pack` : "Reusable digital inventory",
    actionId: "panel:money",
    actionLabel: "Open Money",
    amountUsd: price || undefined,
    amountPeriod: price ? "once" : undefined,
    tags: ["templates", "gumroad", "digital"],
  });
}

function buildAffiliateScout(list: IncomeScoutMove[]) {
  add(list, {
    category: "Affiliate",
    panelId: "Money",
    title: "Use review pages and useful resource lists as an affiliate lane",
    body: "Treat affiliate work like helpful publishing, not spam. The best path is honest niche pages that match tools you already use and understand.",
    score: 54,
    confidence: 57,
    noUpfrontCost: true,
    valueLabel: "Slow-burn content lane",
    actionId: "panel:money",
    actionLabel: "Open Money",
    tags: ["affiliate", "content", "legit"],
  });
}

function buildMiningScout(list: IncomeScoutMove[]) {
  const mining = loadJSON<any>("oddengine:mining:v1", null as any) || {};
  const miners = Array.isArray(mining.miners) ? mining.miners : [];
  const payouts = Array.isArray(mining.payouts) ? mining.payouts : [];
  if (!miners.length) return;
  add(list, {
    category: "Mining",
    panelId: "Mining",
    title: payouts.length ? "Keep the mining lane tuned while it is already active" : "Finish the mining payout log so the income lane is measurable",
    body: payouts.length
      ? "Mining is already one of the legitimate home-based income lanes in the OS, so the scout move is protecting uptime and comparing pools."
      : "Without payout logs, mining is work without a scoreboard. Logging the lane makes it much easier for Brain to keep only what pays.",
    score: payouts.length ? 68 : 57,
    confidence: payouts.length ? 69 : 63,
    noUpfrontCost: false,
    valueLabel: payouts.length ? `${payouts.length} payouts tracked` : `${miners.length} miners seeded`,
    actionId: "panel:mining",
    actionLabel: "Open Mining",
    tags: ["mining", "btc", "hardware"],
  });
}

function buildTradingScout(list: IncomeScoutMove[]) {
  const trading = loadJSON<any>("oddengine:trading:sniper:v4", {} as any) || {};
  const symbol = String(trading.symbol || "").trim().toUpperCase();
  add(list, {
    category: "Trading",
    panelId: "Trading",
    title: symbol ? `Only trade the best setup already on deck: ${symbol}` : "Use Trading only when a clean setup exists",
    body: "Trading can pay fast, but Brain should treat it like a selective high-focus lane, not an always-on income source. Protect capital first.",
    score: symbol ? 72 : 44,
    confidence: symbol ? 65 : 49,
    noUpfrontCost: false,
    valueLabel: symbol ? `${symbol} ready to score` : "Capital-sensitive lane",
    actionId: "panel:trading",
    actionLabel: "Open Trading",
    tags: ["trading", "selective", "risk"],
  });
}

function buildSavingsScout(list: IncomeScoutMove[]) {
  const budget = loadJSON<any>("oddengine:familyBudget:v2", null as any) || {};
  const recurring = Array.isArray(budget.recurring) ? budget.recurring : [];
  const subscriptions = recurring.filter((row: any) => String(row?.type || "").toLowerCase() === "subscription");
  const visible = subscriptions.reduce((sum: number, row: any) => sum + Math.max(0, Number(row?.amount || 0)), 0);
  add(list, {
    category: "Savings",
    panelId: "FamilyBudget",
    title: visible > 0 ? "Treat leak-cutting like earned money" : "Seed Budget so the OS can find save-money wins",
    body: visible > 0
      ? "Saving money counts too. Tightening recurring spend is one of the most reliable from-home money moves because every dollar kept is already yours."
      : "Budget data unlocks the save-money side of your income plan by finding leaks, interest drag, and category creep.",
    score: visible > 0 ? 78 : 52,
    confidence: visible > 0 ? 74 : 61,
    noUpfrontCost: true,
    valueLabel: visible > 0 ? `$${Math.round(visible)}/mo visible drag` : "Savings lane blocked",
    actionId: "panel:budget",
    actionLabel: "Open Budget",
    amountUsd: visible || undefined,
    amountPeriod: visible ? "month" : undefined,
    tags: ["budget", "save", "subscriptions"],
  });
}

export function buildIncomeScoutBoard(limit = 8): IncomeScoutBoard {
  const moves: IncomeScoutMove[] = [];
  buildGameScout(moves);
  buildSurveyScout(moves);
  buildWritingScout(moves);
  buildAppScout(moves);
  buildGptScout(moves);
  buildTemplateScout(moves);
  buildAffiliateScout(moves);
  buildMiningScout(moves);
  buildTradingScout(moves);
  buildSavingsScout(moves);

  const recoverySnapshot = buildRecoverySnapshot();
  const adjusted = moves.map((move) => applyRecoveryToIncomeScoutMove(move, recoverySnapshot));
  const sorted = adjusted.slice().sort((a, b) => (b.score * 100 + b.confidence) - (a.score * 100 + a.confidence)).slice(0, Math.max(1, limit));
  const noUpfrontMoves = sorted.filter((row) => row.noUpfrontCost).length;
  const visibleMonthlyUsd = Number(sorted.filter((row) => row.amountUsd && row.amountPeriod === "month").reduce((sum, row) => sum + Number(row.amountUsd || 0), 0).toFixed(2));
  const visibleWeeklyUsd = Number(sorted.filter((row) => row.amountUsd && row.amountPeriod === "week").reduce((sum, row) => sum + Number(row.amountUsd || 0), 0).toFixed(2));
  const visibleOneShotUsd = Number(sorted.filter((row) => row.amountUsd && row.amountPeriod === "once").reduce((sum, row) => sum + Number(row.amountUsd || 0), 0).toFixed(2));
  const categories = Array.from(new Set(sorted.map((row) => row.category))) as IncomeScoutCategory[];
  const headline = categories.length
    ? `Income Scout: ${noUpfrontMoves} no-upfront lane${noUpfrontMoves === 1 ? "" : "s"} • ${categories.join(" • ")}`
    : "Income Scout: ranking legit work-from-home lanes";
  return {
    generatedAt: Date.now(),
    headline: `${headline} • ${recoverySnapshot.mode} ${recoverySnapshot.timeAvailableMin}m`,
    summary: {
      totalMoves: sorted.length,
      noUpfrontMoves,
      visibleMonthlyUsd,
      visibleWeeklyUsd,
      visibleOneShotUsd,
      categories,
    },
    topMoves: sorted,
    allMoves: adjusted,
  };
}


export function buildIncomeScoutDigest(limit = 6) {
  const board = buildIncomeScoutBoard(limit);
  const lines = [
    `**Income Scout**`,
    `Generated ${new Date(board.generatedAt).toLocaleString()}`,
    ``,
    `- Ranked lanes: ${board.summary.totalMoves}`,
    `- No-upfront lanes: ${board.summary.noUpfrontMoves}`,
    `- Categories: ${board.summary.categories.join(" • ") || "Waiting for data"}`,
  ];
  if (board.summary.visibleMonthlyUsd) lines.push(`- Visible monthly lanes: $${Math.round(board.summary.visibleMonthlyUsd).toLocaleString()}/mo`);
  if (board.summary.visibleOneShotUsd) lines.push(`- Visible one-shot lanes: $${Math.round(board.summary.visibleOneShotUsd).toLocaleString()}`);
  lines.push(``, `**Top lanes**`);
  board.topMoves.forEach((move, idx) => {
    lines.push(`- ${idx + 1}. ${move.title} — ${move.valueLabel}`);
    lines.push(`  ${move.body}`);
  });
  return lines.join("\n").trim();
}
