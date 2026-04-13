export type PanelHealthState = 'healthy' | 'degraded' | 'blocked' | 'failed';

export interface SystemDiagnosticsSnapshot {
  generatedAt: number;
  health: PanelHealthState;
  summary: string;
  runs: any[];
  events: any[];
  receipts: any[];
  artifacts: any[];
  connectors: any[];
}

export function buildSystemDiagnosticsSnapshot(): SystemDiagnosticsSnapshot {
  return {
    generatedAt: Date.now(),
    health: 'healthy',
    summary: 'Diagnostics compatibility snapshot is running in safe mode.',
    runs: [],
    events: [],
    receipts: [],
    artifacts: [],
    connectors: [],
  };
}
