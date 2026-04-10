import { buildActionQueue, buildInboxSummary, buildMissions, getPanelMeta, type ActionQueueItem } from "./brain";
import { buildHomieCoreSnapshot } from "./homieCore";
import { buildMoneyAutopilotQueue } from "./moneyAutopilot";
import { loadMoneyQueue, type MoneyQueueItem } from "./moneyQueue";
import { loadOutcomeRecords, summarizeOutcomes, type MoneyOutcomeRecord } from "./moneyOutcomeLoop";
import { fetchRevenue, probeAnalytics, type RevenueRecord } from "./publisherAnalyticsBridge";
import { listCreativeOutputs, listCreativeQueue, type CreativeQueueJob } from "./creativeQueueBridge";

export type UnifiedOperatorDomain = "money" | "studio" | "trading" | "homie" | "mission";
export type UnifiedOperatorView = "today" | "now" | "queued" | "blocked";

export type UnifiedOperatorItem = {
  id: string;
  title: string;
  body: string;
  domain: UnifiedOperatorDomain;
  panelId: string;
  score: number;
  state: "ready" | "active" | "queued" | "blocked" | "done";
  kicker?: string;
  amountLabel?: string;
  actionLabel?: string;
  source?: string;
};

export type UnifiedOperatorDomainCard = {
  domain: UnifiedOperatorDomain;
  title: string;
  panelId: string;
  status: string;
  score: number;
  note: string;
  countLabel: string;
};

export type UnifiedOperatorSnapshot = {
  generatedAt: number;
  headline: string;
  nowLine: string;
  bestNextMove: UnifiedOperatorItem | null;
  views: Record<UnifiedOperatorView, UnifiedOperatorItem[]>;
  domainCards: UnifiedOperatorDomainCard[];
  homieHeadline: string;
  homieBrief: string;
  stats: {
    missions: number;
    queued: number;
    blocked: number;
    earnedUsd: number;
    completedOutputs: number;
  };
  backend: {
    analyticsStatus: string;
    creativeStatus: string;
  };
};

function moneyLabel(amount?: number | null) {
  if (amount == null || Number.isNaN(Number(amount))) return "";
  return `$${Number(amount).toFixed(2)}`;
}

