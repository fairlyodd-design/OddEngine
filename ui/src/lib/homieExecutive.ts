import { listRegisteredArtifacts } from "./artifactRegistry";
import { listActionReceipts } from "./actionReceipts";
import { listConnectorVerifications } from "./connectorVerification";
import { listSystemEvents } from "./systemEventLog";
import { listSystemRuns, summarizeRunStatus } from "./systemRunRegistry";

export type HomieExecutiveSnapshot = {
  headline: string;
  explanation: string;
  needsYou: string[];
  didRecently: string[];
  nextMove: string;
};

export function buildHomieExecutiveSnapshot(activePanelId?: string): HomieExecutiveSnapshot {
  const runs = listSystemRuns();
  const events = listSystemEvents();
  const receipts = listActionReceipts();
  const connectors = listConnectorVerifications();
  const artifacts = listRegisteredArtifacts();
  const status = summarizeRunStatus();

  const activeRun = runs.find((item) => item.status === "running" && (!activePanelId || item.panelId === activePanelId)) || runs.find((item) => item.status === "running");
  const blocked = runs.filter((item) => item.status === "blocked").slice(0, 3);
  const failedConnector = connectors.find((item) => item.status === "failed");
  const latestArtifact = artifacts[0];
  const latestReceipt = receipts[0];
  const latestEvent = events[0];

  const headline = activeRun
    ? `Homie is actively driving ${activeRun.title}.`
    : status.blocked
      ? `Homie sees ${status.blocked} blocked item${status.blocked === 1 ? "" : "s"} that need attention.`
      : latestArtifact
        ? `Latest finished output: ${latestArtifact.title}.`
        : "Homie has the operator board quiet and ready.";

  const needsYou = blocked.map((item) => item.userActionNeeded || item.explanation || item.title);
  if (failedConnector) needsYou.unshift(`${failedConnector.label} needs reconnection${failedConnector.detail ? ` • ${failedConnector.detail}` : ""}`);

  const didRecently = [
    latestReceipt ? `${latestReceipt.action}: ${latestReceipt.message}` : "",
    latestArtifact ? `Registered artifact • ${latestArtifact.title}` : "",
    latestEvent ? `${latestEvent.scope} • ${latestEvent.title}` : "",
  ].filter(Boolean);

  const explanation = activeRun?.explanation || latestEvent?.body || "Homie is using the shared truth spine so every action, artifact, and connector has receipts instead of vibes.";
  const nextMove = needsYou[0] || latestArtifact?.title || latestReceipt?.message || "No urgent interrupts. Pick the highest-confidence money or studio run and keep momentum.";

  return { headline, explanation, needsYou, didRecently, nextMove };
}
