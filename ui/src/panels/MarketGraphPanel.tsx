
import React, { useEffect, useMemo, useState } from "react";
import { getMarketGraph } from "../../../core/market-graph/marketGraph";
import { detectMoneyFlow } from "../../../core/market-graph/models/moneyFlowModel";
import { getSectorLeaders, getSectorState, updateSectorRotation } from "../../../core/sector-rotation/sectorRotationAI";

export default function MarketGraphPanel() {
  const [flows, setFlows] = useState<any[]>([]);
  const [leaders, setLeaders] = useState<any[]>([]);
  const [sectors, setSectors] = useState<any[]>([]);

  useEffect(() => {
    const graph = getMarketGraph();
    const tick = () => {
      updateSectorRotation();
      setFlows(detectMoneyFlow(graph.edges));
      setLeaders(getSectorLeaders());
      setSectors(getSectorState());
    };
    tick();
    const i = setInterval(tick, 4000);
    return () => clearInterval(i);
  }, []);

  const strongestFlow = useMemo(() => flows[0], [flows]);
  const leadSector = useMemo(() => leaders[0], [leaders]);
  const hottestSector = useMemo(() => [...sectors].sort((a, b) => Number(b.inflow || 0) - Number(a.inflow || 0))[0], [sectors]);

  return (
    <div className="stack loose marketGraphSurface">
      <div className="card marketGraphHeroCard">
        <div className="small shellEyebrow">CHARTS + GRAPHS</div>
        <div className="tradingWorkspaceTitle">Global market graph</div>
        <div className="tradingWorkspaceSub">Read the broad tape first: where money is moving, which sector is carrying, and where participation is fading.</div>
        <div className="tradingWorkspaceMetrics mt-5">
          <div className="tradingWorkspaceMetric">
            <div className="tradingWorkspaceLabel">Strongest flow</div>
            <div className="tradingWorkspaceValue">{strongestFlow?.path || "Waiting"}</div>
            <div className="tradingWorkspaceHint">Strength {strongestFlow?.strength ?? "—"}</div>
          </div>
          <div className="tradingWorkspaceMetric">
            <div className="tradingWorkspaceLabel">Lead sector</div>
            <div className="tradingWorkspaceValue">{leadSector?.sector || "—"}</div>
            <div className="tradingWorkspaceHint">Momentum {leadSector?.momentum ?? "—"}</div>
          </div>
          <div className="tradingWorkspaceMetric">
            <div className="tradingWorkspaceLabel">Hottest inflow</div>
            <div className="tradingWorkspaceValue">{hottestSector?.sector || "—"}</div>
            <div className="tradingWorkspaceHint">Inflow {hottestSector?.inflow ?? "—"}</div>
          </div>
        </div>
      </div>

      <div className="marketGraphGrid">
        <div className="card tradingWorkspaceCard">
          <div className="widgetTitle">Money flow lanes</div>
          <div className="widgetSubtitle">The clearest cross-market moves first.</div>
          <div className="tradingWorkspaceList mt-4">
            {flows.slice(0, 6).map((flow, index) => (
              <div key={`${flow.path}-${index}`} className="tradingWorkspaceRow">
                <div>
                  <div className="tradingWorkspaceRowTitle">{flow.path}</div>
                  <div className="tradingWorkspaceRowMeta">Cross-asset pressure line</div>
                </div>
                <div className="tradingWorkspaceScore">{flow.strength}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card tradingWorkspaceCard">
          <div className="widgetTitle">Sector leaders</div>
          <div className="widgetSubtitle">Momentum names helping the broad move hold.</div>
          <div className="tradingWorkspaceList mt-4">
            {leaders.slice(0, 6).map((sector, index) => (
              <div key={`${sector.sector}-${index}`} className="tradingWorkspaceRow">
                <div>
                  <div className="tradingWorkspaceRowTitle">{sector.sector}</div>
                  <div className="tradingWorkspaceRowMeta">Leadership lane</div>
                </div>
                <div className="tradingWorkspaceScore">{sector.momentum}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card tradingWorkspaceCard">
          <div className="widgetTitle">Sector map</div>
          <div className="widgetSubtitle">Inflow board for the current graph cycle.</div>
          <div className="tradingWorkspaceList mt-4">
            {sectors.slice(0, 6).map((sector, index) => (
              <div key={`${sector.sector}-${index}`} className="tradingWorkspaceRow">
                <div>
                  <div className="tradingWorkspaceRowTitle">{sector.sector}</div>
                  <div className="tradingWorkspaceRowMeta">Participation pressure</div>
                </div>
                <div className="tradingWorkspaceScore">{sector.inflow}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
