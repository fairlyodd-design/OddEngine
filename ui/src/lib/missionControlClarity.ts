import { buildGodModeDecisionSnapshot, type DecisionCandidate } from "./godModeDecisionEngine";
import { buildOpportunityRadarSnapshot } from "./opportunityRadar";
import { buildWorkflowChainSnapshot } from "./autopilotWorkflowChains";
import { summarizeRunStatus } from "./systemRunRegistry";
import { listConnectorVerifications } from "./connectorVerification";

export type MissionPriorityItem = {
  id: string;
  title: string;
  body: string;
  panelId: string;
  score: number;
  etaLabel: string;
  reason: string;
  source: string;
  blocked?: boolean;
};

export type MissionControlClaritySnapshot = {
  generatedAt: number;
  headline: string;
  bestMove: MissionPriorityItem | null;
  supportMoves: MissionPriorityItem[];
  blockedMoves: MissionPriorityItem[];
  hiddenCount: number;
  stats: {
    now: number;
    today: number;
    blocked: number;
    queued: number;
    connectorsFailing: number;
  };
  explanation: string;
};

function toEtaLabel(candidate: DecisionCandidate | null | undefined) {
  const eta = Math.max(1, Math.round(Number(candidate?.etaMin || 0)));
  return eta <= 1 ? "Now" : `${eta} min`;
}

function fromCandidate(candidate: DecisionCandidate | null | undefined, source: string): MissionPriorityItem | null {
  if (!candidate) return null;
  return {
    id: candidate.id,
    title: candidate.title,
    body: candidate.body || candidate.kicker || candidate.blockedReason || candidate.title || "Ranked operator move.",
    panelId: candidate.panelId,
    score: Math.round(Number(candidate.score || 0)),
    etaLabel: toEtaLabel(candidate),
    reason: candidate.kicker || candidate.blockedReason || source,
    source,
    blocked: candidate.state === "blocked",
  };
}

export async function buildMissionControlClaritySnapshot(activePanelId: string): Promise<MissionControlClaritySnapshot> {
  const [decision, radar, chains] = await Promise.all([
    buildGodModeDecisionSnapshot(activePanelId || "Brain"),
    buildOpportunityRadarSnapshot(activePanelId || "Brain"),
    buildWorkflowChainSnapshot(activePanelId || "Brain"),
  ]);
  const runs = summarizeRunStatus();
  const connectorsFailing = listConnectorVerifications().filter((item) => item.status === "failed").length;

  const supportMoves = [
    fromCandidate(decision.bestToday, "Best today"),
    fromCandidate(decision.views.quickCash?.[0], "Quick cash"),
    radar.fastestCashLane
      ? {
          id: `radar-${radar.fastestCashLane.id}`,
          title: radar.fastestCashLane.title,
          body: radar.fastestCashLane.body,
          panelId: radar.fastestCashLane.panelId,
          score: Math.round(radar.fastestCashLane.predictiveScore),
          etaLabel: radar.fastestCashLane.timeToCashLabel,
          reason: radar.fastestCashLane.note,
          source: "Opportunity Radar",
          blocked: false,
        }
      : null,
  ].filter(Boolean) as MissionPriorityItem[];

  const blockedMoves = [
    fromCandidate(decision.fallback, "Blocked fallback"),
    ...decision.views.blocked.slice(0, 2).map((item) => fromCandidate(item, "Blocked queue")),
  ].filter(Boolean) as MissionPriorityItem[];

  const bestMove = fromCandidate(decision.bestNow, "Best now") || supportMoves[0] || null;
  const hiddenCount = Math.max(0, (decision.views.now?.length || 0) + (decision.views.queued?.length || 0) + (chains.chains?.length || 0) - supportMoves.length);

  return {
    generatedAt: Date.now(),
    headline: bestMove ? `Best move right now: ${bestMove.title}` : "Mission Control is ranking the next move.",
    bestMove,
    supportMoves: supportMoves.slice(0, 3),
    blockedMoves,
    hiddenCount,
    stats: {
      now: decision.views.now?.length || 0,
      today: decision.views.today?.length || 0,
      blocked: runs.blocked,
      queued: runs.queued,
      connectorsFailing,
    },
    explanation: bestMove
      ? `${bestMove.reason} • ${bestMove.etaLabel}. ${hiddenCount > 0 ? `${hiddenCount} lower-priority moves hidden to reduce noise.` : "Noise compressed so you can move fast."}`
      : "No priority winner yet. Seed Money, Studio, Trading, or Mission Control to rank the board.",
  };
}
