import React, { useMemo, useState } from "react";
import { loadJSON, saveJSON } from "../lib/storage";
import { pushNotif } from "../lib/notifs";
import { PanelHeader } from "../components/PanelHeader";
import ActionMenu from "../components/ActionMenu";
import { PanelScheduleCard } from "../components/PanelScheduleCard";
import { addQuickEvent, fmtDate } from "../lib/calendarStore";

type Miner = {
  id: string;
  name: string;
  algo: string;
  hashrate: number;
  unit: string;
  powerW: number;
  poolId: string;
};

type Pool = {
  id: string;
  name: string;
  coin: string;
  url: string;
  payoutThresholdSats?: number;
  notes?: string;
};

type Payout = {
  id: string;
  poolId: string;
  ts: number;
  sats: number;
  note?: string;
};

type AlertCfg = {
  noPayoutHours: number;
};

type State = {
  miners: Miner[];
  pools: Pool[];
  payouts: Payout[];
  alertCfg: AlertCfg;
};

const KEY = "oddengine:mining:v1";

function uid(prefix="id"){
  return prefix + "_" + Math.random().toString(36).slice(2,9) + "_" + Date.now().toString(36);
}

export default function Mining({ onNavigate }: { onNavigate?: (id: string) => void } = {}){
  const nav = onNavigate || (() => {});
  const [state, setState] = useState<State>(() => loadJSON(KEY, {
    miners: [],
    pools: [],
    payouts: [],
    alertCfg: { noPayoutHours: 24 },
  }));

  function save(next: State){
    setState(next);
    saveJSON(KEY, next);
  }

  const lastPayoutByPool = useMemo(() => {
    const map: Record<string, Payout> = {};
    for(const p of (state.payouts||[])){
      const cur = map[p.poolId];
      if(!cur || p.ts > cur.ts) map[p.poolId] = p;
    }
    return map;
  }, [state.payouts]);

  const alerts = useMemo(() => {
    const out: { kind: string; text: string }[] = [];
    const hrs = Math.max(1, Number(state.alertCfg?.noPayoutHours || 24));
    const cutoff = Date.now() - (hrs * 3600 * 1000);

    for(const pool of (state.pools||[])){
      const lp = lastPayoutByPool[pool.id];
      if(!lp){
        out.push({ kind:"warn", text:`No payout recorded yet for ${pool.name}.` });
        continue;
      }
      if(lp.ts < cutoff){
        const ageH = Math.round((Date.now() - lp.ts) / 360000) / 10;
        out.push({ kind:"warn", text:`${pool.name}: last payout ${ageH}h ago (>${hrs}h).` });
      }
      if(pool.payoutThresholdSats && lp.sats >= pool.payoutThresholdSats){
        out.push({ kind:"good", text:`${pool.name}: payout ${lp.sats} sats ≥ threshold ${pool.payoutThresholdSats}.` });
      }
    }

    for(const m of (state.miners||[])){
      if(!m.hashrate || m.hashrate <= 0){
        out.push({ kind:"error", text:`${m.name}: hashrate is 0 — check miner/pool.` });
      }
    }
    return out;
  }, [state.alertCfg, state.pools, state.miners, lastPayoutByPool]);

  // forms
  const [poolForm, setPoolForm] = useState<Pool>({ id:"", name:"", coin:"BTC", url:"", payoutThresholdSats: undefined, notes:"" });
  const [minerForm, setMinerForm] = useState<Miner>({ id:"", name:"", algo:"SHA-256", hashrate: 0, unit:"TH/s", powerW: 0, poolId:"" });
  const [payoutForm, setPayoutForm] = useState<{ poolId: string; sats: number; note: string }>({ poolId:"", sats: 0, note:"" });

  function seed(){
    if(state.pools.length || state.miners.length) {
      pushNotif({ title:"Mining", body:"Seed only runs when empty.", tags:["Mining"], level:"warn" });
      return;
    }
    const pool: Pool = { id: uid("pool"), name:"Foundry USA", coin:"BTC", url:"https://foundrydigital.com/pools/", payoutThresholdSats: 200000, notes:"Example pool" };
    const miner: Miner = { id: uid("miner"), name:"LuckyMiner 4TH", algo:"SHA-256", hashrate: 4, unit:"TH/s", powerW: 60, poolId: pool.id };
    save({ ...state, pools:[pool], miners:[miner], payouts:[], alertCfg: { noPayoutHours: 24 } });
    pushNotif({ title:"Mining", body:"Seeded 1 pool + 1 miner.", tags:["Mining"], level:"good" });
  }

  function clearAll(){
    save({ miners: [], pools: [], payouts: [], alertCfg: { noPayoutHours: 24 } });
    pushNotif({ title:"Mining", body:"Cleared pools/miners/payouts.", tags:["Mining"], level:"warn" });
  }

  function addPool(){
    const p: Pool = { ...poolForm, id: uid("pool") };
    if(!p.name.trim()) return;
    save({ ...state, pools:[p, ...state.pools] });
    setPoolForm({ id:"", name:"", coin:"BTC", url:"", payoutThresholdSats: undefined, notes:"" });
  }

  function addMiner(){
    const m: Miner = { ...minerForm, id: uid("miner") };
    if(!m.name.trim()) return;
    save({ ...state, miners:[m, ...state.miners] });
    setMinerForm({ id:"", name:"", algo:"SHA-256", hashrate: 0, unit:"TH/s", powerW: 0, poolId:"" });
  }

  function addPayout(){
    if(!payoutForm.poolId) return;
    const p: Payout = { id: uid("payout"), poolId: payoutForm.poolId, ts: Date.now(), sats: Number(payoutForm.sats||0), note: payoutForm.note || "" };
    save({ ...state, payouts:[p, ...state.payouts].slice(0, 500) });
    setPayoutForm({ poolId:"", sats: 0, note:"" });
  }

  function delPool(id: string){
    save({ ...state, pools: state.pools.filter(p=>p.id!==id), miners: state.miners.map(m=>m.poolId===id?{...m,poolId:""}:m), payouts: state.payouts.filter(x=>x.poolId!==id) });
  }
  function delMiner(id: string){
    save({ ...state, miners: state.miners.filter(m=>m.id!==id) });
  }
  function delPayout(id: string){
    save({ ...state, payouts: state.payouts.filter(p=>p.id!==id) });
  }

  const badges = [
    { label: `${state.miners.length} miners`, tone: state.miners.length ? "good" : "muted" as any },
    { label: `${state.pools.length} pools`, tone: state.pools.length ? "good" : "muted" as any },
    { label: `${alerts.filter(a=>a.kind!=="good").length} alerts`, tone: alerts.some(a=>a.kind==="error") ? "bad" : alerts.some(a=>a.kind==="warn") ? "warn" : "good" as any },
  ];

  return (
    <div className="page">
      <PanelHeader
        title="⛏️ Mining"
        subtitle="Miners + pools + payouts + alerts (local). Alerts also show in OddBrain."
        panelId="Mining"
        storagePrefix="oddengine:mining"
        storageActionsMode="menu"
        badges={badges as any}
        showCopilot
        rightSlot={
          <ActionMenu
            title="Mining tools"
            items={[
              { label: "Open Calendar", onClick: () => nav("Calendar") },
              { label: "Add payout check (today)", onClick: () => addQuickEvent({ title: "Mining: payout check", panelId: "Mining", date: fmtDate(new Date()), notes: "Check pool dashboard + last payout timestamps." }) },
              { label: "Seed example", onClick: seed },
              { label: "Clear all data", onClick: clearAll, tone: "danger" },
            ]}
          />
        }
      />

      <PanelScheduleCard
        panelId="Mining"
        title="Mining schedule"
        subtitle="Quick-add reminders + upcoming mining items."
        presets={[
          { label: "+ Payout check", title: "Mining: payout check", notes: "Check pool dashboard + last payout timestamps." },
          { label: "+ Hashrate check", title: "Mining: hashrate check", notes: "Verify hashrate + power draw look normal." },
          { label: "+ Weekly maintenance", title: "Mining: maintenance", offsetDays: 7, notes: "Fans, dust, firmware notes, temps." },
          { label: "+ Withdraw / sweep", title: "Mining: withdraw/sweep", offsetDays: 1, notes: "If threshold hit, sweep to wallet." },
        ]}
        onNavigate={nav}
      />

      <div className="row" style={{ gap:10, flexWrap:"wrap", alignItems:"center" }}>
        <label className="row" style={{gap:8}}>
          <span className="small">No payout alert (hours):</span>
          <input className="input" style={{width:90}} value={String(state.alertCfg.noPayoutHours)} onChange={e=>save({ ...state, alertCfg:{ ...state.alertCfg, noPayoutHours: Number(e.target.value) } })} />
        </label>
      </div>

      <div className="grid2" style={{alignItems:"start"}}>
        <div className="card softCard">
          <div style={{fontWeight:900}}>Pools</div>
          <div className="row" style={{marginTop:8, gap:8, flexWrap:"wrap"}}>
            <input className="input" style={{minWidth:160}} value={poolForm.name} onChange={e=>setPoolForm(v=>({ ...v, name:e.target.value }))} placeholder="Pool name" />
            <input className="input" style={{width:90}} value={poolForm.coin} onChange={e=>setPoolForm(v=>({ ...v, coin:e.target.value }))} placeholder="Coin" />
            <input className="input" style={{minWidth:200}} value={poolForm.url} onChange={e=>setPoolForm(v=>({ ...v, url:e.target.value }))} placeholder="Pool URL" />
            <input className="input" style={{width:140}} value={poolForm.payoutThresholdSats?String(poolForm.payoutThresholdSats):""} onChange={e=>setPoolForm(v=>({ ...v, payoutThresholdSats: e.target.value?Number(e.target.value):undefined }))} placeholder="Threshold (sats)" />
            <button onClick={addPool}>Add</button>
          </div>

          <div style={{marginTop:10, display:"grid", gap:8}}>
            {state.pools.length===0 && <div className="small">No pools yet.</div>}
            {state.pools.map(p=>(
              <div key={p.id} className="card" style={{padding:10}}>
                <div className="row" style={{justifyContent:"space-between", gap:10}}>
                  <div style={{fontWeight:800}}>{p.name} <span className="badge">{p.coin}</span></div>
                  <button className="tabBtn" onClick={()=>delPool(p.id)}>Remove</button>
                </div>
                <div className="small">{p.url || "—"}</div>
                <div className="small">Last payout: {lastPayoutByPool[p.id] ? `${lastPayoutByPool[p.id].sats} sats` : "—"}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card softCard">
          <div style={{fontWeight:900}}>Miners</div>
          <div className="row" style={{marginTop:8, gap:8, flexWrap:"wrap"}}>
            <input className="input" style={{minWidth:160}} value={minerForm.name} onChange={e=>setMinerForm(v=>({ ...v, name:e.target.value }))} placeholder="Miner name" />
            <select className="input" value={minerForm.algo} onChange={e=>setMinerForm(v=>({ ...v, algo:e.target.value }))}>
              <option>SHA-256</option>
              <option>Scrypt</option>
              <option>EtHash</option>
              <option>KHeavyHash</option>
              <option>RandomX</option>
            </select>
            <input className="input" style={{width:110}} value={String(minerForm.hashrate)} onChange={e=>setMinerForm(v=>({ ...v, hashrate: Number(e.target.value) }))} placeholder="Hashrate" />
            <input className="input" style={{width:90}} value={minerForm.unit} onChange={e=>setMinerForm(v=>({ ...v, unit:e.target.value }))} placeholder="Unit" />
            <input className="input" style={{width:90}} value={String(minerForm.powerW)} onChange={e=>setMinerForm(v=>({ ...v, powerW: Number(e.target.value) }))} placeholder="W" />
            <select className="input" value={minerForm.poolId} onChange={e=>setMinerForm(v=>({ ...v, poolId:e.target.value }))}>
              <option value="">Pool…</option>
              {state.pools.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button onClick={addMiner}>Add</button>
          </div>

          <div style={{marginTop:10, display:"grid", gap:8}}>
            {state.miners.length===0 && <div className="small">No miners yet.</div>}
            {state.miners.map(m=>(
              <div key={m.id} className="card" style={{padding:10}}>
                <div className="row" style={{justifyContent:"space-between", gap:10}}>
                  <div style={{fontWeight:800}}>{m.name}</div>
                  <button className="tabBtn" onClick={()=>delMiner(m.id)}>Remove</button>
                </div>
                <div className="small">{m.algo} • {m.hashrate} {m.unit} • {m.powerW}W • Pool: {(state.pools.find(p=>p.id===m.poolId)?.name)||"—"}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card softCard">
        <div style={{fontWeight:900}}>Payouts</div>
        <div className="row" style={{marginTop:8, gap:8, flexWrap:"wrap"}}>
          <select className="input" value={payoutForm.poolId} onChange={e=>setPayoutForm(v=>({ ...v, poolId:e.target.value }))}>
            <option value="">Pool…</option>
            {state.pools.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input className="input" style={{width:140}} value={String(payoutForm.sats)} onChange={e=>setPayoutForm(v=>({ ...v, sats: Number(e.target.value) }))} placeholder="Sats" />
          <input className="input" style={{minWidth:220}} value={payoutForm.note} onChange={e=>setPayoutForm(v=>({ ...v, note: e.target.value }))} placeholder="Note (optional)" />
          <button onClick={addPayout}>Add payout</button>
        </div>

        <div style={{marginTop:10, display:"grid", gap:8}}>
          {state.payouts.length===0 && <div className="small">No payouts recorded yet.</div>}
          {state.payouts.slice(0, 20).map(p=>(
            <div key={p.id} className="row card" style={{padding:10, justifyContent:"space-between", gap:10}}>
              <div className="small">
                <b>{(state.pools.find(x=>x.id===p.poolId)?.name)||"Pool"}</b> • {p.sats} sats • {new Date(p.ts).toLocaleString()} {p.note?`• ${p.note}`:""}
              </div>
              <button className="tabBtn" onClick={()=>delPayout(p.id)}>Remove</button>
            </div>
          ))}
        </div>
      </div>

      <div className="card softCard">
        <div style={{fontWeight:900}}>Alerts</div>
        {alerts.length===0 && <div className="small" style={{marginTop:8}}>No alerts right now.</div>}
        <div style={{marginTop:8, display:"grid", gap:6}}>
          {alerts.map((a, i)=>(
            <div key={i} className={"small " + (a.kind==="good" ? "ok" : "")}>
              {a.kind==="good" ? "✅" : a.kind==="error" ? "🛑" : "⚠️"} {a.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
