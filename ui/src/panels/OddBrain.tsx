import React, { useEffect, useMemo, useState } from "react";
import { loadJSON, saveJSON } from "../lib/storage";
import { getAutos, saveAutos, AutoRule } from "../lib/automation";
import { pushNotif } from "../lib/notifs";
import { isDesktop } from "../lib/odd";
import { getPanelMeta, runQuickAction } from "../lib/brain";
import { getOperatorBrainSnapshot, runOperatorBrainNextAction } from "../lib/operatorBrain";

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

function mapSeedTarget(id: string) {
  return id === "grow" ? "Grow" : id === "cams" ? "Cameras" : id === "zbd" ? "CryptoGames" : id === "mining" ? "Mining" : "Home";
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
  const autos = getAutos();
  const [timeGrow, setTimeGrow] = useState("09:00");
  const [timeZbd, setTimeZbd] = useState("10:00");
  const [timeCams, setTimeCams] = useState("08:30");

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
    const score = Math.round((required.filter(i=>i.ok).length / Math.max(1, required.length)) * 100);
    return { items, score, camSkipped };
  }, [grow, cams, zbd, mining, desktop, tick, skip]);

  const operatorBrain = useMemo(() => getOperatorBrainSnapshot(), [tick, grow, cams, zbd, mining, skip, autos.length]);

  function upsertRule(id: string, title: string, hhmm: string, tags: string[], message: string, enabled: boolean){
    const list = getAutos();
    const atMinute = minuteFromHHMM(hhmm);
    const idx = list.findIndex(r=>r.id===id);
    const next: AutoRule = { id, title, enabled, atMinute, tags, message };
    if(idx>=0) list[idx] = { ...list[idx], ...next };
    else list.push(next);
    saveAutos(list);
    pushNotif({ title:"OddBrain", body:`Saved automation: ${title}`, tags:["OddBrain","Automation"], level:"success" });
    setTick((t) => t + 1);
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

  function openPanel(id: string) {
    onNavigate?.(id);
  }

  function runNextAction() {
    const result: any = runOperatorBrainNextAction();
    if (result?.panelId) openPanel(result.panelId);
    pushNotif({ title: "OddBrain", body: result?.message || "Opened next action.", tags: ["OddBrain", "Action"], level: result?.ok === false ? "warn" : "success" });
  }

  function runAction(actionId?: string, fallbackPanelId?: string) {
    if (actionId) {
      const result: any = runQuickAction(actionId);
      if (result?.panelId) openPanel(result.panelId);
      pushNotif({ title: "OddBrain", body: result?.message || "Queued action.", tags: ["OddBrain", "Action"], level: result?.ok === false ? "warn" : "success" });
      return;
    }
    if (fallbackPanelId) openPanel(fallbackPanelId);
  }

  const ruleGrow = autos.find(r=>r.id==="auto_grow") || null;
  const ruleZbd = autos.find(r=>r.id==="auto_zbd") || null;
  const ruleCams = autos.find(r=>r.id==="auto_cams") || null;

  return (
    <div className="card">
      <div className="row" style={{justifyContent:"space-between", gap: 12, flexWrap: "wrap"}}>
        <div>
          <div style={{fontSize:22,fontWeight:800}}>OddBrain</div>
          <div className="small">Single trustworthy source for what matters now across Home, Homie, and the operator lanes.</div>
        </div>
        <div className="row" style={{gap:10, flexWrap:"wrap", justifyContent:"flex-end"}}>
          <button onClick={runNextAction}>Run next action</button>
          <button onClick={() => openPanel(operatorBrain.whereToGo.panelId)}>Open {getPanelMeta(operatorBrain.whereToGo.panelId).title}</button>
          <button onClick={seedAllSamples} title="Seeds sample entries so Health can go green (editable/removable).">Quick setup</button>
          <span className={"badge "+(health.score>=75?"good":health.score>=40?"warn":"bad")}>Health {health.score}%</span>
          <label className="row small" style={{gap:8}} title="Cameras can be configured later">
            <input type="checkbox" checked={!!skip.cameras} onChange={e=>{ setSkip((s:any)=>({ ...s, cameras: e.target.checked })); setTick(t=>t+1); }} /> Skip cameras for now
          </label>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gap: 12, marginTop: 14 }}>
        <div className="card" style={{ gridColumn: "span 4", background: "rgba(8,12,18,0.35)" }}>
          <div className="small">What matters now</div>
          <div style={{ fontWeight: 900, fontSize: 18, marginTop: 6 }}>{operatorBrain.whatMattersNow.title}</div>
          <div className="small" style={{ marginTop: 8, lineHeight: 1.5 }}>{operatorBrain.whatMattersNow.text}</div>
          <div className="row" style={{ marginTop: 10, flexWrap: "wrap" }}>
            <button onClick={() => openPanel(operatorBrain.whatMattersNow.panelId)}>Open lane</button>
            {operatorBrain.whatMattersNow.actionId ? <button onClick={() => runAction(operatorBrain.whatMattersNow.actionId, operatorBrain.whatMattersNow.panelId)}>{operatorBrain.whatMattersNow.actionLabel || "Run action"}</button> : null}
          </div>
        </div>
        <div className="card" style={{ gridColumn: "span 4", background: "rgba(8,12,18,0.35)" }}>
          <div className="small">Where do I go</div>
          <div style={{ fontWeight: 900, fontSize: 18, marginTop: 6 }}>{getPanelMeta(operatorBrain.whereToGo.panelId).title}</div>
          <div className="small" style={{ marginTop: 8, lineHeight: 1.5 }}>{operatorBrain.whereToGo.text}</div>
          <div className="row" style={{ marginTop: 10, flexWrap: "wrap" }}>
            <button onClick={() => openPanel(operatorBrain.whereToGo.panelId)}>Open panel</button>
            <button onClick={runNextAction}>Follow OddBrain</button>
          </div>
        </div>
        <div className="card" style={{ gridColumn: "span 4", background: "rgba(8,12,18,0.35)" }}>
          <div className="small">What should I do next</div>
          <div style={{ fontWeight: 900, fontSize: 18, marginTop: 6 }}>{operatorBrain.whatToDoNext.actionLabel || operatorBrain.whatToDoNext.title}</div>
          <div className="small" style={{ marginTop: 8, lineHeight: 1.5 }}>{operatorBrain.whatToDoNext.text}</div>
          <div className="row" style={{ marginTop: 10, flexWrap: "wrap" }}>
            <button onClick={() => runAction(operatorBrain.whatToDoNext.actionId, operatorBrain.whatToDoNext.panelId)}>Do it</button>
            <button onClick={() => openPanel(operatorBrain.whatToDoNext.panelId)}>Open lane</button>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gap: 12, marginTop: 12 }}>
        <div className="card" style={{ gridColumn: "span 6" }}>
          <div style={{ fontWeight: 900, fontSize: 18 }}>Family lane</div>
          <div className="small" style={{ marginTop: 6 }}>{operatorBrain.familyLane.title}</div>
          <div className="small" style={{ marginTop: 8, lineHeight: 1.5 }}>{operatorBrain.familyLane.text}</div>
          <div className="row" style={{ marginTop: 10, flexWrap: "wrap" }}>
            <button onClick={() => openPanel(operatorBrain.familyLane.panelId)}>Open {getPanelMeta(operatorBrain.familyLane.panelId).title}</button>
            {operatorBrain.todayTasks[0] ? <span className="badge">{operatorBrain.todayTasks.length} task{operatorBrain.todayTasks.length === 1 ? "" : "s"} today</span> : <span className="badge">No tasks stored</span>}
          </div>
        </div>
        <div className="card" style={{ gridColumn: "span 6" }}>
          <div style={{ fontWeight: 900, fontSize: 18 }}>Operator lane</div>
          <div className="small" style={{ marginTop: 6 }}>{operatorBrain.operatorLane.title}</div>
          <div className="small" style={{ marginTop: 8, lineHeight: 1.5 }}>{operatorBrain.operatorLane.text}</div>
          <div className="row" style={{ marginTop: 10, flexWrap: "wrap" }}>
            <button onClick={() => openPanel(operatorBrain.operatorLane.panelId)}>Open {getPanelMeta(operatorBrain.operatorLane.panelId).title}</button>
            {operatorBrain.operatorLane.actionId ? <button onClick={() => runAction(operatorBrain.operatorLane.actionId, operatorBrain.operatorLane.panelId)}>{operatorBrain.operatorLane.actionLabel || "Run action"}</button> : null}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gap: 12, marginTop: 12 }}>
        <div className="card" style={{ gridColumn: "span 7" }}>
          <div style={{ fontWeight: 900, fontSize: 18 }}>Action queue</div>
          <div className="small" style={{ marginTop: 4 }}>Top recommended actions from the shared operator source.</div>
          <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
            {operatorBrain.actionQueue.length ? operatorBrain.actionQueue.slice(0, 5).map((item: any) => (
              <div key={item.id} className="card" style={{ padding: 12 }}>
                <div className="row" style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>{item.title}</div>
                    <div className="small" style={{ marginTop: 4 }}>{item.body}</div>
                  </div>
                  <span className={"badge " + (item.level === "error" ? "bad" : item.level === "warn" ? "warn" : "good")}>{getPanelMeta(item.panelId).title}</span>
                </div>
                <div className="row" style={{ marginTop: 10, flexWrap: "wrap" }}>
                  <button onClick={() => runAction(item.actionId, item.panelId)}>{item.actionLabel || "Run"}</button>
                  <button onClick={() => openPanel(item.panelId)}>Open panel</button>
                </div>
              </div>
            )) : <div className="small">No queued actions yet.</div>}
          </div>
        </div>
        <div className="card" style={{ gridColumn: "span 5" }}>
          <div style={{ fontWeight: 900, fontSize: 18 }}>Panel health</div>
          <div className="small" style={{ marginTop: 4 }}>Weakest lanes rise to the top.</div>
          <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
            {operatorBrain.panelHealth.slice(0, 6).map((item: any) => (
              <div key={item.panelId} className="card" style={{ padding: 12 }}>
                <div className="row" style={{ justifyContent: "space-between", gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>{item.icon} {item.title}</div>
                    <div className="small" style={{ marginTop: 4 }}>{item.headline}</div>
                  </div>
                  <span className={"badge " + (item.status === "error" ? "bad" : item.status === "warn" ? "warn" : "good")}>{item.score}%</span>
                </div>
                <div className="row" style={{ marginTop: 10, flexWrap: "wrap" }}>
                  <button onClick={() => openPanel(item.panelId)}>Open</button>
                  {item.nextActionId ? <button onClick={() => runAction(item.nextActionId, item.panelId)}>{item.nextActionLabel || "Run action"}</button> : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{marginTop:12, display:"grid", gap:10}}>
        {health.items.map(it => {
          const can = (!!onNavigate) && (it.id==="grow" || it.id==="cams" || it.id==="zbd" || it.id==="mining");
          const target = mapSeedTarget(it.id);
          const showSeed = (!it.ok) && (it.id==="grow"||it.id==="cams"||it.id==="zbd"||it.id==="mining");
          return (
            <div key={it.id} className="row" style={{justifyContent:"space-between", padding:"10px 12px", border:"1px solid var(--line)", borderRadius:14, gap: 12, flexWrap: "wrap"}}>
              <div>{it.label}</div>
              <div className="row" style={{gap:8, flexWrap: "wrap"}}>
                {showSeed && <button onClick={()=>seedOne(it.id)} style={{padding:"6px 10px", borderRadius:10}} title="Seed sample data">Seed</button>}
                {can && target && <button onClick={()=>openPanel(target)} style={{padding:"6px 10px", borderRadius:10}}>Open</button>}
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
          <div className="row" style={{justifyContent:"space-between", gap: 12, flexWrap: "wrap"}}>
            <div>
              <div style={{fontWeight:800}}>Daily grow check</div>
              <div className="small">Reminder + note prompt. (Runs only while app is open.)</div>
            </div>
            <div style={{width:200}}>
              <input value={timeGrow} onChange={e=>setTimeGrow(e.target.value)} />
              <div className="row" style={{marginTop:8, justifyContent:"space-between", flexWrap: "wrap"}}>
                <button onClick={()=>upsertRule("auto_grow","Grow check", timeGrow, ["Grow"], "Do your tent check: temps/RH, VPD, water, lights.", true)}>Enable</button>
                <button onClick={()=>upsertRule("auto_grow","Grow check", timeGrow, ["Grow"], "Do your tent check: temps/RH, VPD, water, lights.", false)}>Disable</button>
              </div>
              <div className="small">Currently: {ruleGrow?.enabled?"ON":"OFF"} at {ruleGrow?hhmmFromMinute(ruleGrow.atMinute):timeGrow}</div>
            </div>
          </div>
          <div className="row" style={{marginTop:10, justifyContent:"space-between", flexWrap: "wrap"}}>
            <button onClick={()=>openPanel("Grow")}>Open Grow panel</button>
            <button onClick={()=>pushNotif({ title:"OddBrain", body:"Grow check test notification", tags:["Grow","Test"], level:"info" })}>Test notif</button>
          </div>
        </div>

        <div className="card" style={{background:"rgba(8,12,18,0.45)", marginTop:10}}>
          <div className="row" style={{justifyContent:"space-between", gap: 12, flexWrap: "wrap"}}>
            <div>
              <div style={{fontWeight:800}}>Weekly ZBD refresh</div>
              <div className="small">Reminds you to open the ZBD Earn directory + add new games.</div>
            </div>
            <div style={{width:200}}>
              <input value={timeZbd} onChange={e=>setTimeZbd(e.target.value)} />
              <div className="row" style={{marginTop:8, justifyContent:"space-between", flexWrap: "wrap"}}>
                <button onClick={()=>upsertRule("auto_zbd","ZBD refresh", timeZbd, ["ZBD","CryptoGames"], "Open ZBD Earn directory and add new games to your list.", true)}>Enable</button>
                <button onClick={()=>upsertRule("auto_zbd","ZBD refresh", timeZbd, ["ZBD","CryptoGames"], "Open ZBD Earn directory and add new games to your list.", false)}>Disable</button>
              </div>
              <div className="small">Currently: {ruleZbd?.enabled?"ON":"OFF"} at {ruleZbd?hhmmFromMinute(ruleZbd.atMinute):timeZbd}</div>
            </div>
          </div>
          <div className="row" style={{marginTop:10, justifyContent:"space-between", flexWrap: "wrap"}}>
            <button onClick={()=>openPanel("CryptoGames")}>Open Crypto Games</button>
            <button onClick={()=>window.open("https://zbd.gg/z/earn","_blank")}>Open ZBD Earn</button>
          </div>
        </div>

        <div className="card" style={{background:"rgba(8,12,18,0.45)", marginTop:10}}>
          <div className="row" style={{justifyContent:"space-between", gap: 12, flexWrap: "wrap"}}>
            <div>
              <div style={{fontWeight:800}}>Camera health check</div>
              <div className="small">Pings NVR endpoints (Desktop) or reminds you (Web).</div>
            </div>
            <div style={{width:200}}>
              <input value={timeCams} onChange={e=>setTimeCams(e.target.value)} />
              <div className="row" style={{marginTop:8, justifyContent:"space-between", flexWrap: "wrap"}}>
                <button onClick={()=>upsertRule("auto_cams","Camera health", timeCams, ["Cameras"], "Check NVR/camera status + fix offline feeds.", true)}>Enable</button>
                <button onClick={()=>upsertRule("auto_cams","Camera health", timeCams, ["Cameras"], "Check NVR/camera status + fix offline feeds.", false)}>Disable</button>
              </div>
              <div className="small">Currently: {ruleCams?.enabled?"ON":"OFF"} at {ruleCams?hhmmFromMinute(ruleCams.atMinute):timeCams}</div>
            </div>
          </div>
          <div className="row" style={{marginTop:10, justifyContent:"space-between", flexWrap: "wrap"}}>
            <button onClick={()=>openPanel("Cameras")}>Open Cameras</button>
            <button onClick={()=>pushNotif({ title:"OddBrain", body: desktop ? "Desktop can ping NVR ports. Use Cameras → Test." : "Web mode: open Cameras and verify feeds.", tags:["Cameras"], level:"info" })}>What to do</button>
          </div>
        </div>
      </div>
    </div>
  );
}
