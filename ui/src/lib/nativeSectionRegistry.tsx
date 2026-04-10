
import React from "react";
import { renderLiftedComponent } from "./trueComponentLiftRegistry";

export type NativeSectionKey =
  | "trading-chart"
  | "trading-chain"
  | "trading-watchlist"
  | "budget-summary"
  | "budget-transactions"
  | "budget-payoff"
  | "homie-presence"
  | "homie-command-deck"
  | "homie-conversation-log";

function Placeholder({ title, note }: { title: string; note: string }) {
  return (
    <div style={{ padding: 14, color: "#d8ecff", lineHeight: 1.45 }}>
      <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>{title}</div>
      <div style={{ opacity: 0.9 }}>{note}</div>
      <div style={{ marginTop: 12, padding: 10, borderRadius: 12, border: "1px solid rgba(120,180,255,.18)", background: "rgba(8,14,24,.7)" }}>
        Deep native section lift scaffold is wired. Replace this placeholder with the real section component when you are ready to lift it from the source panel.
      </div>
    </div>
  );
}

export function renderNativeSection(sectionId: NativeSectionKey) {
  return renderLiftedComponent(sectionId as any);
}
