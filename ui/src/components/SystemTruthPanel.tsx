import React, { useEffect, useState } from "react";
import { listRegisteredArtifacts, ARTIFACT_REGISTRY_EVENT } from "../lib/artifactRegistry";
import { listActionReceipts, ACTION_RECEIPTS_EVENT } from "../lib/actionReceipts";
import { listConnectorVerifications, CONNECTOR_VERIFICATION_EVENT } from "../lib/connectorVerification";
import { listSystemEvents, SYSTEM_EVENT_LOG_EVENT } from "../lib/systemEventLog";
import { listSystemRuns, summarizeRunStatus, SYSTEM_RUN_EVENT } from "../lib/systemRunRegistry";
import { listWidgetGeometries, WIDGET_WINDOW_MANAGER_EVENT } from "../lib/widgetWindowManager";
import { buildHomieExecutiveSnapshot } from "../lib/homieExecutive";

export default function SystemTruthPanel({ activePanelId }: { activePanelId?: string }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick((value) => value + 1);
    const events = [SYSTEM_RUN_EVENT, SYSTEM_EVENT_LOG_EVENT, ACTION_RECEIPTS_EVENT, ARTIFACT_REGISTRY_EVENT, CONNECTOR_VERIFICATION_EVENT, WIDGET_WINDOW_MANAGER_EVENT];
    events.forEach((eventName) => window.addEventListener(eventName, bump));
    return () => events.forEach((eventName) => window.removeEventListener(eventName, bump));
  }, []);

  const runs = listSystemRuns().slice(0, 8);
  const events = listSystemEvents().slice(0, 6);
  const receipts = listActionReceipts().slice(0, 6);
  const artifacts = listRegisteredArtifacts().slice(0, 6);
  const connectors = listConnectorVerifications().slice(0, 6);
  const widgets = listWidgetGeometries();
  const stats = summarizeRunStatus();
  const homie = buildHomieExecutiveSnapshot(activePanelId);

  return (
    <div className="card softCard" style={{ padding: 14 }}>
      <div className="cluster wrap spread">
        <div>
          <div className="small shellEyebrow">System truth</div>
          <div className="builderSectionTitle" style={{ fontSize: 22 }}>Audit trail + unified run state</div>
          <div className="small mt-2">One place to verify what ran, what blocked, what finished, and why Homie is saying a move is next.</div>
        </div>
        <div className="assistantChipWrap">
          <span className="badge">Queued {stats.queued}</span>
          <span className="badge">Running {stats.running}</span>
          <span className="badge">Blocked {stats.blocked}</span>
          <span className="badge good">Completed {stats.completed}</span>
          <span className="badge bad">Failed {stats.failed}</span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.15fr .85fr", gap: 14, marginTop: 12 }}>
        <div style={{ display: "grid", gap: 12 }}>
          <section>
            <div className="h">Homie explanation layer</div>
            <div className="note" style={{ marginTop: 8 }}>{homie.headline}</div>
            <div className="small" style={{ marginTop: 8 }}>{homie.explanation}</div>
            <div className="small" style={{ marginTop: 8, fontWeight: 700 }}>Next move: {homie.nextMove}</div>
            {!!homie.needsYou.length && <ul className="small" style={{ marginTop: 8, paddingLeft: 18 }}>{homie.needsYou.map((item) => <li key={item}>{item}</li>)}</ul>}
          </section>

          <section>
            <div className="h">Active runs</div>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              {runs.length ? runs.map((run) => (
                <div key={run.id} style={{ padding: 10, borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(8,12,18,0.3)" }}>
                  <div className="cluster wrap spread">
                    <strong>{run.title}</strong>
                    <span className="badge">{run.status}</span>
                  </div>
                  <div className="small mt-2">{run.scope}{run.panelId ? ` • ${run.panelId}` : ""}</div>
                  {run.explanation ? <div className="small mt-2">{run.explanation}</div> : null}
                </div>
              )) : <div className="small">No unified runs recorded yet.</div>}
            </div>
          </section>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          <MiniList title="Artifacts" items={artifacts.map((item) => `${item.title} • ${item.status}`)} />
          <MiniList title="Receipts" items={receipts.map((item) => `${item.action} • ${item.message}`)} />
          <MiniList title="Connectors" items={connectors.map((item) => `${item.label} • ${item.status}`)} />
          <MiniList title="Recent events" items={events.map((item) => `${item.scope} • ${item.title}`)} />
          <MiniList title="Widget memory" items={[`${widgets.length} remembered widget geometr${widgets.length === 1 ? "y" : "ies"}`]} />
        </div>
      </div>
    </div>
  );
}

function MiniList({ title, items }: { title: string; items: string[] }) {
  return (
    <section>
      <div className="h">{title}</div>
      <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
        {items.length ? items.map((item) => (
          <div key={item} className="small" style={{ padding: 10, borderRadius: 12, background: "rgba(8,12,18,0.3)", border: "1px solid rgba(255,255,255,0.06)" }}>{item}</div>
        )) : <div className="small">Nothing recorded yet.</div>}
      </div>
    </section>
  );
}
