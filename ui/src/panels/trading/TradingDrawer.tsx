import React from "react";
import { isDesktop, oddApi } from "../../lib/odd";
import { emptyGreeks, type PublicChainData, type PublicContract } from "../../lib/publicApi";
import { formatMoney } from "../../lib/publicScanner";

async function undockTrading(kind: string, title: string){
  try{
    const api = oddApi();
    if(!api?.openWindow) return;
    await api.openWindow({
      title,
      width: 1280,
      height: 820,
      query: { panel: "trading", undock: kind },
    });
  }catch{}
}

function formatGreek(v: number | null | undefined, digits = 3) {
  return typeof v === "number" && Number.isFinite(v) ? v.toFixed(digits) : "—";
}
function formatPct(v: number | null | undefined) {
  return typeof v === "number" && Number.isFinite(v) ? `${v.toFixed(2)}%` : "—";
}
function formatTimestamp(v: string | null | undefined) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString();
}

function DrawerList({ rows, selectedKey, onPick }: { rows: PublicContract[]; selectedKey: string | null; onPick: (key: string) => void }) {
  if (!rows.length) return <div className="small mt-4">No contracts in this tab yet.</div>;
  return (
    <div className="grid mt-4" style={{ maxHeight: 430, overflow: "auto" }}>
      {rows.slice(0, 24).map((row) => {
        const selected = row.key === selectedKey;
        return (
          <button
            key={row.key}
            onClick={() => onPick(row.key)}
            style={{
              textAlign: "left",
              borderColor: selected ? "rgba(96,165,250,0.35)" : "var(--line)",
              background: selected ? "rgba(96,165,250,0.12)" : "rgba(15,22,34,0.35)",
            }}
          >
            <div className="cluster spread">
              <b>{row.side.toUpperCase()} {row.strike.toFixed(2)}</b>
              <span className={`badge ${row.side === "call" ? "good" : "bad"}`}>{formatMoney(row.ask)}</span>
            </div>
            <div className="small">To BE {formatPct(row.toBreakevenPct)} • OI {row.openInterest ?? "—"} • Δ {formatGreek(row.greeks?.delta)}</div>
          </button>
        );
      })}
    </div>
  );
}

