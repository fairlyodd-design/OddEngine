import { buildActionQueue, buildMissions, getPanelMeta, type ActionQueueItem } from "./brain";
import { buildHomieCoreSnapshot } from "./homieCore";
import { buildMoneyAutopilotQueue } from "./moneyAutopilot";
import { loadMoneyQueue, type MoneyQueueItem } from "./moneyQueue";
import { loadOutcomeRecords, summarizeOutcomes } from "./moneyOutcomeLoop";
import { listCreativeOutputs, listCreativeQueue, type CreativeQueueJob } from "./creativeQueueBridge";
import type { GodModeSectionId } from "./godModeWorkspace";

export type OperatorMode = "manual" | "assisted" | "autopilot";
export type DecisionDomain = "money" | "studio" | "trading" | "homie" | "mission";
export type DecisionView = "now" | "today" | "queued" | "blocked" | "quickCash" | "autoRunning";
export type DecisionActionType = "open-panel" | "open-section" | "load-preset" | "mark-queue-executing" | "review-output" | "route-homie";

export type DecisionAction = {
  type: DecisionActionType;
  panelId?: string;
  sectionId?: GodModeSectionId;
  presetName?: string;
  queueItemId?: string;
  prompt?: string;
  outputPath?: string;
  lowRisk?: boolean;
};

export type DecisionCandidate = {
  id: string;
  title: string;
  body: string;
  domain: DecisionDomain;
  panelId: string;
  view: DecisionView;
  kicker: string;
  amountLabel?: string;
  score: number;
  state: "ready" | "active" | "queued" | "blocked" | "done";
  profitPotential: number;
  speedToCash: number;
  effortRequired: number;
  successProbability: number;
  etaMin: number;
  blockedReason?: string;
  action: DecisionAction;
};

export type DecisionSnapshot = {
  generatedAt: number;
  mode: OperatorMode;
  headline: string;
  explanation: string;
  bestNow: DecisionCandidate | null;
  bestToday: DecisionCandidate | null;
  fallback: DecisionCandidate | null;
  passive: DecisionCandidate | null;
  views: Record<DecisionView, DecisionCandidate[]>;
  operatorLine: string;
  stats: {
    earnedUsd: number;
    queued: number;
    blocked: number;
    active: number;
    quickCash: number;
  };
};

const MODE_KEY = "fairlyodd.godmode.operatorMode.v10.26.18b";

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number.isFinite(n) ? n : 0));
}

function moneyLabel(amount?: number | null) {
  if (amount == null || Number.isNaN(Number(amount))) return "";
  return `$${Number(amount).toFixed(2)}`;
}

function sortByScore(a: DecisionCandidate, b: DecisionCandidate) {
  if (b.score !== a.score) return b.score - a.score;
  return a.title.localeCompare(b.title);
}

function scoreCandidate(input: Pick<DecisionCandidate, "profitPotential" | "speedToCash" | "effortRequired" | "successProbability">) {
  return Math.round(
    clamp(input.profitPotential) * 0.4 +
    clamp(input.speedToCash) * 0.25 +
    clamp(100 - input.effortRequired) * 0.2 +
    clamp(input.successProbability) * 0.15,
  );
}

export function loadOperatorMode(): OperatorMode {
  try {
    const raw = window.localStorage.getItem(MODE_KEY);
    return raw === "autopilot" || raw === "assisted" || raw === "manual" ? raw : "assisted";
  } catch {
    return "assisted";
  }
}

export function saveOperatorMode(mode: OperatorMode) {
  try {
    window.localStorage.setItem(MODE_KEY, mode);
  } catch {}
}

