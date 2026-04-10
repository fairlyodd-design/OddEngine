import React, { useEffect, useRef } from "react";
import { type PublicContract } from "../../lib/publicScanner";

function formatGreek(v: number | null | undefined, digits = 3) {
  return typeof v === "number" && Number.isFinite(v) ? v.toFixed(digits) : "—";
}

export function TradingViewChart({ symbol, interval }: { symbol: string; interval: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof window === "undefined") return;
    container.innerHTML = "";
    const widgetHost = document.createElement("div");
    widgetHost.className = "tradingview-widget-container__widget";
    widgetHost.style.height = "460px";
    widgetHost.style.width = "100%";
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.async = true;
    script.type = "text/javascript";
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol,
      interval,
      timezone: "Etc/UTC",
      theme: "dark",
      style: "1",
      locale: "en",
      allow_symbol_change: true,
      save_image: false,
      withdateranges: true,
      hide_side_toolbar: false,
      support_host: "https://www.tradingview.com",
    });
    container.appendChild(widgetHost);
    container.appendChild(script);
    return () => {
      container.innerHTML = "";
    };
  }, [symbol, interval]);
  return <div className="tradingview-widget-container" ref={containerRef} style={{ minHeight: 460 }} />;
}

export function OptionCurveChart({ contracts, selectedKey }: { contracts: PublicContract[]; selectedKey: string | null }) {
  const rows = contracts.slice(0, 18);
  if (!rows.length) return <div className="small mt-3">Load a chain to draw the option curve.</div>;
  const width = 980;
  const height = 250;
  const pad = 34;
  const strikes = rows.map((c) => c.strike);
  const asks = rows.map((c) => c.ask ?? c.last ?? 0);
  const minStrike = Math.min(...strikes);
  const maxStrike = Math.max(...strikes);
  const maxAsk = Math.max(...asks, 0.01);
  const xForStrike = (strike: number) => pad + ((strike - minStrike) / Math.max(1, maxStrike - minStrike || 1)) * (width - pad * 2);
  const yForAsk = (ask: number) => height - pad - (ask / maxAsk) * (height - pad * 2);
  const path = rows.map((c, idx) => `${idx === 0 ? "M" : "L"}${xForStrike(c.strike)} ${yForAsk(c.ask ?? c.last ?? 0)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: 250, display: "block" }}>
      <rect x="0" y="0" width={width} height={height} fill="rgba(8,12,18,0.35)" rx="14" />
      <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="rgba(147,164,183,0.35)" />
      <line x1={pad} y1={pad} x2={pad} y2={height - pad} stroke="rgba(147,164,183,0.35)" />
      <path d={path} fill="none" stroke="rgba(96,165,250,0.95)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      {rows.map((c) => {
        const cx = xForStrike(c.strike);
        const cy = yForAsk(c.ask ?? c.last ?? 0);
        const selected = c.key === selectedKey;
        return (
          <g key={c.key}>
            <circle cx={cx} cy={cy} r={selected ? 6 : 4} fill={selected ? "#fbbf24" : c.side === "call" ? "#34d399" : "#fb7185"} />
            <text x={cx} y={height - 8} textAnchor="middle" fill="#93a4b7" fontSize="10">{c.strike.toFixed(0)}</text>
          </g>
        );
      })}
      <text x={pad} y="16" fill="#93a4b7" fontSize="12">Filtered contract ask curve</text>
      <text x={width - 90} y="16" fill="#93a4b7" fontSize="11">max {maxAsk.toFixed(2)}</text>
    </svg>
  );
}

export function OiBarChart({ contracts, selectedKey }: { contracts: PublicContract[]; selectedKey: string | null }) {
  const rows = contracts.slice(0, 18);
  if (!rows.length) return <div className="small mt-3">Load a chain to graph open interest.</div>;
  const width = 980;
  const height = 250;
  const pad = 34;
  const maxOi = Math.max(...rows.map((c) => c.openInterest ?? 0), 1);
  const slot = (width - pad * 2) / rows.length;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: 250, display: "block" }}>
      <rect x="0" y="0" width={width} height={height} fill="rgba(8,12,18,0.35)" rx="14" />
      <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="rgba(147,164,183,0.35)" />
      {rows.map((c, idx) => {
        const h = ((c.openInterest ?? 0) / maxOi) * (height - pad * 2 - 12);
        const barX = pad + idx * slot + slot * 0.14;
        const w = slot * 0.72;
        const barY = height - pad - h;
        const selected = c.key === selectedKey;
        return (
          <g key={c.key}>
            <rect x={barX} y={barY} width={w} height={h} rx="6" fill={selected ? "rgba(96,165,250,0.95)" : c.side === "call" ? "rgba(52,211,153,0.80)" : "rgba(251,113,133,0.80)"} />
            <text x={barX + w / 2} y={height - 6} textAnchor="middle" fill="#93a4b7" fontSize="10">{c.strike.toFixed(0)}</text>
          </g>
        );
      })}
      <text x={pad} y="16" fill="#93a4b7" fontSize="12">Filtered contracts by open interest</text>
      <text x={width - 86} y="16" fill="#93a4b7" fontSize="11">max OI {maxOi}</text>
    </svg>
  );
}
