import React from "react";
import PanelChrome from "../components/PanelChrome";
import { MARKET_GRAPH_DATA } from "../lib/marketGraphData";

function buildPath(width: number, height: number) {
  const values = MARKET_GRAPH_DATA.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = 18;
  const sx = (width - pad * 2) / (MARKET_GRAPH_DATA.length - 1);
  const sy = (height - pad * 2) / Math.max(1, max - min);
  const points = MARKET_GRAPH_DATA.map((d, i) => {
    const x = pad + i * sx;
    const y = height - pad - (d.value - min) * sy;
    return { ...d, x, y };
  });
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const area = `${line} L ${points[points.length - 1].x},${height - pad} L ${points[0].x},${height - pad} Z`;
  return { points, line, area, min, max, pad };
}

export default function MarketGraph({ embedded = false }: { embedded?: boolean }) {
  const width = 760;
  const height = 240;
  const { points, line, area, min, max, pad } = buildPath(width, height);
  const first = MARKET_GRAPH_DATA[0];
  const last = MARKET_GRAPH_DATA[MARKET_GRAPH_DATA.length - 1];
  const move = last.value - first.value;
  const movePct = ((move / first.value) * 100).toFixed(2);
  const avgVolume = Math.round(MARKET_GRAPH_DATA.reduce((sum, item) => sum + item.volume, 0) / MARKET_GRAPH_DATA.length);
  const highPoint = points.reduce((best, item) => (item.value > best.value ? item : best), points[0]);
  const lowPoint = points.reduce((best, item) => (item.value < best.value ? item : best), points[0]);
  const finalPoint = points[points.length - 1];
  const finalVolumeHeight = Math.max(14, Math.round((finalPoint.volume / 100) * 56));
  const trendLabel = move >= 0 ? "Trend intact" : "Trend fading";
  const trendClass = move >= 0 ? "badge good" : "badge warn";
  const body = (
    <div className="card marketGraphCard marketGraphSurface">
      <div className="widgetHeader marketGraphHeader">
        <div className="widgetHeaderLeft">
          <div className="widgetTitle">SPY intraday impulse</div>
          <div className="widgetSubtitle">Momentum pulse for the Phoenix watch lane with quick read stats and volume context</div>
        </div>
        <div className="widgetHeaderRight marketGraphHeaderRight">
          <span className={trendClass}>{trendLabel}</span>
          <span className="badge">Vol {avgVolume}</span>
          <span className="badge">Range {min}–{max}</span>
        </div>
      </div>

      <div className="marketGraphTopline">
        <div className="marketGraphMetric marketGraphMetricPrimary">
          <div className="marketGraphMetricLabel">Net move</div>
          <div className="marketGraphMetricValue">{move >= 0 ? "+" : ""}{move.toFixed(2)}</div>
          <div className="marketGraphMetricSub">{move >= 0 ? "+" : ""}{movePct}% from open</div>
        </div>
        <div className="marketGraphMetric">
          <div className="marketGraphMetricLabel">Session high</div>
          <div className="marketGraphMetricValue">{highPoint.value}</div>
          <div className="marketGraphMetricSub">{highPoint.label}</div>
        </div>
        <div className="marketGraphMetric">
          <div className="marketGraphMetricLabel">Session low</div>
          <div className="marketGraphMetricValue">{lowPoint.value}</div>
          <div className="marketGraphMetricSub">{lowPoint.label}</div>
        </div>
        <div className="marketGraphMetric">
          <div className="marketGraphMetricLabel">Closing pressure</div>
          <div className="marketGraphMetricValue">{finalPoint.volume}</div>
          <div className="marketGraphMetricSub">Final bar volume</div>
        </div>
      </div>

      <div className="widgetBody marketGraphBody">
        <div className="marketGraphStage">
          <svg viewBox={`0 0 ${width} ${height}`} className="marketGraphSvg" role="img" aria-label="Market graph">
            {[52, 104, 156, 208].map((y) => <line key={y} x1="0" y1={y} x2={width} y2={y} className="marketGraphGridLine" />)}
            {[pad, width / 2, width - pad].map((x, index) => <line key={index} x1={x} y1="0" x2={x} y2={height} className="marketGraphGridLine marketGraphGridLineVertical" />)}
            <path d={area} className="marketGraphArea" />
            <path d={line} className="marketGraphLine" />
            {points.map((p) => <circle key={p.label} cx={p.x} cy={p.y} r="4" className="marketGraphDot" />)}
            <line x1={highPoint.x} y1={0} x2={highPoint.x} y2={height} className="marketGraphMarker marketGraphMarkerHigh" />
            <line x1={lowPoint.x} y1={0} x2={lowPoint.x} y2={height} className="marketGraphMarker marketGraphMarkerLow" />
            <line x1={finalPoint.x} y1={0} x2={finalPoint.x} y2={height} className="marketGraphMarker marketGraphMarkerClose" />
          </svg>

          <div className="marketGraphCallout marketGraphCalloutHigh" style={{ left: `${(highPoint.x / width) * 100}%`, top: "16%" }}>
            <span>High</span>
            <strong>{highPoint.label}</strong>
          </div>
          <div className="marketGraphCallout marketGraphCalloutLow" style={{ left: `${(lowPoint.x / width) * 100}%`, top: "68%" }}>
            <span>Low</span>
            <strong>{lowPoint.label}</strong>
          </div>
          <div className="marketGraphCloseBadge" style={{ right: "2%", bottom: `${Math.max(12, ((height - finalPoint.y) / height) * 100 - 4)}%` }}>
            <span>Close push</span>
            <strong>{last.label}</strong>
          </div>
        </div>

        <div className="marketGraphLower">
          <div className="marketGraphLegend">
            {points.slice(-6).map((p) => <span key={p.label}>{p.label} · {p.value}</span>)}
          </div>
          <div className="marketGraphVolumeStrip">
            <div className="marketGraphVolumeLabel">Volume tone</div>
            <div className="marketGraphVolumeBar">
              <div className="marketGraphVolumeFill" style={{ width: `${Math.min(100, finalPoint.volume)}%` }} />
            </div>
            <div className="marketGraphVolumeText">{finalPoint.volume} / 100 into the close</div>
          </div>
        </div>
      </div>
    </div>
  );

  if (embedded) return body;

  return (
    <div className="stack loose">
      <PanelChrome title="Market Graph" subtitle="Fast visual read for intraday impulse, range, and closing pressure" compact right={<span className="panelChromeHint">Use this before drilling into the contract ladder</span>} />
      {body}
    </div>
  );
}