function moneyQueueCandidate(item: MoneyQueueItem): DecisionCandidate {
  const active = item.status === "executing";
  const blocked = item.status === "skipped" || item.status === "snoozed";
  const done = item.status === "completed";
  const state: DecisionCandidate["state"] = active ? "active" : blocked ? "blocked" : done ? "done" : "queued";
  const view: DecisionView = active ? "autoRunning" : blocked ? "blocked" : done ? "today" : "queued";
  const profitPotential = clamp(item.score + (item.actionType === "scale" ? 14 : item.actionType === "test" ? 4 : 0));
  const speedToCash = item.actionType === "scale" ? 78 : item.actionType === "fix" ? 60 : item.actionType === "stop" ? 55 : 68;
  const effortRequired = item.actionType === "fix" ? 52 : item.actionType === "scale" ? 36 : item.actionType === "stop" ? 24 : 42;
  const successProbability = item.actionType === "scale" ? 74 : item.actionType === "fix" ? 66 : item.actionType === "stop" ? 80 : 58;
  return {
    id: `queue-${item.id}`,
    title: item.title,
    body: item.reason,
    domain: "money",
    panelId: "Money",
    view,
    kicker: `Money Queue • ${item.actionType}`,
    amountLabel: undefined,
    score: scoreCandidate({ profitPotential, speedToCash, effortRequired, successProbability }),
    state,
    profitPotential,
    speedToCash,
    effortRequired,
    successProbability,
    etaMin: item.actionType === "stop" ? 5 : item.actionType === "scale" ? 12 : 18,
    blockedReason: blocked ? "Queue item is not ready to run." : undefined,
    action: { type: active ? "open-panel" : "mark-queue-executing", panelId: "Money", queueItemId: item.id, lowRisk: item.actionType === "stop" || item.actionType === "test" },
  };
}

function actionQueueCandidate(item: ActionQueueItem): DecisionCandidate {
  const domain: DecisionDomain = item.panelId === "Trading" ? "trading" : item.panelId === "Homie" ? "homie" : "mission";
  const profitPotential = domain === "trading" ? 84 : domain === "mission" ? 50 : 42;
  const speedToCash = domain === "trading" ? 64 : 38;
  const effortRequired = domain === "trading" ? 44 : 30;
  const successProbability = item.level === "error" ? 48 : item.level === "warn" ? 65 : 76;
  return {
    id: `action-${item.id}`,
    title: item.title,
    body: item.body,
    domain,
    panelId: item.panelId,
    view: item.level === "error" ? "blocked" : domain === "trading" ? "now" : "queued",
    kicker: `${getPanelMeta(item.panelId).title} • action queue`,
    score: scoreCandidate({ profitPotential, speedToCash, effortRequired, successProbability }),
    state: item.level === "error" ? "blocked" : domain === "trading" ? "active" : "queued",
    profitPotential,
    speedToCash,
    effortRequired,
    successProbability,
    etaMin: domain === "trading" ? 8 : 12,
    blockedReason: item.level === "error" ? item.body : undefined,
    action: { type: "open-panel", panelId: item.panelId, lowRisk: true },
  };
}

function missionCandidate(mission: { id: string; panelId: string; level: "good" | "warn" | "error"; text: string }): DecisionCandidate {
  const isBlocked = mission.level === "error";
  const domain: DecisionDomain = mission.panelId === "Trading" ? "trading" : mission.panelId === "Money" ? "money" : "mission";
  const profitPotential = domain === "money" ? 70 : domain === "trading" ? 72 : 44;
  const speedToCash = domain === "money" ? 68 : domain === "trading" ? 58 : 30;
  const effortRequired = mission.level === "error" ? 52 : mission.level === "warn" ? 42 : 28;
  const successProbability = mission.level === "good" ? 78 : mission.level === "warn" ? 62 : 40;
  return {
    id: `mission-${mission.id}`,
    title: `${getPanelMeta(mission.panelId).title} mission`,
    body: mission.text,
    domain,
    panelId: mission.panelId,
    view: isBlocked ? "blocked" : "today",
    kicker: `Mission Control • ${mission.level}`,
    score: scoreCandidate({ profitPotential, speedToCash, effortRequired, successProbability }),
    state: isBlocked ? "blocked" : "ready",
    profitPotential,
    speedToCash,
    effortRequired,
    successProbability,
    etaMin: isBlocked ? 20 : 15,
    blockedReason: isBlocked ? mission.text : undefined,
    action: { type: "open-panel", panelId: mission.panelId, lowRisk: true },
  };
}

