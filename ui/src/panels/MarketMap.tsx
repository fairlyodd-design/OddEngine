import React from "react";
import PanelChrome from "../components/PanelChrome";
import { PHOENIX_SECTORS, PHOENIX_WATCHLIST, topPhoenixSignals } from "../lib/marketDataPhoenix";

function barWidth(value: number) {
  return `${Math.max(8, Math.min(100, value))}%`;
}

function formatFlow(value: number) {
  return value > 0 ? `+${value}` : `${value}`;
}

export default function MarketMap() {
  const signals = topPhoenixSignals(4);
  const sectors = [...PHOENIX_SECTORS];
  const sortedSectors = [...sectors].sort((a, b) => b.strength - a.strength);
  const leader = sortedSectors[0];
  const laggard = sortedSectors[sortedSectors.length - 1];
  const avgStrength = Math.round(sortedSectors.reduce((sum, sector) => sum + sector.strength, 0) / sortedSectors.length);
  const avgConfidence = Math.round(signals.reduce((sum, item) => sum + item.confidence, 0) / Math.max(1, signals.length));
  const bullishCount = PHOENIX_WATCHLIST.filter((item) => item.bias === "bullish").length;
  const bearishCount = PHOENIX_WATCHLIST.filter((item) => item.bias === "bearish").length;
  const posture = bullishCount > bearishCount ? "Risk-on" : bearishCount > bullishCount ? "Defensive" : "Balanced";

  return (
    <div className="stack loose">
      <PanelChrome
        title="Galactic Market Map"
        subtitle="Sector leadership, signal quality, and rotation context for the sniper lane"
        right={<span className="badge good">Leader: {leader.label}</span>}
      />

      <div className="card softCard phoenixPanelCard marketMapHeroCard">
        <div className="marketMapHeroTop">
          <div>
            <div className="small shellEyebrow">MARKET INTELLIGENCE</div>
            <div className="h" style={{ marginTop: 6 }}>🌌 Galactic Market Map</div>
            <div className="sub" style={{ marginTop: 8 }}>
              {leader.label} is leading rotation while {signals[0]?.symbol || "QQQ"} remains the cleanest current signal in the Phoenix lane.
            </div>
          </div>
          <div className="marketMapPostureBadge">{posture}</div>
        </div>

        <div className="marketMapMetricsRow">
          <div className="marketMapMetricTile">
            <div className="marketMapMetricLabel">Sector leadership</div>
            <div className="marketMapMetricValue">{leader.label}</div>
            <div className="marketMapMetricSub">{leader.strength}/100 strength • Flow {formatFlow(leader.flow)}</div>
          </div>
          <div className="marketMapMetricTile">
            <div className="marketMapMetricLabel">Signal quality</div>
            <div className="marketMapMetricValue">{avgConfidence}%</div>
            <div className="marketMapMetricSub">Average confidence across top Phoenix setups</div>
          </div>
          <div className="marketMapMetricTile">
            <div className="marketMapMetricLabel">Market posture</div>
            <div className="marketMapMetricValue">{avgStrength}</div>
            <div className="marketMapMetricSub">Composite sector strength with {bullishCount} bullish vs {bearishCount} bearish names</div>
          </div>
        </div>
      </div>

      <div className="marketMapLayoutGrid">
        <div className="card marketMapBoardCard">
          <div className="marketMapSectionHead">
            <div>
              <div className="small shellEyebrow">SECTOR FLOW BOARD</div>
              <div className="sub" style={{ marginTop: 6 }}>Leadership first, laggards last. Use this before sizing sniper entries.</div>
            </div>
            <span className="badge">Avg {avgStrength}</span>
          </div>

          <div className="marketMapSectorList">
            {sortedSectors.map((sector, index) => (
              <div key={sector.id} className="marketMapSectorRow">
                <div className="marketMapSectorRank">#{index + 1}</div>
                <div className="marketMapSectorBody">
                  <div className="marketMapSectorTop">
                    <div>
                      <div className="marketMapSectorName">{sector.label}</div>
                      <div className="marketMapSectorMeta">Flow {formatFlow(sector.flow)} • {sector.strength >= 75 ? "Leader" : sector.strength <= 55 ? "Laggard" : "Neutral"}</div>
                    </div>
                    <div className="marketMapSectorScore">{sector.strength}</div>
                  </div>
                  <div className="marketMapSectorBarTrack">
                    <div className="marketMapSectorBarFill" style={{ width: barWidth(sector.strength), background: sector.color, boxShadow: `0 0 18px ${sector.color}` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="stack tight">
          <div className="card marketMapSignalCard">
            <div className="marketMapSectionHead">
              <div>
                <div className="small shellEyebrow">PHOENIX SIGNAL BOARD</div>
                <div className="sub" style={{ marginTop: 6 }}>Best setups ranked by confidence and aligned to the sector map.</div>
              </div>
              <span className="badge good">{signals.length} active</span>
            </div>

            <div className="marketMapSignalList">
              {signals.map((item) => (
                <div key={item.symbol} className="marketMapSignalTile">
                  <div className="marketMapSignalTop">
                    <div>
                      <div className="marketMapSignalSymbol">{item.symbol}</div>
                      <div className="marketMapSignalName">{item.name}</div>
                    </div>
                    <span className="badge">{item.confidence}%</span>
                  </div>
                  <div className="marketMapSignalSetup">{item.setup}</div>
                  <div className="marketMapSignalMeta">
                    ${item.price.toFixed(2)} • {item.changePct > 0 ? "+" : ""}{item.changePct.toFixed(2)}% • {item.bias} • IV {item.ivRank}
                  </div>
                  <div className="marketMapSignalCatalyst">{item.catalyst}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card marketMapIntelCard">
            <div className="marketMapSectionHead">
              <div>
                <div className="small shellEyebrow">TRADER READOUT</div>
                <div className="sub" style={{ marginTop: 6 }}>Quick translation from intelligence to action.</div>
              </div>
            </div>

            <div className="marketMapReadoutGrid">
              <div className="marketMapReadoutTile">
                <div className="marketMapMetricLabel">Leader</div>
                <div className="marketMapReadoutValue">{leader.label}</div>
                <div className="marketMapReadoutSub">Strongest flow on the board</div>
              </div>
              <div className="marketMapReadoutTile">
                <div className="marketMapMetricLabel">Laggard</div>
                <div className="marketMapReadoutValue">{laggard.label}</div>
                <div className="marketMapReadoutSub">Weakest rotation pocket</div>
              </div>
              <div className="marketMapReadoutTile marketMapReadoutTileWide">
                <div className="marketMapMetricLabel">Best alignment</div>
                <div className="marketMapReadoutValue">{signals[0]?.symbol || "QQQ"}</div>
                <div className="marketMapReadoutSub">{signals[0]?.setup || "Wait for clean structure"} • {signals[0]?.priority || "A"}-grade • Lane {signals[0]?.lane || "trend"}</div>
              </div>
            </div>

            <div className="marketMapChecklist">
              <div className="marketMapChecklistTitle">Execution checklist</div>
              <ul>
                <li>Favor setups aligned with the strongest sector flow and cleanest lane.</li>
                <li>Let Time Machine confirm the scenario before pressing full size.</li>
                <li>Be defensive when leadership narrows and laggards start catching bids.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
