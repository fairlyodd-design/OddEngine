import React, { useMemo } from 'react';
import { buildSystemDiagnosticsSnapshot } from '../lib/systemDiagnostics';

export default function SystemDiagnosticsPanel() {
  const snapshot = useMemo(() => buildSystemDiagnosticsSnapshot(), []);

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="cardShell" style={{ padding: 14 }}>
        <div style={{ fontSize: 12, letterSpacing: '.18em', textTransform: 'uppercase', opacity: .7 }}>System diagnostics</div>
        <div style={{ fontSize: 24, fontWeight: 900, marginTop: 6 }}>{snapshot.health}</div>
        <div style={{ opacity: .8, marginTop: 6 }}>{snapshot.summary}</div>
      </div>
      <div className="cardShell" style={{ padding: 14 }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Recent runs</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {snapshot.runs.slice(0, 6).map((run) => (
            <div key={run.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span>{run.title}</span>
              <span style={{ opacity: .75 }}>{run.status}</span>
            </div>
          ))}
          {!snapshot.runs.length ? <div style={{ opacity: .75 }}>No runs tracked yet.</div> : null}
        </div>
      </div>
    </div>
  );
}
