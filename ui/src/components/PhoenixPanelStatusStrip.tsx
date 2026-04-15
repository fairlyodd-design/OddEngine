import React, { useEffect, useMemo, useState } from "react";
import { buildActionQueue, buildPanelHealth, getPanelMeta, normalizePanelId, runQuickAction } from "../lib/brain";

type Props = {
  activeId: string;
  onNavigate: (id: string) => void;
};

function toneClass(status?: string) {
  if (status === "error") return "bad";
  if (status === "warn") return "warn";
  if (status === "good") return "good";
  return "muted";
}

export default function PhoenixPanelStatusStrip({ activeId, onNavigate }: Props) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const bump = () => setTick((v) => v + 1);
    const timer = window.setInterval(bump, 3000);
    window.addEventListener("storage", bump);
    window.addEventListener("oddengine:toast", bump as EventListener);
    window.addEventListener("oddengine:panel-action", bump as EventListener);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("storage", bump);
      window.removeEventListener("oddengine:toast", bump as EventListener);
      window.removeEventListener("oddengine:panel-action", bump as EventListener);
    };
  }, []);

  const targets = useMemo(
    () =>
      Array.from(
        new Set(
          [
            activeId,
            "Trading",
            "FamilyBudget",
            "Grow",
            "News",
            "FamilyHealth",
            "GroceryMeals",
            "Security",
            "Money",
            "OptionsSaaS",
          ].map((id) => normalizePanelId(id))
        )
      ),
    [activeId]
  );

  const health = useMemo(() => buildPanelHealth(targets), [targets, tick]);
  const activeHealth = useMemo(
    () =>
      health.find((item) => normalizePanelId(item.panelId) === normalizePanelId(activeId)) ||
      buildPanelHealth([activeId])[0],
    [health, activeId, tick]
  );
  const hottest = health[0] || activeHealth;
  const queue = useMemo(() => buildActionQueue(5), [tick]);
  const next = queue[0] || null;

  function runAction(actionId?: string, fallbackPanel?: string) {
    if (actionId) {
      const result = runQuickAction(actionId);
      if (result.panelId) onNavigate(result.panelId);
      return;
    }
    if (fallbackPanel) onNavigate(fallbackPanel);
  }

  return (
    <div
      className="card softCard"
      style={{
        marginTop: 10,
        borderColor: "rgba(250, 204, 21, 0.25)",
        boxShadow: "0 0 0 1px rgba(250, 204, 21, 0.08) inset",
      }}
    >
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div className="small shellEyebrow">PHOENIX STATUS + RECOVERY</div>
          <div className="h">Panel truth and one-tap recovery</div>
          <div className="sub">See the hottest lane, the active panel status, and the fastest recovery action without digging.</div>
        </div>
        <div className="assistantChipWrap">
          <span className={`badge ${toneClass(activeHealth?.status)}`}>Active {activeHealth?.score ?? "—"}/100</span>
          <span className={`badge ${toneClass(hottest?.status)}`}>{hottest ? `${hottest.title} hottest` : "Stable"}</span>
          <span className={`badge ${next ? "warn" : "good"}`}>{next ? `${queue.length} queued` : "Queue clear"}</span>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          marginTop: 12,
        }}
      >
        <div className="timelineCard">
          <div className="small">{getPanelMeta(activeId).icon} {getPanelMeta(activeId).title}</div>
          <div style={{ fontWeight: 800, marginTop: 6 }}>{activeHealth?.headline || "No active status yet."}</div>
          <div className="small" style={{ marginTop: 6 }}>
            {activeHealth?.reasons?.[0] || "This lane looks stable right now."}
          </div>
          <div className="row" style={{ marginTop: 10, gap: 8, flexWrap: "wrap" }}>
            {activeHealth?.nextActionId ? (
              <button className="tabBtn active" onClick={() => runAction(activeHealth.nextActionId, activeId)}>
                {activeHealth.nextActionLabel || "Recover lane"}
              </button>
            ) : null}
            <button className="tabBtn" onClick={() => onNavigate(activeId)}>Open lane</button>
          </div>
        </div>

        <div className="timelineCard">
          <div className="small">{hottest?.icon || "🔥"} {hottest?.title || "Hottest lane"}</div>
          <div style={{ fontWeight: 800, marginTop: 6 }}>
            {hottest ? `${hottest.title} needs attention` : "No hot lane detected."}
          </div>
          <div className="small" style={{ marginTop: 6 }}>
            {hottest?.headline || "Mission Control does not see a major hotspot right now."}
          </div>
          <div className="row" style={{ marginTop: 10, gap: 8, flexWrap: "wrap" }}>
            {hottest?.nextActionId ? (
              <button className="tabBtn active" onClick={() => runAction(hottest.nextActionId, hottest.panelId)}>
                {hottest.nextActionLabel || "Run recovery"}
              </button>
            ) : null}
            {hottest?.panelId ? <button className="tabBtn" onClick={() => onNavigate(hottest.panelId)}>Open {hottest.title}</button> : null}
          </div>
        </div>

        <div className="timelineCard">
          <div className="small">⚡ One-tap recovery</div>
          <div style={{ fontWeight: 800, marginTop: 6 }}>{next?.title || "Queue is calm"}</div>
          <div className="small" style={{ marginTop: 6 }}>
            {next?.body || "No queued recovery action is waiting. Use Brain for deeper triage if something feels off."}
          </div>
          <div className="row" style={{ marginTop: 10, gap: 8, flexWrap: "wrap" }}>
            {next?.actionId ? (
              <button className="tabBtn active" onClick={() => runAction(next.actionId, next.panelId)}>
                {next.actionLabel || "Run next"}
              </button>
            ) : null}
            <button className="tabBtn" onClick={() => onNavigate("Brain")}>Open Brain</button>
            <button className="tabBtn" onClick={() => window.location.reload()}>Reload app</button>
          </div>
        </div>
      </div>
    </div>
  );
}
