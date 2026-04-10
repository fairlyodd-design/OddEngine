import { recordActionReceipt } from "./actionReceipts";
import { listConnectorVerifications, verifyConnector } from "./connectorVerification";
import { logSystemEvent } from "./systemEventLog";
import { createSystemRun, updateSystemRun } from "./systemRunRegistry";
import { loadJSON, saveJSON } from "./storage";

export type ConnectorClosureRecord = {
  id: string;
  ts: number;
  connectorKey: string;
  label: string;
  result: "verified" | "retry-needed";
  detail: string;
};

export type ConnectorClosureSnapshot = {
  headline: string;
  explanation: string;
  stats: {
    connected: number;
    failed: number;
    pending: number;
  };
  recent: ConnectorClosureRecord[];
};

const KEY = "oddengine:connector-closure:v1";
const EVENT = "oddengine:connector-closure:updated";

function uid() {
  return `closure-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function emit() {
  try { window.dispatchEvent(new CustomEvent(EVENT)); } catch {}
}

export function listConnectorClosures(): ConnectorClosureRecord[] {
  return loadJSON<ConnectorClosureRecord[]>(KEY, []).sort((a, b) => (b.ts || 0) - (a.ts || 0));
}

function save(records: ConnectorClosureRecord[]) {
  saveJSON(KEY, records.slice(0, 120));
  emit();
}

export function buildConnectorClosureSnapshot(): ConnectorClosureSnapshot {
  const connectors = listConnectorVerifications();
  const recent = listConnectorClosures();
  const connected = connectors.filter((item) => item.status === "connected").length;
  const failed = connectors.filter((item) => item.status === "failed").length;
  const pending = connectors.filter((item) => item.status === "pending").length;
  const headline = failed
    ? `${failed} connector${failed === 1 ? "" : "s"} still need proof or retry.`
    : connected
      ? `${connected} connector${connected === 1 ? "" : "s"} verified in the closure loop.`
      : "No connector proofs captured yet.";
  const explanation = recent[0]?.detail || "21b adds a proof layer so uploads, outputs, and backends get verified instead of assumed.";
  return { headline, explanation, stats: { connected, failed, pending }, recent: recent.slice(0, 6) };
}

export async function runConnectorExecutionClosure() {
  const existing = listConnectorVerifications();
  const targets = existing.length ? existing.slice(0, 5) : [
    { key: "creative-backend", label: "Creative backend bridge", status: "pending" as const, verified: false, checkedAt: Date.now(), detail: "No prior verification yet." },
    { key: "publisher-youtube", label: "Publisher connector", status: "pending" as const, verified: false, checkedAt: Date.now(), detail: "No prior verification yet." },
    { key: "camera-bridge", label: "Camera live bridge", status: "pending" as const, verified: false, checkedAt: Date.now(), detail: "No prior verification yet." },
  ];

  const run = createSystemRun({
    scope: "connector-closure",
    title: "Verify connector and output loop",
    panelId: "Brain",
    status: "running",
    explanation: "Checking whether important bridges are verified, failed, or still pending.",
  });

  const records: ConnectorClosureRecord[] = [];
  for (const target of targets) {
    const ok = target.status === "connected" || target.verified;
    const detail = ok
      ? `${target.label} is verified and can be trusted for the next loop.`
      : `${target.label} still needs retry or real-world proof.`;
    verifyConnector(target.key, target.label, ok, detail);
    records.push({ id: uid(), ts: Date.now(), connectorKey: target.key, label: target.label, result: ok ? "verified" : "retry-needed", detail });
    recordActionReceipt({ action: "connector-closure", scope: "connector-closure", status: ok ? "completed" : "failed", message: detail, runId: run.id, panelId: "Brain" });
    logSystemEvent({ level: ok ? "good" : "warn", scope: "connector-closure", title: ok ? `Verified ${target.label}` : `Retry needed • ${target.label}`, body: detail, runId: run.id });
  }

  save([...records, ...listConnectorClosures()]);
  updateSystemRun(run.id, {
    status: records.some((item) => item.result === "retry-needed") ? "blocked" : "completed",
    userActionNeeded: records.some((item) => item.result === "retry-needed") ? "At least one connector still needs retry or proof." : undefined,
  });
  return {
    ok: !records.some((item) => item.result === "retry-needed"),
    message: records.some((item) => item.result === "retry-needed")
      ? "Connector closure loop found items that still need retry or proof."
      : "Connector closure loop verified the current bridges.",
  };
}

export const CONNECTOR_CLOSURE_EVENT = EVENT;