function cap(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function domainLabel(domain: UnifiedOperatorDomain) {
  return domain === "money"
    ? "Money"
    : domain === "studio"
    ? "Studio"
    : domain === "trading"
    ? "Trading"
    : domain === "homie"
    ? "Homie"
    : "Mission Control";
}

function pushUnique(target: UnifiedOperatorItem[], item: UnifiedOperatorItem) {
  if (target.some((entry) => entry.id === item.id)) return;
  target.push(item);
}

function scoreSort(a: UnifiedOperatorItem, b: UnifiedOperatorItem) {
  if (b.score !== a.score) return b.score - a.score;
  return a.title.localeCompare(b.title);
}

function queueItemToOperatorItem(item: MoneyQueueItem): UnifiedOperatorItem {
  const state = item.status === "executing"
    ? "active"
    : item.status === "queued"
    ? "queued"
    : item.status === "completed"
    ? "done"
    : item.status === "skipped"
    ? "blocked"
    : "blocked";
  return {
    id: `money-queue-${item.id}`,
    title: item.title,
    body: item.reason,
    domain: "money",
    panelId: "Money",
    score: Math.max(1, Number(item.score || 0)),
    state,
    kicker: `Money Queue • ${cap(item.actionType)}`,
    source: "moneyQueue",
    actionLabel: state === "active" ? "Open Money" : "Run in Money",
  };
}

function actionQueueItemToOperatorItem(item: ActionQueueItem): UnifiedOperatorItem {
  const domain: UnifiedOperatorDomain = item.panelId === "Trading"
    ? "trading"
    : item.panelId === "Homie"
    ? "homie"
    : "mission";
  return {
    id: `action-${item.id}`,
    title: item.title,
    body: item.body,
    domain,
    panelId: item.panelId,
    score: Number(item.score || 0),
    state: "queued",
    kicker: `${getPanelMeta(item.panelId).title} • action queue`,
    actionLabel: item.actionLabel || `Open ${getPanelMeta(item.panelId).title}`,
    source: "actionQueue",
  };
}

function missionToOperatorItem(mission: { id: string; panelId: string; level: "good" | "warn" | "error"; text: string }): UnifiedOperatorItem {
  const score = mission.level === "error" ? 90 : mission.level === "warn" ? 76 : 62;
  return {
    id: `mission-${mission.id}`,
    title: `${getPanelMeta(mission.panelId).title} mission`,
    body: mission.text,
    domain: mission.panelId === "Trading" ? "trading" : mission.panelId === "Money" ? "money" : "mission",
    panelId: mission.panelId,
    score,
    state: mission.level === "error" ? "blocked" : "queued",
    kicker: `Mission Control • ${mission.level}`,
    actionLabel: `Open ${getPanelMeta(mission.panelId).title}`,
    source: "missions",
  };
}

function outcomeToOperatorItem(record: MoneyOutcomeRecord): UnifiedOperatorItem {
  const positive = record.outcomeType === "earned" || record.outcomeType === "saved";
  return {
    id: `outcome-${record.id}`,
    title: record.title,
    body: record.notes || (positive ? "Outcome captured." : "Review this result before repeating the move."),
    domain: "money",
    panelId: "Money",
    score: positive ? 74 : 42,
    state: positive ? "done" : "blocked",
    kicker: `Outcome • ${cap(record.outcomeType)}`,
    amountLabel: moneyLabel(record.amount),
    actionLabel: "Review outcome",
    source: "outcomes",
  };
}

function buildDomainCards(input: {
  moneyQueueCount: number;
  moneyNextTitle: string;
  studioQueued: number;
  outputsCount: number;
  tradingUrgent: number;
  homieHeadline: string;
  missionQueued: number;
  missionBlocked: number;
}): UnifiedOperatorDomainCard[] {
  return [
    {
      domain: "money",
      title: "Money",
      panelId: "Money",
      status: input.moneyQueueCount ? `Autopilot live • ${input.moneyQueueCount} moves` : "Needs a fresh run",
      score: input.moneyQueueCount ? 88 : 55,
      note: input.moneyNextTitle || "Run Money Autopilot so God Mode can route the next real dollar move.",
      countLabel: `${input.moneyQueueCount} queued`,
    },
    {
      domain: "studio",
      title: "Studio",
      panelId: "Books",
      status: input.studioQueued ? `Creative queue live • ${input.studioQueued}` : "No live queue detected",
      score: input.outputsCount ? 82 : 64,
      note: input.outputsCount ? `${input.outputsCount} finished output${input.outputsCount === 1 ? "" : "s"} available to preview/publish.` : "No completed output detected yet. Start or bridge a creative job.",
      countLabel: `${input.outputsCount} outputs`,
    },
    {
      domain: "trading",
      title: "Trading",
      panelId: "Trading",
      status: input.tradingUrgent ? `Watch lane hot • ${input.tradingUrgent} mission${input.tradingUrgent === 1 ? "" : "s"}` : "No urgent trading blockers",
      score: input.tradingUrgent ? 84 : 60,
      note: input.tradingUrgent ? "Mission Control sees trading setup work still needed before execution." : "Trading is clear enough for watchlist, chart, and thesis work.",
      countLabel: `${input.tradingUrgent} urgent`,
    },
    {
      domain: "homie",
      title: "Homie",
      panelId: "Homie",
      status: "Operator layer online",
      score: 80,
      note: input.homieHeadline,
      countLabel: "voice + operator",
    },
    {
      domain: "mission",
      title: "Mission Control",
      panelId: "Brain",
      status: input.missionBlocked ? `${input.missionBlocked} blocked lane${input.missionBlocked === 1 ? "" : "s"}` : "Mission queue is moving",
      score: input.missionBlocked ? 78 : 70,
      note: input.missionQueued ? `${input.missionQueued} action${input.missionQueued === 1 ? "" : "s"} queued across the OS.` : "No queued cross-panel actions yet.",
      countLabel: `${input.missionQueued} queued`,
    },
  ];
}

export async function buildUnifiedOperatorSnapshot(activePanelId: string): Promise<UnifiedOperatorSnapshot> {
  const generatedAt = Date.now();
  const homie = buildHomieCoreSnapshot(activePanelId);
  const autopilot = buildMoneyAutopilotQueue(8);
  const manualMoneyQueue = loadMoneyQueue();
  const outcomeRecords = loadOutcomeRecords();
  const outcomeSummary = summarizeOutcomes(outcomeRecords);
  const missions = buildMissions();
  const inbox = buildInboxSummary();
  const actionQueue = buildActionQueue(8);

  let revenue: RevenueRecord[] = [];
  let analyticsStatus = "offline";
  try {
    revenue = await fetchRevenue();
    analyticsStatus = `${revenue.length} revenue row${revenue.length === 1 ? "" : "s"}`;
  } catch {
    try {
      const probe = await probeAnalytics();
      analyticsStatus = probe?.status ? String(probe.status) : "offline";
    } catch {
      analyticsStatus = "offline";
    }
  }

  let creativeQueue: CreativeQueueJob[] = [];
  let creativeOutputs: any[] = [];
  let creativeStatus = "offline";
  try {
    const [queue, outputs] = await Promise.all([listCreativeQueue(), listCreativeOutputs()]);
    creativeQueue = queue;
    creativeOutputs = outputs;
    creativeStatus = `${queue.length} queued • ${outputs.length} outputs`;
  } catch {
    creativeStatus = "offline";
  }

  const views: Record<UnifiedOperatorView, UnifiedOperatorItem[]> = {
    today: [],
    now: [],
    queued: [],
    blocked: [],
  };

  if (autopilot.nextMove) {
    pushUnique(views.today, {
      id: `autopilot-${autopilot.nextMove.moveKey}`,
      title: autopilot.nextMove.title,
      body: autopilot.nextMove.body,
      domain: "money",
      panelId: autopilot.nextMove.panelId || "Money",
      score: Math.round(Number(autopilot.nextMove.score || 0) * 100 + Number(autopilot.nextMove.confidence || 0)),
      state: "ready",
      kicker: `Best next move • ${autopilot.nextMove.lane || "Money Autopilot"}`,
      amountLabel: autopilot.nextMove.valueLabel,
      actionLabel: autopilot.nextMove.actionLabel || `Open ${getPanelMeta(autopilot.nextMove.panelId || "Money").title}`,
      source: "moneyAutopilot",
    });
  }

  manualMoneyQueue.forEach((item) => {
    const next = queueItemToOperatorItem(item);
    if (next.state === "active") pushUnique(views.now, next);
    if (next.state === "blocked") pushUnique(views.blocked, next);
    if (next.state === "queued") pushUnique(views.queued, next);
    if (next.state === "done") pushUnique(views.today, next);
  });

  actionQueue.forEach((item) => {
    const next = actionQueueItemToOperatorItem(item);
    pushUnique(views.queued, next);
    if (next.panelId === "Trading") pushUnique(views.now, { ...next, state: "active", score: next.score + 4 });
  });

  missions.forEach((mission) => {
    const next = missionToOperatorItem(mission);
    if (next.state === "blocked") pushUnique(views.blocked, next);
    else pushUnique(views.today, next);
  });

  outcomeRecords.slice(0, 6).forEach((record) => {
    const next = outcomeToOperatorItem(record);
    if (next.state === "blocked") pushUnique(views.blocked, next);
    else pushUnique(views.today, next);
  });

  creativeQueue.slice(0, 6).forEach((job, index) => {
    const status = String(job.status || "queued").toLowerCase();
    const state: UnifiedOperatorItem["state"] = status === "complete" ? "done" : status === "rendering" || status === "processing" ? "active" : "queued";
    const item: UnifiedOperatorItem = {
      id: `creative-queue-${job.id || index}`,
      title: job.title || job.id || "Creative queue item",
      body: `${job.type || "artifact"} • ${job.status || "queued"}`,
      domain: "studio",
      panelId: "Books",
      score: state === "active" ? 86 : 72,
      state,
      kicker: "Studio queue",
      actionLabel: state === "done" ? "Preview output" : "Open Studio",
      source: "creativeQueue",
    };
    if (state === "active") pushUnique(views.now, item);
    else if (state === "done") pushUnique(views.today, item);
    else pushUnique(views.queued, item);
  });

  creativeOutputs.slice(0, 4).forEach((out, index) => {
    pushUnique(views.today, {
      id: `creative-output-${out.id || out.path || index}`,
      title: out.title || out.name || out.id || "Completed output",
      body: out.path || out.outputPath || "Ready for preview or publishing",
      domain: "studio",
      panelId: "Books",
      score: 78,
      state: "done",
      kicker: "Completed output",
      actionLabel: "Open Studio",
      source: "creativeOutputs",
    });
  });

  if (!creativeQueue.length && !creativeOutputs.length) {
    pushUnique(views.blocked, {
      id: "creative-backend-blocked",
      title: "Studio backend not feeding the operator dashboard yet",
      body: "No live creative queue or outputs were detected. Bridge a job or start one from Studio Pipeline.",
      domain: "studio",
      panelId: "Books",
      score: 71,
      state: "blocked",
      kicker: "Studio",
      actionLabel: "Open Studio",
      source: "creativeStatus",
    });
  }

  if (!revenue.length) {
    pushUnique(views.blocked, {
      id: "analytics-blocked",
      title: "Revenue analytics are not feeding Money Autopilot yet",
      body: "Connect the analytics endpoint or ship revenue rows so the operator can rank scale/fix/stop decisions with real numbers.",
      domain: "money",
      panelId: "Money",
      score: 69,
      state: "blocked",
      kicker: "Money",
      actionLabel: "Open Money",
      source: "analytics",
    });
  }

  if (!manualMoneyQueue.length) {
    pushUnique(views.blocked, {
      id: "money-queue-empty",
      title: "Money Queue has not been generated from the newer operator lane yet",
      body: "Run or seed the Money Queue so God Mode can move from just ranking to actually working the queue.",
      domain: "money",
      panelId: "Money",
      score: 66,
      state: "blocked",
      kicker: "Money Queue",
      actionLabel: "Open Money",
      source: "moneyQueue",
    });
  }

  const operatorMission = inbox.operatorFeed[0];
  if (operatorMission) {
    pushUnique(views.now, {
      id: `operator-feed-${operatorMission.id}`,
      title: operatorMission.title,
      body: operatorMission.body,
      domain: operatorMission.panelId === "Trading" ? "trading" : operatorMission.panelId === "Homie" ? "homie" : "mission",
      panelId: operatorMission.panelId,
      score: 80,
      state: operatorMission.level === "error" ? "blocked" : "active",
      kicker: `${getPanelMeta(operatorMission.panelId).title} • operator feed`,
      actionLabel: `Open ${getPanelMeta(operatorMission.panelId).title}`,
      source: "operatorFeed",
    });
  }

  (Object.keys(views) as UnifiedOperatorView[]).forEach((key) => {
    views[key] = views[key].sort(scoreSort).slice(0, key === "blocked" ? 8 : 10);
  });

  const bestNextMove = [
    ...views.now.filter((item) => item.state !== "blocked"),
    ...views.today.filter((item) => item.state === "ready" || item.state === "active" || item.state === "queued"),
    ...views.queued,
  ].sort(scoreSort)[0] || null;

  const headline = bestNextMove
    ? `Best next OS move: ${bestNextMove.title}`
    : homie.operatorHeadline;
  const nowLine = bestNextMove
    ? `${domainLabel(bestNextMove.domain)} leads right now • ${bestNextMove.body}`
    : homie.briefing;

  return {
    generatedAt,
    headline,
    nowLine,
    bestNextMove,
    views,
    domainCards: buildDomainCards({
      moneyQueueCount: manualMoneyQueue.filter((item) => item.status === "queued" || item.status === "executing").length,
      moneyNextTitle: autopilot.nextMove?.title || "",
      studioQueued: creativeQueue.length,
      outputsCount: creativeOutputs.length,
      tradingUrgent: missions.filter((mission) => mission.panelId === "Trading").length,
      homieHeadline: homie.operatorHeadline,
      missionQueued: actionQueue.length,
      missionBlocked: views.blocked.filter((item) => item.domain === "mission" || item.domain === "trading").length,
    }),
    homieHeadline: homie.operatorHeadline,
    homieBrief: homie.briefing,
    stats: {
      missions: missions.length,
      queued: views.queued.length,
      blocked: views.blocked.length,
      earnedUsd: Number(outcomeSummary.money || 0),
      completedOutputs: creativeOutputs.length,
    },
    backend: {
      analyticsStatus,
      creativeStatus,
    },
  };
}