function creativeQueueCandidate(job: CreativeQueueJob, idx: number): DecisionCandidate {
  const status = String(job.status || "queued").toLowerCase();
  const state: DecisionCandidate["state"] = status === "complete" ? "done" : status === "rendering" || status === "processing" ? "active" : "queued";
  const view: DecisionView = state === "done" ? "today" : state === "active" ? "autoRunning" : "queued";
  const profitPotential = state === "done" ? 80 : 68;
  const speedToCash = state === "done" ? 84 : status.includes("render") ? 58 : 50;
  const effortRequired = state === "done" ? 22 : 30;
  const successProbability = state === "done" ? 82 : 66;
  return {
    id: `creative-${job.id || idx}`,
    title: job.title || job.id || "Creative job",
    body: `${job.type || "artifact"} • ${job.status || "queued"}`,
    domain: "studio",
    panelId: "Books",
    view,
    kicker: "Studio queue",
    score: scoreCandidate({ profitPotential, speedToCash, effortRequired, successProbability }),
    state,
    profitPotential,
    speedToCash,
    effortRequired,
    successProbability,
    etaMin: state === "done" ? 4 : 25,
    action: { type: state === "done" ? "review-output" : "open-panel", panelId: "Books", lowRisk: true },
  };
}

function creativeOutputCandidate(out: any, idx: number): DecisionCandidate {
  const profitPotential = 82;
  const speedToCash = 86;
  const effortRequired = 24;
  const successProbability = 76;
  return {
    id: `output-${out.id || out.path || idx}`,
    title: out.title || out.name || out.id || "Completed output",
    body: out.path || out.outputPath || "Ready to preview or publish",
    domain: "studio",
    panelId: "Books",
    view: "today",
    kicker: "Completed output",
    score: scoreCandidate({ profitPotential, speedToCash, effortRequired, successProbability }),
    state: "done",
    profitPotential,
    speedToCash,
    effortRequired,
    successProbability,
    etaMin: 6,
    action: { type: "review-output", panelId: "Books", outputPath: out.path || out.outputPath, lowRisk: true },
  };
}

function autopilotBestMoveCandidate(move: any): DecisionCandidate | null {
  if (!move) return null;
  const profitPotential = clamp(Number(move.score || 0) * 100 + 8);
  const speedToCash = clamp((move.lane || "").toLowerCase().includes("quick") ? 88 : 72);
  const effortRequired = clamp(move.energy === "low" ? 18 : move.energy === "high" ? 56 : 34);
  const successProbability = clamp((Number(move.confidence || 0) * 100) || 66);
  const etaMin = move.energy === "low" ? 7 : 18;
  const quick = etaMin <= 10;
  return {
    id: `autopilot-${move.moveKey || move.id || move.title}`,
    title: move.title || "Money autopilot move",
    body: move.body || move.fitReason || "Run the next ranked money move.",
    domain: "money",
    panelId: move.panelId || "Money",
    view: quick ? "quickCash" : "now",
    kicker: `Best next move • ${move.lane || "Money Autopilot"}`,
    amountLabel: move.valueLabel,
    score: scoreCandidate({ profitPotential, speedToCash, effortRequired, successProbability }),
    state: "ready",
    profitPotential,
    speedToCash,
    effortRequired,
    successProbability,
    etaMin,
    action: { type: "open-panel", panelId: move.panelId || "Money", lowRisk: quick },
  };
}

function passiveCandidate(outcomeMoney: number): DecisionCandidate {
  const profitPotential = outcomeMoney > 0 ? 64 : 38;
  const speedToCash = 28;
  const effortRequired = 10;
  const successProbability = 74;
  return {
    id: "passive-review",
    title: outcomeMoney > 0 ? "Scale what already made money" : "Seed one low-risk queue item",
    body: outcomeMoney > 0
      ? `You already captured ${moneyLabel(outcomeMoney)}. Review the winning lane before you scatter energy.`
      : "No captured money yet. Seed one tiny money or studio action so the operator can start learning your real wins.",
    domain: "mission",
    panelId: "Brain",
    view: "today",
    kicker: "Passive operator lane",
    amountLabel: outcomeMoney > 0 ? moneyLabel(outcomeMoney) : undefined,
    score: scoreCandidate({ profitPotential, speedToCash, effortRequired, successProbability }),
    state: "ready",
    profitPotential,
    speedToCash,
    effortRequired,
    successProbability,
    etaMin: 5,
    action: { type: "load-preset", presetName: "Operator Dashboard", lowRisk: true },
  };
}

