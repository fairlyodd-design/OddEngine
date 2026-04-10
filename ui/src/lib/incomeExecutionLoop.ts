import { executeDecisionCandidate } from "./actionExecutor";
import type { DecisionCandidate, OperatorMode } from "./godModeDecisionEngine";
import { recordActionReceipt, listActionReceipts } from "./actionReceipts";
import { logSystemEvent } from "./systemEventLog";
import { verifyConnector, listConnectorVerifications } from "./connectorVerification";
import { listSystemRuns } from "./systemRunRegistry";

export type IncomeExecutionLoopStep = {
  id: string;
  label: string;
  state: "ready" | "running" | "done" | "blocked";
  detail: string;
};

export type IncomeExecutionLoopSnapshot = {
  headline: string;
  explanation: string;
  steps: IncomeExecutionLoopStep[];
  stats: {
    completedToday: number;
    failedToday: number;
    connectorsHealthy: number;
    runsActive: number;
  };
};

function scopeForCandidate(candidate: DecisionCandidate | null | undefined) {
  const panel = candidate?.panelId || "Brain";
  if (panel === "Books") return "studio";
  if (panel === "Trading" || panel === "OptionsSniperTerminal") return "trading";
  return "money";
}

export function buildIncomeExecutionLoopSnapshot(candidate?: DecisionCandidate | null): IncomeExecutionLoopSnapshot {
  const receipts = listActionReceipts();
  const connectors = listConnectorVerifications();
  const runs = listSystemRuns();
  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;
  const completedToday = receipts.filter((item) => item.ts >= dayAgo && item.status === "completed").length;
  const failedToday = receipts.filter((item) => item.ts >= dayAgo && item.status === "failed").length;
  const connectorsHealthy = connectors.filter((item) => item.status === "connected").length;
  const runsActive = runs.filter((item) => item.status === "running").length;
  const scope = scopeForCandidate(candidate);
  const steps: IncomeExecutionLoopStep[] = [
    {
      id: "detect",
      label: "Detect",
      state: candidate ? "done" : "blocked",
      detail: candidate ? `Ranked ${candidate.title} from ${candidate.panelId}.` : "No ranked candidate yet.",
    },
    {
      id: "verify",
      label: "Verify",
      state: candidate ? "ready" : "blocked",
      detail: candidate ? `Check ${scope} connectors before execution.` : "Waiting on a candidate.",
    },
    {
      id: "execute",
      label: "Execute",
      state: candidate ? (candidate.action.lowRisk ? "ready" : "blocked") : "blocked",
      detail: candidate ? (candidate.action.lowRisk ? "Low-risk lane can run now." : "Needs human review before running.") : "Nothing to execute.",
    },
    {
      id: "prove",
      label: "Prove",
      state: "ready",
      detail: "Write receipts, events, and connector status back into the OS spine.",
    },
  ];
  return {
    headline: candidate ? `Income loop ready for ${candidate.title}` : "Income loop waiting for the next ranked move.",
    explanation: candidate
      ? `This closes the loop from priority → execution → proof for ${scope}.`
      : "Once a best move is ranked, the loop verifies the lane, runs it, and writes receipts back into System Truth.",
    steps,
    stats: { completedToday, failedToday, connectorsHealthy, runsActive },
  };
}

export async function runIncomeExecutionLoop(candidate: DecisionCandidate, mode: OperatorMode) {
  const scope = scopeForCandidate(candidate);
  verifyConnector(`${scope}-execution-loop`, `${scope[0].toUpperCase()}${scope.slice(1)} execution loop`, true, "Loop verified before execution.");
  const queued = recordActionReceipt({
    action: `income-loop:${candidate.action.type}`,
    scope: "income-loop",
    status: mode === "manual" ? "queued" : "running",
    message: mode === "manual" ? "Income loop queued in manual mode." : `Income loop started for ${candidate.title}.`,
    panelId: candidate.panelId,
  });
  logSystemEvent({
    level: "info",
    scope: "income-loop",
    title: `Income loop ${mode === "manual" ? "queued" : "started"}`,
    body: `${candidate.title} • ${scope}`,
  });
  const result = await executeDecisionCandidate(candidate, mode);
  recordActionReceipt({
    action: `income-loop:${candidate.action.type}`,
    scope: "income-loop",
    status: result.ok ? "completed" : "failed",
    message: result.message,
    panelId: candidate.panelId,
  });
  logSystemEvent({
    level: result.ok ? "good" : "error",
    scope: "income-loop",
    title: result.ok ? `Income loop finished ${candidate.title}` : `Income loop failed ${candidate.title}`,
    body: result.message,
  });
  return { ok: result.ok, message: result.message, queuedReceiptId: queued.id };
}
