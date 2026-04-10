import React, { useEffect, useMemo, useState } from "react";
import { loadJSON, saveJSON } from "../lib/storage";
import { getAutos, saveAutos, AutoRule } from "../lib/automation";
import { pushNotif } from "../lib/notifs";
import { isDesktop } from "../lib/odd";

type Props = { onNavigate?: (id: string) => void };

function minuteFromHHMM(v: string){
  const [h,m] = v.split(":").map(Number);
  return (h*60) + m;
}
function hhmmFromMinute(min: number){
  const h = Math.floor(min/60);
  const m = min%60;
  return String(h).padStart(2,"0")+":"+String(m).padStart(2,"0");
}

const GROW_KEY="oddengine:grow:profile";
const CAM_KEY="oddengine:cameras:v1";
const ZBD_KEY="oddengine:cryptoGames:v2";
const MIN_KEY="oddengine:mining:v1";
const SKIP_KEY="oddengine:oddbrain:skip:v1";

function seedGrowSample(){
  const cur = loadJSON<any>(GROW_KEY, null);
  if(cur) return;
  saveJSON(GROW_KEY, { name:"My Tent / Grow Room", size:"2x4", stage:"veg", lightsOn:"06:00", lightsOff:"00:00", notes:"Seeded sample profile. Edit any time." });
}

function seedCamerasSample(){
  const cur:any = loadJSON(CAM_KEY, { nvrs:[], cameras:[], wall:{ grid:"4x3", page:0, live:true } });
  if((cur.cameras?.length||0) > 0) return;
  const cams = Array.from({length:12}).map((_,i)=>({ id:`cam_${i+1}`, name:`Cam ${i+1}`, url:"", nvrHost:"", enabled:true }));
  saveJSON(CAM_KEY, { ...cur, cameras: cams, nvrs: cur.nvrs||[], wall: cur.wall || { grid:"4x3", page:0, live:true } });
}

function seedZbdSample(){
  const cur:any = loadJSON(ZBD_KEY, { games:[], preferredEmuId:"auto" });
  if((cur.games?.length||0) > 0) return;
  const defaults = [
    { name:"Bitcoin Miner: Idle Tycoon", platform:"ZBD", packageId:"com.fumbgames.bitcoinminor", url:"https://zbd.gg/z/earn?gameName=Bitcoin%20Miner", iosUrl:"https://apps.apple.com/us/app/bitcoin-miner-idle-tycoon/id1413770650", notes:"Seeded example." },
    { name:"ZBD Earn hub", platform:"ZBD", url:"https://zbd.gg/z/earn", notes:"Official earn hub." },
  ];
  saveJSON(ZBD_KEY, { ...cur, games: defaults });
}

function seedMiningSample(){
  const cur:any = loadJSON(MIN_KEY, { miners:[], pools:[], payouts:[], alertCfg:{ noPayoutHours:24 } });
  if((cur.pools?.length||0) > 0 || (cur.miners?.length||0) > 0) return;
  const pool = { id:"pool_seed", name:"Foundry USA", coin:"BTC", url:"https://foundrydigital.com/pools/", payoutThresholdSats: 200000 };
  const miner = { id:"miner_seed", name:"LuckyMiner 4TH", algo:"SHA-256", hashrate: 4, unit:"TH/s", powerW: 60, poolId: pool.id };
  saveJSON(MIN_KEY, { miners:[miner], pools:[pool], payouts:[], alertCfg:{ noPayoutHours:24 } });
}

function computeMiningAlerts(mining: any){
  const pools = mining?.pools || [];
  const payouts = mining?.payouts || [];
  const miners = mining?.miners || [];
  const hrs = Math.max(1, Number(mining?.alertCfg?.noPayoutHours || 24));
  const cutoff = Date.now() - (hrs * 3600 * 1000);
  const last: Record<string, any> = {};
  for(const p of payouts){
    const cur = last[p.poolId];
    if(!cur || p.ts > cur.ts) last[p.poolId] = p;
  }
  const out: string[] = [];
  for(const pool of pools){
    const lp = last[pool.id];
    if(!lp){ out.push(`No payout recorded yet for ${pool.name}.`); continue; }
    if(lp.ts < cutoff){ out.push(`${pool.name}: last payout older than ${hrs}h.`); }
  }
  for(const m of miners){
    if(!m.hashrate || m.hashrate<=0){ out.push(`${m.name}: hashrate is 0.`); }
  }
  return out;
}

