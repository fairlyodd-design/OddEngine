import React from "react";
import MoneyOutcomePanel from "../components/MoneyOutcomePanel";
import MoneyQueuePanel from "../components/MoneyQueuePanel";
import MoneyAutopilotPanel from "../components/MoneyAutopilotPanel";
import RevenueAnalyticsPanel from "../components/RevenueAnalyticsPanel";
import PublishPanel from "../components/PublishPanel";
import StudioPipelinePanel from "../components/StudioPipelinePanel";

export type LiftedComponentId =
  | "money-outcome"
  | "money-queue"
  | "money-autopilot"
  | "revenue-analytics"
  | "publish-panel"
  | "studio-pipeline"
  | "trading-chart"
  | "trading-chain"
  | "trading-watchlist"
  | "budget-summary"
  | "budget-transactions"
  | "budget-payoff"
  | "homie-presence"
  | "homie-command-deck"
  | "homie-conversation-log"
  | "writers-home"
  | "writers-room"
  | "director-room"
  | "music-lab"
  | "render-lab"
  | "producer-ops";

type Factory = () => React.ReactNode;
const factories: Partial<Record<LiftedComponentId, Factory>> = {};

export function registerLiftedComponent(id: LiftedComponentId, factory: Factory) {
  factories[id] = factory;
}

function shell(title: string, subtitle: string, children: React.ReactNode) {
  return (
    <div style={{ padding: 14, color: "#d8ecff", lineHeight: 1.45 }}>
      <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>{title}</div>
      <div style={{ opacity: 0.84, marginBottom: 12 }}>{subtitle}</div>
      <div
        style={{
          border: "1px solid rgba(120,180,255,.18)",
          borderRadius: 12,
          background: "rgba(8,14,24,.7)",
          padding: 12,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function tradingChart() {
  return shell(
    "Trading Chart",
    "Real trading section lift target",
    <div>
      <div
        style={{
          height: 220,
          borderRadius: 10,
          border: "1px solid rgba(120,180,255,.12)",
          background: "linear-gradient(180deg, rgba(18,30,48,.9), rgba(8,14,24,.95))",
          display: "grid",
          placeItems: "center",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 800 }}>Chart Lift Zone</div>
          <div style={{ opacity: 0.8, marginTop: 8 }}>Swap this with the real chart subtree when ready.</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        {["1m", "5m", "15m", "1h", "D"].map((tf) => (
          <button
            key={tf}
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid rgba(120,180,255,.18)",
              background: "rgba(15,23,36,.92)",
              color: "#ecf6ff",
            }}
          >
            {tf}
          </button>
        ))}
      </div>
    </div>
  );
}

function tradingChain() {
  const rows = [
    ["125", "2.14", "2.26", "+0.18", "0.42"],
    ["126", "1.82", "1.94", "+0.12", "0.39"],
    ["127", "1.51", "1.66", "+0.07", "0.35"],
    ["128", "1.24", "1.36", "+0.03", "0.31"],
  ];

  return shell(
    "Trading Chain",
    "Real options chain lift target",
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <thead>
        <tr style={{ textAlign: "left", color: "#f5fbff" }}>
          <th style={{ padding: 8 }}>Strike</th>
          <th style={{ padding: 8 }}>Bid</th>
          <th style={{ padding: 8 }}>Ask</th>
          <th style={{ padding: 8 }}>Δ Day</th>
          <th style={{ padding: 8 }}>Delta</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} style={{ borderTop: "1px solid rgba(120,180,255,.12)" }}>
            {r.map((cell, j) => (
              <td key={j} style={{ padding: 8 }}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function tradingWatchlist() {
  const items = [
    ["SPY", "+0.8%"],
    ["QQQ", "+1.1%"],
    ["NVDA", "+2.3%"],
    ["TSLA", "-0.4%"],
    ["AAPL", "+0.5%"],
  ];

  return shell(
    "Trading Watchlist",
    "Real watchlist lift target",
    <div style={{ display: "grid", gap: 8 }}>
      {items.map(([sym, move]) => (
        <div
          key={sym}
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: 10,
            borderRadius: 10,
            background: "rgba(15,23,36,.84)",
            border: "1px solid rgba(120,180,255,.12)",
          }}
        >
          <strong>{sym}</strong>
          <span>{move}</span>
        </div>
      ))}
    </div>
  );
}

function writerPanel(title: string, subtitle: string, cta: string) {
  return shell(
    title,
    subtitle,
    <div>
      <textarea
        style={{
          width: "100%",
          minHeight: 180,
          borderRadius: 12,
          background: "rgba(11,18,31,.95)",
          color: "#e9f4ff",
          border: "1px solid rgba(120,180,255,.18)",
          padding: 12,
        }}
        defaultValue={`# ${title}\n\nStart creating here...`}
      />
      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        {["New", "Expand", "Polish", cta].map((label) => (
          <button
            key={label}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid rgba(120,180,255,.18)",
              background: "rgba(15,23,36,.92)",
              color: "#ecf6ff",
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function renderLiftedComponent(id: LiftedComponentId) {
  const factory = factories[id];
  if (factory) return factory();

  switch (id) {
    case "studio-pipeline":
      return <StudioPipelinePanel />;
    case "publish-panel":
      return <PublishPanel />;
    case "revenue-analytics":
      return <RevenueAnalyticsPanel />;
    case "money-autopilot":
      return <MoneyAutopilotPanel />;
    case "money-queue":
      return <MoneyQueuePanel />;
    case "money-outcome":
      return <MoneyOutcomePanel />;
    case "trading-chart":
      return tradingChart();
    case "trading-chain":
      return tradingChain();
    case "trading-watchlist":
      return tradingWatchlist();
    case "budget-summary":
    case "budget-transactions":
    case "budget-payoff":
    case "homie-presence":
    case "homie-command-deck":
    case "homie-conversation-log":
      return shell(id, "Lift target is ready.", <div>Wire the real source component here when ready.</div>);
    case "writers-home":
      return writerPanel("Writers Home", "Studio launch lane for all writing flows.", "Ship");
    case "writers-room":
      return writerPanel("Writers Room", "Draft, revise, and finalize manuscript work.", "Finalize");
    case "director-room":
      return writerPanel("Director Room", "Scene planning, sequencing, and story beats.", "Storyboard");
    case "music-lab":
      return writerPanel("Music Lab", "Lyrics, hooks, themes, and song ideas.", "Export Lyrics");
    case "render-lab":
      return writerPanel("Render Lab", "Render prompts, notes, and asset queue planning.", "Queue Render");
    case "producer-ops":
      return writerPanel("Producer Ops", "Metadata, releases, deliverables, and shipping.", "Release");
    default:
      return shell(id, "Unknown lift target.", <div>Register the real component here.</div>);
  }
}
