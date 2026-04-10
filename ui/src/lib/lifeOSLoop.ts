import type { DecisionCandidate } from "./godModeDecisionEngine";
import { executeDecisionCandidate } from "./actionExecutor";
import { listRegisteredArtifacts } from "./artifactRegistry";
import { listActionReceipts, recordActionReceipt } from "./actionReceipts";
import { listConnectorVerifications } from "./connectorVerification";
import { logSystemEvent } from "./systemEventLog";
import { listSystemRuns, summarizeRunStatus } from "./systemRunRegistry";
import { loadJSON, saveJSON } from "./storage";

export type LifeAutonomyLevel = "manual" | "assisted" | "semiAuto" | "fullAuto";

export type LifeFeedEntry = {
  id: string;
  ts: number;
  title: string;
  body: string;
  status: "info" | "good" | "warn" | "error";
  scope: string;
};

export type LifeOSLoopSnapshot = {
  autonomy: LifeAutonomyLevel;
  headline: string;
  explanation: string;
  watcherSummary: string;
  stats: {
    running: number;
    blocked: number;
    connectorsFailing: number;
    artifactsReady: number;
    receiptsToday: number;
  };
  recent: LifeFeedEntry[];
};

const LEVEL_KEY = "oddengine:life-loop:autonomy:v1";
const FEED_KEY = "oddengine:life-loop:feed:v1";
const EVENT = "oddengine:life-loop:updated";

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function emit() {
  try { window.dispatchEvent(new CustomEvent(EVENT)); } catch {}
}

export function loadLifeAutonomyLevel(): LifeAutonomyLevel {
  return loadJSON<LifeAutonomyLevel>(LEVEL_KEY, "assisted");
}

export function saveLifeAutonomyLevel(level: LifeAutonomyLevel) {
  saveJSON(LEVEL_KEY, level);
  emit();
}

export function listLifeFeed(): LifeFeedEntry[] {
  return loadJSON<LifeFeedEntry[]>(FEED_KEY, []).sort((a, b) => (b.ts || 0) - (a.ts || 0));
}

export function logLifeFeed(input: Omit<LifeFeedEntry, "id" | "ts"> & { ts?: number }) {
  const entry: LifeFeedEntry = {
    id: uid("life"),
    ts: input.ts || Date.now(),
    title: input.title,
    body: input.body,
    status: input.status,
    scope: input.scope,
  };
  saveJSON(FEED_KEY, [entry, ...listLifeFeed()].slice(0, 120));
  emit();
  return entry;
}

export function buildLifeOSLoopSnapshot(activePanelId?: string): LifeOSLoopSnapshot {
  const autonomy = loadLifeAutonomyLevel();
  const runs = listSystemRuns();
  const status = summarizeRunStatus();
  const connectors = listConnectorVerifications();
  const artifacts = listRegisteredArtifacts();
  const receipts = listActionReceipts();
  const feed = listLifeFeed();

  const activeRun = runs.find((item) => item.status === "running" && (!activePanelId || item.panelId === activePanelId)) || runs.find((item) => item.status === "running");
  const failedConnectors = connectors.filter((item) => item.status === "failed");
  const readyArtifacts = artifacts.filter((item) => item.status === "ready" || item.status === "published");
  const recentReceipts = receipts.filter((item) => item.ts > Date.now() - 1000 * 60 * 60 * 24);

  const headline = activeRun
    ? `Autonomous operator is watching ${activeRun.title}.`
    : failedConnectors.length
      ? `${failedConnectors.length} connector${failedConnectors.length === 1 ? "" : "s"} need attention.`
      : readyArtifacts.length
        ? `${readyArtifacts.length} finished output${readyArtifacts.length === 1 ? " is" : "s are"} waiting for next action.`
        : "Life OS loop is calm and ready.";

  const explanation = activeRun?.explanation
    || failedConnectors[0]?.detail
    || feed[0]?.body
    || "Homie is continuously checking system runs, connectors, outputs, and receipts so you can see what happened while you were away.";

  const watcherSummary = [
    `${status.running} active run${status.running === 1 ? "" : "s"}`,
    `${status.blocked} blocked`,
    `${failedConnectors.length} connector issues`,
    `${readyArtifacts.length} ready outputs`,
  ].join(" • ");

  return {
    autonomy,
    headline,
    explanation,
    watcherSummary,
    stats: {
      running: status.running,
      blocked: status.blocked,
      connectorsFailing: failedConnectors.length,
      artifactsReady: readyArtifacts.length,
      receiptsToday: recentReceipts.length,
    },
    recent: feed.slice(0, 6),
  };
}

export async function runLifeOSAutonomousTick(candidate: DecisionCandidate | null, level: LifeAutonomyLevel) {
  if (!candidate) {
    return { ok: false, message: "No candidate available for the life loop." };
  }
  if (level === "manual" || level === "assisted") {
    const body = level === "manual"
      ? "Manual autonomy keeps the operator in observe-only mode."
      : "Assisted autonomy keeps the operator suggestion-first. Use Run to execute.";
    logLifeFeed({ title: "Life loop observed next move", body, status: "info", scope: "life-loop" });
    return { ok: true, message: body };
  }
  if (!candidate.action.lowRisk) {
    const body = "Life loop skipped this move because it is not marked low risk.";
    logLifeFeed({ title: "Skipped high-risk move", body, status: "warn", scope: "life-loop" });
    return { ok: false, message: body };
  }
  const mode = level === "fullAuto" ? "autopilot" : "assisted";
  const result = await executeDecisionCandidate(candidate, mode);
  const body = result.ok
    ? `Homie executed ${candidate.title} and is watching the result.`
    : `Homie attempted ${candidate.title} but hit an issue: ${result.message}`;
  logLifeFeed({ title: result.ok ? "Autonomous move executed" : "Autonomous move failed", body, status: result.ok ? "good" : "error", scope: "life-loop" });
  recordActionReceipt({ action: "life-loop-tick", scope: "life-loop", status: result.ok ? "completed" : "failed", message: body, panelId: candidate.panelId });
  logSystemEvent({ level: result.ok ? "good" : "error", scope: "life-loop", title: result.ok ? "Life loop executed move" : "Life loop failed move", body });
  return result;
}

export const LIFE_OS_LOOP_EVENT = EVENT;