export default function OddBrain({ onNavigate }: Props){
  const desktop = isDesktop();
  const [tick, setTick] = useState(0);

  const grow = loadJSON<any>(GROW_KEY, null);
  const cams = loadJSON<any>(CAM_KEY, { nvrs:[], cameras:[], wall:{ grid:"4x3", page:0, live:true } });
  const zbd = loadJSON<any>(ZBD_KEY, { games:[] });
  const mining = loadJSON<any>(MIN_KEY, { miners:[], pools:[], payouts:[], alertCfg:{ noPayoutHours:24 } });

  const [skip, setSkip] = useState(() => loadJSON<any>(SKIP_KEY, { cameras:false }));
  useEffect(()=>{ try{ saveJSON(SKIP_KEY, skip); }catch(e){} }, [skip]);

  const miningAlerts = useMemo(()=>computeMiningAlerts(mining), [mining, tick]);

  const health = useMemo(() => {
    const camOk = (cams.cameras?.length||0) > 0;
    const camSkipped = !!skip.cameras;
    const minOk = ((mining.miners?.length||0) + (mining.pools?.length||0)) > 0;

    const items = [
      { id:"grow", label:"Grow tent configured", ok: !!grow },
      { id:"zbd", label:"Crypto games list seeded", ok: (zbd.games?.length||0) > 0 },
      { id:"mining", label:"Mining configured (miners/pools)", ok: minOk },
      { id:"cams", label: camSkipped ? "Cameras configured (skipped for now)" : "Cameras configured", ok: camSkipped ? true : camOk, optional:true },
      { id:"desktop", label:"Desktop mode available for disk + logs", ok: desktop },
    ];

    const required = items.filter(i => !(i.id==="cams" && camSkipped));
    const score = Math.round((required.filter(i=>i.ok).length / required.length) * 100);
    return { items, score, camSkipped };
  }, [grow, cams, zbd, mining, desktop, tick, skip]);

  const autos = getAutos();
  const [timeGrow, setTimeGrow] = useState("09:00");
  const [timeZbd, setTimeZbd] = useState("10:00");
  const [timeCams, setTimeCams] = useState("08:30");

  function upsertRule(id: string, title: string, hhmm: string, tags: string[], message: string, enabled: boolean){
    const list = getAutos();
    const atMinute = minuteFromHHMM(hhmm);
    const idx = list.findIndex(r=>r.id===id);
    const next: AutoRule = { id, title, enabled, atMinute, tags, message };
    if(idx>=0) list[idx] = { ...list[idx], ...next };
    else list.push(next);
    saveAutos(list);
    pushNotif({ title:"OddBrain", body:`Saved automation: ${title}`, tags:["OddBrain","Automation"], level:"success" });
  }

  function seedAllSamples(){
    try{
      if(!grow) seedGrowSample();
      if((cams.cameras?.length||0)===0) seedCamerasSample();
      if((zbd.games?.length||0)===0) seedZbdSample();
      seedMiningSample();
      pushNotif({ title:"OddBrain", body:"Seeded sample setup. You can edit/remove in each panel anytime.", tags:["OddBrain"], level:"success" });
      setTick(t => t+1);
    }catch(e:any){
      pushNotif({ title:"OddBrain", body:e?.message || "Seed failed.", tags:["OddBrain"], level:"error" });
    }
  }

  function seedOne(id: string){
    try{
      if(id==="grow") seedGrowSample();
      if(id==="cams") seedCamerasSample();
      if(id==="zbd") seedZbdSample();
      if(id==="mining") seedMiningSample();
      pushNotif({ title:"OddBrain", body:"Seeded sample data.", tags:["OddBrain"], level:"success" });
      setTick(t => t+1);
    }catch(e:any){
      pushNotif({ title:"OddBrain", body:e?.message || "Seed failed.", tags:["OddBrain"], level:"error" });
    }
  }

  const ruleGrow = autos.find(r=>r.id==="auto_grow") || null;
  const ruleZbd = autos.find(r=>r.id==="auto_zbd") || null;
  const ruleCams = autos.find(r=>r.id==="auto_cams") || null;

  return (
    <div className="card">
      <div className="row" style={{justifyContent:"space-between"}}>
        <div>
          <div style={{fontSize:22,fontWeight:800}}>OddBrain</div>
          <div className="small">Master health AI (local). Keeps setup + integrity tight.</div>
        </div>
        <div className="row" style={{gap:10, flexWrap:"wrap", justifyContent:"flex-end"}}>
          <button onClick={seedAllSamples} title="Seeds sample entries so Health can go green (editable/removable).">Quick setup</button>
          <span className={"badge "+(health.score>=75?"good":health.score>=40?"warn":"bad")}>Health {health.score}%</span>
          <label className="row small" style={{gap:8}} title="Cameras can be configured later">
            <input type="checkbox" checked={!!skip.cameras} onChange={e=>{ setSkip((s:any)=>({ ...s, cameras: e.target.checked })); setTick(t=>t+1); }} /> Skip cameras for now
          </label>
        </div>
      </div>

      <div style={{marginTop:12, display:"grid", gap:10}}>
        {health.items.map(it => {
          const can = (!!onNavigate) && (it.id==="grow" || it.id==="cams" || it.id==="zbd" || it.id==="mining");
          const target = it.id==="grow" ? "Grow" : it.id==="cams" ? "Cameras" : it.id==="zbd" ? "CryptoGames" : it.id==="mining" ? "Mining" : "";
          const showSeed = (!it.ok) && (it.id==="grow"||it.id==="cams"||it.id==="zbd"||it.id==="mining");
          return (
            <div key={it.id} className="row" style={{justifyContent:"space-between", padding:"10px 12px", border:"1px solid var(--line)", borderRadius:14}}>
              <div>{it.label}</div>
              <div className="row" style={{gap:8}}>
                {showSeed && <button onClick={()=>seedOne(it.id)} style={{padding:"6px 10px", borderRadius:10}} title="Seed sample data">Seed</button>}
                {can && target && <button onClick={()=>onNavigate?.(target)} style={{padding:"6px 10px", borderRadius:10}}>Open</button>}
                <span className={"badge "+(it.ok?"good":"bad")}>{it.ok?"OK":"Needs setup"}</span>
              </div>
            </div>
          );
        })}
      </div>

      {miningAlerts.length>0 && (
        <div style={{marginTop:12}} className="card">
          <div style={{fontWeight:800}}>Mining alerts</div>
          <div className="small" style={{marginTop:8, display:"grid", gap:6}}>
            {miningAlerts.slice(0,8).map((t,i)=>(<div key={i}>! {t}</div>))}
          </div>
        </div>
      )}

      <div style={{marginTop:14}}>
        <div style={{fontWeight:800, marginBottom:8}}>Automation starters</div>

        <div className="card" style={{background:"rgba(8,12,18,0.45)"}}>
          <div className="row" style={{justifyContent:"space-between"}}>
            <div>
              <div style={{fontWeight:800}}>Daily grow check</div>
              <div className="small">Reminder + note prompt. (Runs only while app is open.)</div>
            </div>
            <div style={{width:200}}>
              <input value={timeGrow} onChange={e=>setTimeGrow(e.target.value)} />
              <div className="row" style={{marginTop:8, justifyContent:"space-between"}}>
                <button onClick={()=>upsertRule("auto_grow","Grow check", timeGrow, ["Grow"], "Do your tent check: temps/RH, VPD, water, lights.", true)}>Enable</button>
                <button onClick={()=>upsertRule("auto_grow","Grow check", timeGrow, ["Grow"], "Do your tent check: temps/RH, VPD, water, lights.", false)}>Disable</button>
              </div>
              <div className="small">Currently: {ruleGrow?.enabled?"ON":"OFF"} at {ruleGrow?hhmmFromMinute(ruleGrow.atMinute):timeGrow}</div>
            </div>
          </div>
          <div className="row" style={{marginTop:10, justifyContent:"space-between"}}>
            <button onClick={()=>onNavigate?.("Grow")}>Open Grow panel</button>
            <button onClick={()=>pushNotif({ title:"OddBrain", body:"Grow check test notification", tags:["Grow","Test"], level:"info" })}>Test notif</button>
          </div>
        </div>

        <div className="card" style={{background:"rgba(8,12,18,0.45)", marginTop:10}}>
          <div className="row" style={{justifyContent:"space-between"}}>
            <div>
              <div style={{fontWeight:800}}>Weekly ZBD refresh</div>
              <div className="small">Reminds you to open the ZBD Earn directory + add new games.</div>
            </div>
            <div style={{width:200}}>
              <input value={timeZbd} onChange={e=>setTimeZbd(e.target.value)} />
              <div className="row" style={{marginTop:8, justifyContent:"space-between"}}>
                <button onClick={()=>upsertRule("auto_zbd","ZBD refresh", timeZbd, ["ZBD","CryptoGames"], "Open ZBD Earn directory and add new games to your list.", true)}>Enable</button>
                <button onClick={()=>upsertRule("auto_zbd","ZBD refresh", timeZbd, ["ZBD","CryptoGames"], "Open ZBD Earn directory and add new games to your list.", false)}>Disable</button>
              </div>
              <div className="small">Currently: {ruleZbd?.enabled?"ON":"OFF"} at {ruleZbd?hhmmFromMinute(ruleZbd.atMinute):timeZbd}</div>
            </div>
          </div>
          <div className="row" style={{marginTop:10, justifyContent:"space-between"}}>
            <button onClick={()=>onNavigate?.("CryptoGames")}>Open Crypto Games</button>
            <button onClick={()=>window.open("https://zbd.gg/z/earn","_blank")}>Open ZBD Earn</button>
          </div>
        </div>

        <div className="card" style={{background:"rgba(8,12,18,0.45)", marginTop:10}}>
          <div className="row" style={{justifyContent:"space-between"}}>
            <div>
              <div style={{fontWeight:800}}>Camera health check</div>
              <div className="small">Pings NVR endpoints (Desktop) or reminds you (Web).</div>
            </div>
            <div style={{width:200}}>
              <input value={timeCams} onChange={e=>setTimeCams(e.target.value)} />
              <div className="row" style={{marginTop:8, justifyContent:"space-between"}}>
                <button onClick={()=>upsertRule("auto_cams","Camera health", timeCams, ["Cameras"], "Check NVR/camera status + fix offline feeds.", true)}>Enable</button>
                <button onClick={()=>upsertRule("auto_cams","Camera health", timeCams, ["Cameras"], "Check NVR/camera status + fix offline feeds.", false)}>Disable</button>
              </div>
              <div className="small">Currently: {ruleCams?.enabled?"ON":"OFF"} at {ruleCams?hhmmFromMinute(ruleCams.atMinute):timeCams}</div>
            </div>
          </div>
          <div className="row" style={{marginTop:10, justifyContent:"space-between"}}>
            <button onClick={()=>onNavigate?.("Cameras")}>Open Cameras</button>
            <button onClick={()=>pushNotif({ title:"OddBrain", body: desktop ? "Desktop can ping NVR ports. Use Cameras → Test." : "Web mode: open Cameras and verify feeds.", tags:["Cameras"], level:"info" })}>What to do</button>
          </div>
        </div>
      </div>

      <div style={{marginTop:14}}>
        <div style={{fontWeight:800, marginBottom:8}}>AI instances (ROI tiers)</div>
        <div style={{display:"grid", gap:10}}>
          <div className="card">
            <div style={{fontWeight:900}}>🥇 Tier 1 — Core Money Engines</div>
            <div className="small">Trading dashboards + signals • Crypto/mining tools • Affiliate websites</div>
            <div className="row" style={{marginTop:10, flexWrap:"wrap"}}>
              <button onClick={()=>onNavigate?.("Trading")}>Open Trading</button>
              <button onClick={()=>onNavigate?.("Autopilot")}>Open Autopilot</button>
              <button onClick={()=>onNavigate?.("Mining")}>Open Mining</button>
            </div>
          </div>
          <div className="card">
            <div style={{fontWeight:900}}>🥈 Tier 2 — Scalable Products</div>
            <div className="small">Digital products • AI tools/dashboards • SaaS micro-app scaffolds</div>
            <div className="row" style={{marginTop:10, flexWrap:"wrap"}}>
              <button onClick={()=>onNavigate?.("OptionsSaaS")}>Open Options SaaS</button>
              <button onClick={()=>onNavigate?.("Builder")}>Open Builder</button>
              <button onClick={()=>onNavigate?.("Money")}>Open Money</button>
            </div>
          </div>
          <div className="card">
            <div style={{fontWeight:900}}>🥉 Tier 3 — Brand Ecosystem</div>
            <div className="small">Grow / cannabis tools — strengthens your niche identity</div>
            <div className="row" style={{marginTop:10, flexWrap:"wrap"}}>
              <button onClick={()=>onNavigate?.("Grow")}>Open Grow</button>
              <button onClick={()=>onNavigate?.("Brain")}>UI-only Brain</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
