
import React from "react";
import { PHOENIX_SECTORS, sniperSummary, topPhoenixSignals } from "../lib/marketDataPhoenix";

export default function TradingPanel() {
  const summary = sniperSummary();
  const leaders = topPhoenixSignals(3);
  const bullish = leaders.filter((item) => item.bias === "bullish").length;
  const posture = bullish >= 2 ? "Risk-on" : bullish === 1 ? "Balanced" : "Defensive";

  return (
    <div className="stack loose tradingHomeSurface">
      <div className="card tradingWorkspaceHero">
        <div className="small shellEyebrow">TRADING HOME</div>
        <div className="tradingWorkspaceTitle">Command deck</div>
        <div className="tradingWorkspaceSub">{summary.headline} Keep the lane clean, keep risk visible, and move only when structure is there.</div>
        <div className="tradingWorkspaceMetrics mt-5">
          <div className="tradingWorkspaceMetric">
            <div className="tradingWorkspaceLabel">Posture</div>
            <div className="tradingWorkspaceValue">{posture}</div>
            <div className="tradingWorkspaceHint">{bullish} of {leaders.length} highest-confidence names leaning bullish</div>
          </div>
          <div className="tradingWorkspaceMetric">
            <div className="tradingWorkspaceLabel">Top setup</div>
            <div className="tradingWorkspaceValue">{leaders[0]?.symbol || "—"}</div>
            <div className="tradingWorkspaceHint">{leaders[0] ? `${leaders[0].setup} • ${leaders[0].confidence}% confidence` : "Wait for clean structure"}</div>
          </div>
          <div className="tradingWorkspaceMetric">
            <div className="tradingWorkspaceLabel">Execution rule</div>
            <div className="tradingWorkspaceValue">1 clean idea</div>
            <div className="tradingWorkspaceHint">No chase entries. Let charts and chain agree first.</div>
          </div>
        </div>
      </div>

      <div className="tradingWorkspaceGrid">
        <div className="card tradingWorkspaceCard">
          <div className="widgetTitle">Priority lanes</div>
          <div className="widgetSubtitle">What deserves attention first under real market flow.</div>
          <div className="tradingWorkspaceList mt-4">
            {leaders.map((item) => (
              <div key={item.symbol} className="tradingWorkspaceRow">
                <div>
                  <div className="tradingWorkspaceRowTitle">{item.symbol} · {item.setup}</div>
                  <div className="tradingWorkspaceRowMeta">{item.catalyst}</div>
                </div>
                <div className="tradingWorkspaceScoreWrap">
                  <div className="tradingWorkspaceScore">{item.confidence}%</div>
                  <div className={`badge ${item.bias === "bullish" ? "good" : item.bias === "bearish" ? "bad" : "warn"}`}>{item.bias}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card tradingWorkspaceCard">
          <div className="widgetTitle">Sector pressure</div>
          <div className="widgetSubtitle">Charts and flows read cleaner when the broad lane agrees.</div>
          <div className="tradingWorkspaceList mt-4">
            {PHOENIX_SECTORS.slice(0, 4).map((sector) => (
              <div key={sector.id} className="tradingWorkspaceRow">
                <div>
                  <div className="tradingWorkspaceRowTitle">{sector.label}</div>
                  <div className="tradingWorkspaceRowMeta">Strength {sector.strength} · flow {sector.flow > 0 ? '+' : ''}{sector.flow}</div>
                </div>
                <div className="tradingWorkspaceBarWrap">
                  <div className="tradingWorkspaceBar"><div className="tradingWorkspaceBarFill" style={{ width: `${Math.max(8, Math.min(100, sector.strength))}%` }} /></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
