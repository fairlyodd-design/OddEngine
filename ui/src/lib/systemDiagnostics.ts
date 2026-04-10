import { listRuns, type SystemRunRecord } from './systemRunRegistry';
import { listSystemEvents, type SystemEventRecord } from './systemEventLog';
import { listActionReceipts, type ActionReceiptRecord } from './actionReceipts';
import { listArtifacts, type ArtifactRecord } from './artifactRegistry';
import { listConnectorVerificationStates, type ConnectorVerificationState } from './connectorVerification';

export type PanelHealthState = 'healthy' | 'degraded' | 'blocked' | 'failed';

export interface SystemDiagnosticsSnapshot {
  generatedAt: number;
  health: PanelHealthState;
  summary: string;
  runs: SystemRunRecord[];
  events: SystemEventRecord[];
  receipts: ActionReceiptRecord[];
  artifacts: ArtifactRecord[];
  connectors: ConnectorVerificationState[];
}

export function buildSystemDiagnosticsSnapshot(): SystemDiagnosticsSnapshot {
  const runs = listRuns();
  const events = listSystemEvents().slice(0, 40);
  const receipts = listActionReceipts().slice(0, 40);
  const artifacts = listArtifacts().slice(0, 40);
  const connectors = listConnectorVerificationStates();

  const failedRuns = runs.filter((run) => run.status === 'failed').length;
  const blockedRuns = runs.filter((run) => run.status === 'blocked').length;
  const failedConnectors = connectors.filter((entry) => entry.status === 'failed').length;

  let health: PanelHealthState = 'healthy';
  if (failedRuns || failedConnectors) health = 'failed';
  else if (blockedRuns) health = 'blocked';
  else if (runs.some((run) => run.status === 'running')) health = 'degraded';

  const summary = [
    `${runs.length} tracked runs`,
    `${events.length} recent events`,
    `${receipts.length} receipts`,
    `${artifacts.length} artifacts`,
    `${connectors.length} connectors`,
  ].join(' • ');

  return {
    generatedAt: Date.now(),
    health,
    summary,
    runs,
    events,
    receipts,
    artifacts,
    connectors,
  };
}