export async function buildGodModeDecisionSnapshot(activePanelId: string): Promise<DecisionSnapshot> {
  const mode = loadOperatorMode();
  const generatedAt = Date.now();
  const homie = buildHomieCoreSnapshot(activePanelId || "Brain");
  const autopilot = buildMoneyAutopilotQueue(10);
  const moneyQueue = loadMoneyQueue();
  const outcomes = loadOutcomeRecords();
  const outcomeSummary = summarizeOutcomes(outcomes);
  const missions = buildMissions();
  const actionQueue = buildActionQueue(12);

  let creativeQueue: CreativeQueueJob[] = [];
  let creativeOutputs: any[] = [];
  try {
    [creativeQueue, creativeOutputs] = await Promise.all([listCreativeQueue(), listCreativeOutputs()]);
  } catch {
    creativeQueue = [];
    creativeOutputs = [];
  }

  const candidates: DecisionCandidate[] = [];
  const nextMove = autopilotBestMoveCandidate(autopilot.nextMove);
  if (nextMove) candidates.push(nextMove);
  moneyQueue.forEach((item) => candidates.push(moneyQueueCandidate(item)));
  actionQueue.forEach((item) => candidates.push(actionQueueCandidate(item)));
  missions.forEach((mission) => candidates.push(missionCandidate(mission)));
  creativeQueue.slice(0, 8).forEach((job, idx) => candidates.push(creativeQueueCandidate(job, idx)));
  creativeOutputs.slice(0, 4).forEach((out, idx) => candidates.push(creativeOutputCandidate(out, idx)));
  candidates.push(passiveCandidate(Number(outcomeSummary.money || 0)));

  const views: Record<DecisionView, DecisionCandidate[]> = {
    now: [], today: [], queued: [], blocked: [], quickCash: [], autoRunning: [],
  };
  candidates.forEach((candidate) => {
    views[candidate.view].push(candidate);
    if (candidate.etaMin <= 10 && candidate.state !== "blocked" && candidate.state !== "done") views.quickCash.push(candidate);
    if (candidate.state === "active") views.autoRunning.push(candidate);
  });
  (Object.keys(views) as DecisionView[]).forEach((key) => {
    const seen = new Set<string>();
    views[key] = views[key].filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    }).sort(sortByScore).slice(0, key === "blocked" ? 8 : 10);
  });

  const bestNow = [...views.quickCash, ...views.now, ...views.today].filter((item) => item.state !== "blocked" && item.state !== "done").sort(sortByScore)[0] || null;
  const bestToday = [...views.today, ...views.queued, ...views.quickCash].filter((item) => item.state !== "blocked").sort(sortByScore)[0] || null;
  const fallback = views.blocked[0] || views.queued[0] || null;
  const passive = candidates.filter((item) => item.id === "passive-review")[0] || null;

  return {
    generatedAt,
    mode,
    headline: bestNow ? `God Mode says do this now: ${bestNow.title}` : homie.operatorHeadline,
    explanation: bestNow
      ? `${bestNow.kicker} • score ${bestNow.score} • ETA ${bestNow.etaMin}m`
      : homie.briefing,
    bestNow,
    bestToday,
    fallback,
    passive,
    views,
    operatorLine: `Homie operator layer is watching ${views.autoRunning.length} active lane${views.autoRunning.length === 1 ? "" : "s"} and ${views.blocked.length} blocker${views.blocked.length === 1 ? "" : "s"}.`,
    stats: {
      earnedUsd: Number(outcomeSummary.money || 0),
      queued: views.queued.length,
      blocked: views.blocked.length,
      active: views.autoRunning.length,
      quickCash: views.quickCash.length,
    },
  };
}
