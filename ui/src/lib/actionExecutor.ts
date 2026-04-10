import { seedHomieDraft } from "./homieCore";
import { loadMoneyQueue, saveMoneyQueue, updateQueueStatus } from "./moneyQueue";
import type { DecisionAction, DecisionCandidate, OperatorMode } from "./godModeDecisionEngine";
import { attachReceiptToRun, createSystemRun, updateSystemRun } from "./systemRunRegistry";
import { recordActionReceipt } from "./actionReceipts";
import { logSystemEvent } from "./systemEventLog";
import { logLifeFeed } from "./lifeOSLoop";

export type ExecutionRecord = {
  id: string;
  candidateId: string;
  title: string;
  mode: OperatorMode;
  status: "queued" | "running" | "done" | "error";
  startedAt: number;
  finishedAt?: number;
  note?: string;
};

const EXECUTION_KEY = "fairlyodd.godmode.executionLog.v10.26.18b";

function loadExecutionLog(): ExecutionRecord[] {
  try {
    const raw = window.localStorage.getItem(EXECUTION_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveExecutionLog(records: ExecutionRecord[]) {
  try {
    window.localStorage.setItem(EXECUTION_KEY, JSON.stringify(records.slice(0, 40)));
  } catch {}
}

export function listExecutionLog() {
  return loadExecutionLog();
}

function pushExecution(record: ExecutionRecord) {
  const next = [record, ...loadExecutionLog()].slice(0, 40);
  saveExecutionLog(next);
}

function completeExecution(id: string, status: ExecutionRecord["status"], note?: string) {
  const next = loadExecutionLog().map((item) => item.id === id ? { ...item, status, note, finishedAt: Date.now() } : item);
  saveExecutionLog(next);
}

function dispatchExecute(action: DecisionAction) {
  try {
    window.dispatchEvent(new CustomEvent("oddengine:godmode-execute", { detail: action }));
  } catch {}
}

export async function executeDecisionCandidate(candidate: DecisionCandidate, mode: OperatorMode) {
  const recordId = `${candidate.id}-${Date.now()}`;
  const run = createSystemRun({
    scope: "god-mode-action",
    title: candidate.title,
    panelId: candidate.action.panelId,
    source: "decision-candidate",
    sourceId: candidate.id,
    status: mode === "manual" ? "queued" : "running",
    explanation: candidate.kicker || candidate.body,
  });
  pushExecution({ id: recordId, candidateId: candidate.id, title: candidate.title, mode, status: mode === "manual" ? "queued" : "running", startedAt: Date.now() });
  if (mode === "manual") {
    const receipt = recordActionReceipt({ action: candidate.action.type, scope: "god-mode-action", status: "queued", message: "Queued in manual mode.", runId: run.id, panelId: candidate.action.panelId });
    attachReceiptToRun(run.id, receipt.id);
    updateSystemRun(run.id, { status: "queued", userActionNeeded: "Manual mode keeps this queued until you explicitly run it." });
    logSystemEvent({ level: "info", scope: "god-mode", title: `Queued ${candidate.title}`, body: "Manual mode queued the action without executing it.", runId: run.id });
    completeExecution(recordId, "queued", "Queued only. Manual mode does not run actions.");
    return { ok: true, message: "Queued in manual mode." };
  }
  try {
    if (candidate.action.type === "mark-queue-executing" && candidate.action.queueItemId) {
      const items = loadMoneyQueue();
      const updated = updateQueueStatus(items, candidate.action.queueItemId, "executing");
      saveMoneyQueue(updated);
      dispatchExecute({ type: "open-panel", panelId: candidate.action.panelId || "Money", lowRisk: true });
      const receipt = recordActionReceipt({ action: candidate.action.type, scope: "god-mode-action", status: "completed", message: "Money queue item marked executing.", runId: run.id, panelId: candidate.action.panelId });
      attachReceiptToRun(run.id, receipt.id);
      updateSystemRun(run.id, { status: "completed" });
      logSystemEvent({ level: "good", scope: "god-mode", title: `Executed ${candidate.title}`, body: "Money queue item marked executing.", runId: run.id });
      logLifeFeed({ title: "Homie executed a money move", body: candidate.title, status: "good", scope: "action-executor" });
      completeExecution(recordId, "done", "Money queue item marked executing.");
      return { ok: true, message: "Money queue item marked executing." };
    }
    if (candidate.action.type === "route-homie" && candidate.action.prompt) {
      seedHomieDraft(candidate.action.prompt, { source: "godmode-executor", panelId: candidate.action.panelId || "Homie" });
      dispatchExecute({ type: "open-panel", panelId: candidate.action.panelId || "Homie", lowRisk: true });
      const receipt = recordActionReceipt({ action: candidate.action.type, scope: "god-mode-action", status: "completed", message: "Drafted into Homie.", runId: run.id, panelId: candidate.action.panelId });
      attachReceiptToRun(run.id, receipt.id);
      updateSystemRun(run.id, { status: "completed" });
      logSystemEvent({ level: "good", scope: "god-mode", title: `Executed ${candidate.title}`, body: "Sent guidance into Homie.", runId: run.id });
      logLifeFeed({ title: "Homie routed guidance", body: candidate.title, status: "info", scope: "action-executor" });
      completeExecution(recordId, "done", "Drafted into Homie." );
      return { ok: true, message: "Sent to Homie." };
    }
    dispatchExecute(candidate.action);
    const receipt = recordActionReceipt({ action: candidate.action.type, scope: "god-mode-action", status: "completed", message: `Executed ${candidate.action.type}.`, runId: run.id, panelId: candidate.action.panelId });
    attachReceiptToRun(run.id, receipt.id);
    updateSystemRun(run.id, { status: "completed" });
    logSystemEvent({ level: "good", scope: "god-mode", title: `Executed ${candidate.title}`, body: `Action type: ${candidate.action.type}`, runId: run.id });
    logLifeFeed({ title: "Homie executed a live action", body: `${candidate.title} • ${candidate.action.type}`, status: "good", scope: "action-executor" });
    completeExecution(recordId, "done", candidate.action.type);
    return { ok: true, message: `Executed ${candidate.action.type}.` };
  } catch (err: any) {
    const message = String(err?.message || err || "Execution failed.");
    const receipt = recordActionReceipt({ action: candidate.action.type, scope: "god-mode-action", status: "failed", message, runId: run.id, panelId: candidate.action.panelId });
    attachReceiptToRun(run.id, receipt.id);
    updateSystemRun(run.id, { status: "failed", userActionNeeded: message });
    logSystemEvent({ level: "error", scope: "god-mode", title: `Failed ${candidate.title}`, body: message, runId: run.id });
    logLifeFeed({ title: "Homie hit an execution issue", body: `${candidate.title} • ${message}`, status: "error", scope: "action-executor" });
    completeExecution(recordId, "error", message);
    return { ok: false, message };
  }
}
