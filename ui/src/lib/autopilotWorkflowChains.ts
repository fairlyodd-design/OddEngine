import { executeDecisionCandidate, listExecutionLog } from "./actionExecutor";
import { buildGodModeDecisionSnapshot, loadOperatorMode, type DecisionCandidate, type OperatorMode } from "./godModeDecisionEngine";
import { buildOpportunityRadarSnapshot } from "./opportunityRadar";
import { loadOutcomeRecords, summarizeOutcomes } from "./moneyOutcomeLoop";

export type WorkflowStep = {
  id: string;
  label: string;
  state: "ready" | "running" | "done" | "blocked";
  detail: string;
};

export type WorkflowChain = {
  id: string;
  title: string;
  lane: "money" | "studio" | "trading" | "operator";
  score: number;
  etaMinutes: number;
  lowRisk: boolean;
  candidate: DecisionCandidate | null;
  steps: WorkflowStep[];
  status: "ready" | "running" | "blocked" | "done";
  summary: string;
};

export type WorkflowChainSnapshot = {
  generatedAt: number;
  headline: string;
  chains: WorkflowChain[];
  stats: {
    ready: number;
    blocked: number;
    lowRisk: number;
    earnedUsd: number;
  };
};

function laneForCandidate(candidate: DecisionCandidate | null): WorkflowChain["lane"] {
  if (!candidate) return "operator";
  if (candidate.panelId === "Books" || candidate.panelId === "Builder") return "studio";
  if (candidate.panelId === "Trading" || candidate.panelId === "OptionsSniperTerminal") return "trading";
  if (candidate.panelId === "Money" || candidate.panelId === "PhoenixIncomeForge") return "money";
  return "operator";
}

function buildChain(id: string, title: string, candidate: DecisionCandidate | null, etaMinutes: number, summary: string): WorkflowChain {
  const lowRisk = !!candidate?.action.lowRisk;
  return {
    id,
    title,
    lane: laneForCandidate(candidate),
    score: Math.max(1, Math.round(Number(candidate?.score || 50))),
    etaMinutes: Math.max(3, Math.round(etaMinutes || 15)),
    lowRisk,
    candidate,
    status: candidate ? (candidate.action.lowRisk ? "ready" : "blocked") : "blocked",
    summary,
    steps: [
      { id: `${id}-detect`, label: "Detect", state: "done", detail: candidate ? `Found ranked move in ${candidate.panelId}.` : "Waiting for a ranked move." },
      { id: `${id}-queue`, label: "Queue", state: candidate ? "done" : "blocked", detail: candidate ? candidate.title : "No candidate yet." },
      { id: `${id}-execute`, label: "Execute", state: lowRisk ? "ready" : "blocked", detail: lowRisk ? "Safe enough for assisted/autopilot." : "Needs your eyes before execution." },
      { id: `${id}-learn`, label: "Learn", state: "ready", detail: "Capture outcome and feed the loop." },
    ],
  };
}

export async function buildWorkflowChainSnapshot(activePanelId: string): Promise<WorkflowChainSnapshot> {
  const generatedAt = Date.now();
  const [decision, radar] = await Promise.all([
    buildGodModeDecisionSnapshot(activePanelId || "Brain"),
    buildOpportunityRadarSnapshot(activePanelId || "Brain"),
  ]);
  const outcomes = summarizeOutcomes(loadOutcomeRecords());
  const chains: WorkflowChain[] = [
    buildChain("best-now", "Best move chain", decision.bestNow || null, 8, decision.bestNow ? `Run ${decision.bestNow.title} now.` : "No best-now chain available yet."),
    buildChain("best-today", "Today plan chain", decision.bestToday || null, 25, decision.bestToday ? `This is the best longer lane for today.` : "No best-today chain available yet."),
    buildChain("fast-cash", "Fastest cash chain", radar.fastestCashLane ? ({
      id: `radar-${radar.fastestCashLane.id}`,
      title: radar.fastestCashLane.title,
      panelId: radar.fastestCashLane.panelId,
      score: radar.fastestCashLane.predictiveScore,
      reason: radar.fastestCashLane.note,
      explanation: radar.fastestCashLane.body,
      action: { type: "open-panel", panelId: radar.fastestCashLane.panelId, lowRisk: radar.fastestCashLane.energyCost <= 35 },
      amountLabel: radar.fastestCashLane.timeToCashLabel,
    } as any) : null, radar.fastestCashLane?.timeToCashMinutes || 12, radar.fastestCashLane ? radar.fastestCashLane.note : "Radar has not found a fast lane yet."),
  ];
  return {
    generatedAt,
    headline: chains[0]?.summary || "Building workflow chains...",
    chains,
    stats: {
      ready: chains.filter((item) => item.status === "ready").length,
      blocked: chains.filter((item) => item.status === "blocked").length,
      lowRisk: chains.filter((item) => item.lowRisk).length,
      earnedUsd: outcomes.earnedUsd + outcomes.savedUsd,
    },
  };
}

export async function runWorkflowChain(chain: WorkflowChain, mode: OperatorMode = loadOperatorMode()) {
  if (!chain.candidate) return { ok: false, message: "No chain candidate to run." };
  return executeDecisionCandidate(chain.candidate, mode);
}

export function listWorkflowChainRuns() {
  return listExecutionLog().slice(0, 8);
}
