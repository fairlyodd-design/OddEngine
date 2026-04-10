
import React, { useEffect, useMemo, useState } from "react";
import { probeAnalytics, fetchRevenue, RevenueRecord } from "../lib/publisherAnalyticsBridge";

export default function RevenueAnalyticsPanel() {
  const [status, setStatus] = useState<any>({ok:false, status:"unknown"});
  const [rows, setRows] = useState<RevenueRecord[]>([]);
  const [error, setError] = useState<string>("");

  useEffect(()=>{ refresh(); },[]);

  async function refresh(){
    try{
      setStatus(await probeAnalytics());
      const r = await fetchRevenue();
      setRows(r);
      setError("");
    }catch(e:any){
      setError(String(e?.message||e));
      setRows([]);
    }
  }

  const totals = useMemo(()=>{
    return rows.reduce((acc, r)=>{
      acc.revenue += Number(r.revenue||0);
      acc.views += Number(r.views||0);
      acc.clicks += Number(r.clicks||0);
      acc.conversions += Number(r.conversions||0);
      return acc;
    }, {revenue:0, views:0, clicks:0, conversions:0});
  },[rows]);

  return (
    <div style={{padding:12, color:"#eaf5ff"}}>
      <h3>💰 Revenue & Publisher Analytics</h3>
      <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
        <button onClick={refresh}>Refresh</button>
        <div>Status: <b>{status.status}</b>{status.detail?` • ${status.detail}`:""}</div>
      </div>

      <div style={{marginTop:10, display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:10}}>
        <Stat label="Revenue" value={`$${totals.revenue.toFixed(2)}`} />
        <Stat label="Views" value={totals.views} />
        <Stat label="Clicks" value={totals.clicks} />
        <Stat label="Conversions" value={totals.conversions} />
      </div>

      {error && <div style={{marginTop:10, color:"#ff9a9a"}}>{error}</div>}

      <div style={{marginTop:12, display:"grid", gap:8}}>
        {rows.length ? rows.map(r=>(
          <div key={r.id} style={card}>
            <div><b>{r.title || r.id}</b> • {r.provider}</div>
            <div style={{opacity:.8}}>
              views {r.views||0} • clicks {r.clicks||0} • conv {r.conversions||0} • rev ${Number(r.revenue||0).toFixed(2)}
            </div>
          </div>
        )) : <div style={{opacity:.7}}>No analytics yet.</div>}
      </div>
    </div>
  );
}

function Stat({label, value}:{label:string; value:any}){
  return (
    <div style={{border:"1px solid rgba(120,180,255,.18)", borderRadius:12, padding:12, background:"rgba(10,16,28,.82)"}}>
      <div style={{opacity:.7}}>{label}</div>
      <div style={{fontSize:18, fontWeight:800}}>{value}</div>
    </div>
  );
}

const card: React.CSSProperties = {
  border:"1px solid rgba(120,180,255,.18)",
  borderRadius:12,
  padding:10,
  background:"rgba(10,16,28,.82)"
};