export function ContractDrawer({
  contract,
  chain,
  drawerTab,
  setDrawerTab,
  callRows,
  putRows,
  onPickContract,
  onOpenPublic,
  onFetchGreeks,
}: {
  contract: PublicContract | null;
  chain: PublicChainData | null;
  drawerTab: "calls" | "puts" | "detail" | "greeks";
  setDrawerTab: (tab: "calls" | "puts" | "detail" | "greeks") => void;
  callRows: PublicContract[];
  putRows: PublicContract[];
  onPickContract: (key: string) => void;
  onOpenPublic: () => void;
  onFetchGreeks: () => void;
}) {
  const greeks = contract?.greeks || emptyGreeks();
  return (
    <div id="trading_drawer" className="card optionDrawer tradingSectionCard" style={{ minHeight: 320 }}>
      <div className="cluster spread start">
        <div>
          <div style={{ fontWeight: 900, fontSize: 18 }}>Option drawer</div>
          <div className="small">Public/mobile-style side tabs for calls, puts, detail, and greeks.</div>
        </div>
        <div className="cluster">
          {isDesktop() && (
            <button onClick={() => void undockTrading("drawer", `Option drawer • ${chain?.symbol || ""}`)} title="Open the drawer in a separate window">
              Undock
            </button>
          )}
          {contract && <span className={`badge ${contract.side === "call" ? "good" : "bad"}`}>{contract.side.toUpperCase()}</span>}
        </div>
      </div>

      <div className="tabs mt-4" style={{ flexWrap: "wrap" }}>
        <button className={drawerTab === "calls" ? "tabBtn active" : "tabBtn"} onClick={() => setDrawerTab("calls")}>Calls</button>
        <button className={drawerTab === "puts" ? "tabBtn active" : "tabBtn"} onClick={() => setDrawerTab("puts")}>Puts</button>
        <button className={drawerTab === "detail" ? "tabBtn active" : "tabBtn"} onClick={() => setDrawerTab("detail")}>Detail</button>
        <button className={drawerTab === "greeks" ? "tabBtn active" : "tabBtn"} onClick={() => setDrawerTab("greeks")}>Greeks</button>
      </div>

      {drawerTab === "calls" && <DrawerList rows={callRows} selectedKey={contract?.key ?? null} onPick={onPickContract} />}
      {drawerTab === "puts" && <DrawerList rows={putRows} selectedKey={contract?.key ?? null} onPick={onPickContract} />}

      {drawerTab === "detail" && (
        !contract ? <div className="small mt-5">Click a contract row to load quote, breakeven, and chain detail here.</div> : (
          <div className="grid mt-5">
            <div>
              <div style={{ fontWeight: 900, fontSize: 18 }}>{contract.symbol} {contract.side.toUpperCase()} {contract.strike.toFixed(2)}</div>
              <div className="small">{contract.expiration || chain?.expirationLabel || "Expiry not loaded"} • {chain?.sourceMode === "public_api" ? "Public API" : "Public website delayed"}</div>
            </div>
            <div className="drawerStatGrid">
              <div className="drawerStat"><span className="small">Bid</span><b>{formatMoney(contract.bid)}</b></div>
              <div className="drawerStat"><span className="small">Ask</span><b>{formatMoney(contract.ask)}</b></div>
              <div className="drawerStat"><span className="small">Last</span><b>{formatMoney(contract.last)}</b></div>
              <div className="drawerStat"><span className="small">Breakeven</span><b>{formatMoney(contract.breakeven)}</b></div>
              <div className="drawerStat"><span className="small">To BE</span><b>{formatPct(contract.toBreakevenPct)}</b></div>
              <div className="drawerStat"><span className="small">OI / Vol</span><b>{contract.openInterest ?? "—"} / {contract.volume ?? "—"}</b></div>
              <div className="drawerStat"><span className="small">Scanner score</span><b>{contract.score.toFixed(1)}</b></div>
              <div className="drawerStat"><span className="small">OSI</span><b style={{ fontSize: 12 }}>{contract.osiSymbol || "—"}</b></div>
            </div>
            <div className="small">Feed updated: {formatTimestamp(chain?.feedUpdated)}</div>
            <div className="row wrap">
              <button onClick={onFetchGreeks}>Refresh greeks</button>
              <button onClick={onOpenPublic}>Open on Public</button>
            </div>
          </div>
        )
      )}

      {drawerTab === "greeks" && (
        !contract ? <div className="small mt-5">Pick a contract to inspect Δ / Γ / Θ / V / ρ / IV.</div> : (
          <div className="grid mt-5">
            <div className="drawerStatGrid">
              <div className="drawerStat"><span className="small">Delta</span><b>{formatGreek(greeks.delta)}</b></div>
              <div className="drawerStat"><span className="small">Gamma</span><b>{formatGreek(greeks.gamma)}</b></div>
              <div className="drawerStat"><span className="small">Theta</span><b>{formatGreek(greeks.theta)}</b></div>
              <div className="drawerStat"><span className="small">Vega</span><b>{formatGreek(greeks.vega)}</b></div>
              <div className="drawerStat"><span className="small">Rho</span><b>{formatGreek(greeks.rho)}</b></div>
              <div className="drawerStat"><span className="small">IV</span><b>{greeks.impliedVolatility !== null && greeks.impliedVolatility !== undefined ? `${(greeks.impliedVolatility * 100).toFixed(1)}%` : "—"}</b></div>
            </div>
            <div className="card tradingMiniCard">
              <div className="small"><b>Quick read:</b></div>
              <div className="small mt-2">Δ tells you directional sensitivity. Γ tells you how fast delta changes. Θ is daily decay pressure. V shows sensitivity to IV change. ρ is usually minor for short-dated contracts. IV spikes can juice premium even if price stalls.</div>
            </div>
            <div className="row wrap">
              <span className="badge">Δ {formatGreek(greeks.delta)}</span>
              <span className="badge">Γ {formatGreek(greeks.gamma)}</span>
              <span className="badge">Θ {formatGreek(greeks.theta)}</span>
              <span className="badge">V {formatGreek(greeks.vega)}</span>
              <span className="badge">ρ {formatGreek(greeks.rho)}</span>
              <span className="badge warn">IV {greeks.impliedVolatility !== null && greeks.impliedVolatility !== undefined ? `${(greeks.impliedVolatility * 100).toFixed(1)}%` : "—"}</span>
            </div>
          </div>
        )
      )}
    </div>
  );
}
