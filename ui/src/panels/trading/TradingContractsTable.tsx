import React from "react";
import { isDesktop, oddApi } from "../../lib/odd";
import { formatMoney, scanContractScore, type PublicContract, type PublicChainData } from "../../lib/publicScanner";

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

type StrikeGroupSummary = {
  bucket: number;
  label: string;
  count: number;
  callCount: number;
  putCount: number;
  maxOi: number;
  bestContract: PublicContract | null;
};

type InputLike = {
  contractSearch: string;
  strikeGrouping: "raw" | "1" | "2.5" | "5" | "10";
  maxAsk: number;
  minOi: number;
  targetSide: "all" | "call" | "put";
  sortBy: "score" | "oi" | "ask" | "dayChange" | "strike" | "delta";
};

export function TradingContractsTable({
  chain,
  inp,
  patch,
  contractWindowStart,
  setContractWindowStart,
  visibleContracts,
  visibleContractsWindow,
  strikeGroups,
  activeStrikeBucket,
  setActiveStrikeBucket,
  selectedContract,
  bestContract,
  setSelectedContractKey,
  setDrawerTab,
}: {
  chain: PublicChainData | null;
  inp: InputLike;
  patch: (p: Partial<InputLike>) => void;
  contractWindowStart: number;
  setContractWindowStart: React.Dispatch<React.SetStateAction<number>>;
  visibleContracts: PublicContract[];
  visibleContractsWindow: PublicContract[];
  strikeGroups: StrikeGroupSummary[];
  activeStrikeBucket: number | null;
  setActiveStrikeBucket: (v: number | null) => void;
  selectedContract: PublicContract | null;
  bestContract: PublicContract | null;
  setSelectedContractKey: (v: string) => void;
  setDrawerTab: (tab: "calls" | "puts" | "detail" | "greeks") => void;
}) {
  const CONTRACT_WINDOW = 40;
  return (
    <div id="trading_contracts" className="card tradingSectionCard tradingTableCard tradingIsolatedSection mt-5">
      <div className="cluster spread start">
        <div>
          <div style={{ fontWeight: 900 }}>Contracts</div>
          <div className="small">Search contracts, group strikes, then click a row to pin it into the Sniper plan and drawer.</div>
        </div>
        <div className="cluster loose">
          {isDesktop() && (
            <button onClick={() => void undockTrading("contracts", `Contracts • ${chain?.symbol || ""}`)} title="Open the contracts table in a separate window">
              Undock
            </button>
          )}
          <button className="tabBtn" onClick={() => setContractWindowStart((prev) => Math.max(0, prev - CONTRACT_WINDOW))} disabled={contractWindowStart === 0}>Prev rows</button>
          <button className="tabBtn" onClick={() => setContractWindowStart((prev) => Math.min(Math.max(0, visibleContracts.length - CONTRACT_WINDOW), prev + CONTRACT_WINDOW))} disabled={contractWindowStart + CONTRACT_WINDOW >= visibleContracts.length}>Next rows</button>
          <div className="small">Showing {visibleContractsWindow.length} of {visibleContracts.length} rows after filters</div>
        </div>
      </div>

      <div className="grid2 mt-4">
        <div className="row">
          <div style={{ flex: 1 }}>
            <label className="small">Contract search</label>
            <input value={inp.contractSearch} onChange={(e) => patch({ contractSearch: e.target.value })} placeholder="strike, OSI, call, put, expiry..." />
          </div>
          <div style={{ width: 180 }}>
            <label className="small">Strike grouping</label>
            <select value={inp.strikeGrouping} onChange={(e) => patch({ strikeGrouping: e.target.value as InputLike["strikeGrouping"] })}>
              <option value="raw">Raw contracts</option>
              <option value="1">$1 buckets</option>
              <option value="2.5">$2.50 buckets</option>
              <option value="5">$5 buckets</option>
              <option value="10">$10 buckets</option>
            </select>
          </div>
        </div>
        <div className="row">
          <div style={{ flex: 1 }}>
            <label className="small">Max ask</label>
            <input type="number" min="0" step="0.05" value={inp.maxAsk} onChange={(e) => patch({ maxAsk: Number(e.target.value || 0) })} />
          </div>
          <div style={{ flex: 1 }}>
            <label className="small">Min open interest</label>
            <input type="number" min="0" step="1" value={inp.minOi} onChange={(e) => patch({ minOi: Number(e.target.value || 0) })} />
          </div>
        </div>
        <div className="row">
          <div style={{ flex: 1 }}>
            <label className="small">Target side</label>
            <select value={inp.targetSide} onChange={(e) => patch({ targetSide: e.target.value as InputLike["targetSide"] })}>
              <option value="all">All</option>
              <option value="call">Calls</option>
              <option value="put">Puts</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label className="small">Sort</label>
            <select value={inp.sortBy} onChange={(e) => patch({ sortBy: e.target.value as InputLike["sortBy"] })}>
              <option value="score">Scanner score</option>
              <option value="oi">Open interest</option>
              <option value="ask">Lowest ask</option>
              <option value="dayChange">1D change</option>
              <option value="delta">Delta</option>
              <option value="strike">Strike</option>
            </select>
          </div>
        </div>
      </div>

      {inp.strikeGrouping !== "raw" && strikeGroups.length > 0 && (
        <div className="mt-4">
          <div className="small">Strike grouping</div>
          <div className="tabs mt-2" style={{ flexWrap: "wrap" }}>
            <button className={activeStrikeBucket === null ? "tabBtn active" : "tabBtn"} onClick={() => setActiveStrikeBucket(null)}>All groups</button>
            {strikeGroups.slice(0, 18).map((group) => (
              <button
                key={group.bucket}
                className={activeStrikeBucket === group.bucket ? "tabBtn active" : "tabBtn"}
                onClick={() => {
                  setActiveStrikeBucket(group.bucket);
                  if (group.bestContract) {
                    setSelectedContractKey(group.bestContract.key);
                    setDrawerTab(group.bestContract.side === "call" ? "calls" : "puts");
                  }
                }}
                title={`Calls ${group.callCount} • Puts ${group.putCount} • Max OI ${group.maxOi}`}
              >
                {group.label} ({group.count})
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="tableWrap tradingContractsWrap mt-4">
        <table className="dataTable">
          <thead>
            <tr>
              <th>Side</th><th>Expiry</th><th>Strike</th><th>Bid</th><th>Ask</th><th>Last</th><th>To BE</th><th>Δ</th><th>IV</th><th>Vol</th><th>OI</th><th>Score</th>
            </tr>
          </thead>
          <tbody>
            {visibleContractsWindow.map((c) => {
              const total = scanContractScore(c, { maxAsk: inp.maxAsk, minOi: inp.minOi, targetSide: inp.targetSide });
              const selected = selectedContract?.key === c.key;
              return (
                <tr key={c.key} className={`${selected ? "selected" : ""} ${bestContract && c.key === bestContract.key ? "bestRow" : ""}`} onClick={() => { setSelectedContractKey(c.key); setDrawerTab("detail"); }}>
                  <td><span className={`badge ${c.side === "call" ? "good" : "bad"}`}>{c.side.toUpperCase()}</span></td>
                  <td>{c.expiration || chain?.expirationLabel || "—"}</td>
                  <td>{c.strike.toFixed(2)}</td>
                  <td>{formatMoney(c.bid)}</td>
                  <td>{formatMoney(c.ask)}</td>
                  <td>{formatMoney(c.last)}</td>
                  <td>{formatPct(c.toBreakevenPct)}</td>
                  <td>{formatGreek(c.greeks?.delta)}</td>
                  <td>{c.greeks?.impliedVolatility !== null && c.greeks?.impliedVolatility !== undefined ? `${(c.greeks.impliedVolatility * 100).toFixed(1)}%` : "—"}</td>
                  <td>{c.volume ?? "—"}</td>
                  <td>{c.openInterest ?? "—"}</td>
                  <td>{total.toFixed(1)}</td>
                </tr>
              );
            })}
            {visibleContractsWindow.length === 0 && (
              <tr><td colSpan={12} className="small">No contracts matched your filters yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
