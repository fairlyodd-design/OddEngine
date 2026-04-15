import React, { useMemo, useState } from "react";
import { loadJSON, saveJSON } from "../lib/storage";
import { pushNotif } from "../lib/notifs";
import { PanelHeader } from "../components/PanelHeader";

type Day = {
  date: string; // YYYY-MM-DD
  pain: number; // 0-10
  hydration: number; // cups
  energy: number; // 0-10
  notes: string;
  redFlags: { fever: boolean; blood: boolean; severePain: boolean; dehydration: boolean; chestPain: boolean; confusion: boolean };
};

const KEY = "oddengine:happyhealthy:v1";

function today(){
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function HappyHealthy(){
  const [state, setState] = useState<{ entries: Day[] }>(() => loadJSON(KEY, { entries: [] }));
  const [current, setCurrent] = useState<Day>(() => ({
    date: today(),
    pain: 0,
    hydration: 0,
    energy: 5,
    notes: "",
    redFlags: { fever:false, blood:false, severePain:false, dehydration:false, chestPain:false, confusion:false }
  }));

  function saveState(next:any){
    setState(next);
    saveJSON(KEY, next);
  }

  const latest = useMemo(()=>{
    return state.entries.slice().sort((a,b)=> (a.date<b.date?1:-1))[0] || null;
  }, [state.entries]);

  function saveToday(){
    const existingIdx = state.entries.findIndex(e => e.date === current.date);
    const nextEntries = state.entries.slice();
    if(existingIdx >= 0) nextEntries[existingIdx] = current;
    else nextEntries.unshift(current);
    saveState({ entries: nextEntries });
    pushNotif({ title:"Happy Healthy", body:"Saved today’s entry.", tags:["Health"], level:"good" });
  }

  function setFlag(k: keyof Day["redFlags"], v: boolean){
    setCurrent({ ...current, redFlags: { ...current.redFlags, [k]: v } });
  }

  function anyRedFlags(e: Day){
    return Object.values(e.redFlags).some(Boolean);
  }

  return (
    <div className="card">
      <PanelHeader panelId="HappyHealthy" title="Happy Healthy" storagePrefix="oddengine:happyhealthy" />

      <div className="card" style={{marginTop:12}}>
        <div style={{fontWeight:900}}>Quick safety</div>
        <div className="small" style={{marginTop:6}}>
          If you have severe symptoms (heavy bleeding, fainting, trouble breathing, severe dehydration, confusion, chest pain, high fever),
          seek urgent care / ER. If you’re unsure, call a clinician or local nurse line.
        </div>
      </div>

      <div style={{display:"grid", gap:10, marginTop:12}}>
        <div className="card" style={{background:"rgba(8,12,18,0.35)"}}>
          <div style={{fontWeight:900}}>Headache relief (general)</div>
          <ul className="small" style={{marginTop:8, lineHeight:1.5}}>
            <li>Start with water + electrolytes, dim light, and a small snack if tolerated.</li>
            <li>If you can take it safely, acetaminophen is often preferred for people with GI inflammation; avoid NSAIDs if your clinician advised against them.</li>
            <li>Red flags: worst headache of your life, fever + stiff neck, vision changes, weakness, confusion → urgent care.</li>
          </ul>
        </div>

        <div className="card" style={{background:"rgba(8,12,18,0.35)"}}>
          <div style={{fontWeight:900}}>Flare-day basics (general)</div>
          <ul className="small" style={{marginTop:8, lineHeight:1.5}}>
            <li>Hydration first: frequent small sips + electrolytes.</li>
            <li>Simple foods if tolerated (soups, rice, toast, bananas, yogurt if ok).</li>
            <li>Rest + heat pad for comfort.</li>
            <li>Track triggers (stress, sleep, certain foods, alcohol, nicotine, caffeine).</li>
          </ul>
        </div>

        <div className="card" style={{background:"rgba(8,12,18,0.35)"}}>
          <div style={{fontWeight:900}}>Caffeine / nicotine (habit support)</div>
          <div className="small" style={{marginTop:8}}>
            If you want, use gradual tapering (reduce by ~10–25% every few days) to avoid rebound headaches/irritability.
            Track your baseline, then step down slowly.
          </div>
        </div>
      </div>

      <div className="card" style={{marginTop:12}}>
        <div style={{fontWeight:900}}>Today’s entry</div>
        <div className="small">Log symptoms + notes. Stored in your browser (localStorage).</div>

        <div className="row" style={{marginTop:10, flexWrap:"wrap"}}>
          <div style={{minWidth:160}}>
            <div className="small">Date</div>
            <input value={current.date} onChange={e=>setCurrent({ ...current, date: e.target.value })} />
          </div>
          <div style={{minWidth:160}}>
            <div className="small">Pain (0–10)</div>
            <input type="number" min={0} max={10} value={current.pain} onChange={e=>setCurrent({ ...current, pain: Number(e.target.value) })} />
          </div>
          <div style={{minWidth:160}}>
            <div className="small">Hydration (cups)</div>
            <input type="number" min={0} max={30} value={current.hydration} onChange={e=>setCurrent({ ...current, hydration: Number(e.target.value) })} />
          </div>
          <div style={{minWidth:160}}>
            <div className="small">Energy (0–10)</div>
            <input type="number" min={0} max={10} value={current.energy} onChange={e=>setCurrent({ ...current, energy: Number(e.target.value) })} />
          </div>
        </div>

        <div style={{marginTop:10}}>
          <div className="small">Notes</div>
          <textarea rows={4} value={current.notes} onChange={e=>setCurrent({ ...current, notes: e.target.value })} placeholder="What happened today? Triggers? Foods? Sleep? Meds? Stress?" />
        </div>

        <div className="card" style={{marginTop:10}}>
          <div style={{fontWeight:900}}>Red flags</div>
          <div className="small">Turn these on if present. If multiple are on, consider urgent care.</div>
          <div className="row" style={{marginTop:8, flexWrap:"wrap"}}>
            {([
              ["fever","Fever"],
              ["blood","Blood in stool"],
              ["severePain","Severe pain"],
              ["dehydration","Dehydration"],
              ["chestPain","Chest pain / trouble breathing"],
              ["confusion","Confusion / fainting"],
            ] as any).map(([k,label]: [keyof Day["redFlags"], string]) => (
              <label key={String(k)} className="row" style={{gap:8, alignItems:"center"}}>
                <input type="checkbox" checked={current.redFlags[k]} onChange={e=>setFlag(k, e.target.checked)} />
                <span className="small">{label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="row" style={{marginTop:10}}>
          <button onClick={saveToday}>Save entry</button>
          <button onClick={()=>setCurrent({ ...current, notes:"" })}>Clear notes</button>
        </div>
      </div>

      <div className="card" style={{marginTop:12}}>
        <div style={{fontWeight:900}}>History</div>
        <div className="small">Your last 30 entries.</div>

        <div style={{marginTop:10, display:"grid", gap:8}}>
          {state.entries.slice(0,30).length===0 && <div className="small">No entries yet.</div>}
          {state.entries.slice(0,30).map((e,i)=>(
            <div key={i} className="row" style={{justifyContent:"space-between", border:"1px solid var(--line)", borderRadius:12, padding:12}}>
              <div style={{maxWidth:"70%"}}>
                <div style={{fontWeight:800}}>{e.date} {anyRedFlags(e) && <span className="badge warn">Flags</span>}</div>
                <div className="small">Pain {e.pain}/10 · Hydration {e.hydration} · Energy {e.energy}/10</div>
                {e.notes && <div className="small" style={{marginTop:6, whiteSpace:"pre-wrap"}}>{e.notes}</div>}
              </div>
              <div className="row" style={{alignItems:"center"}}>
                <button onClick={()=>setCurrent(e)}>Load</button>
                <button onClick={()=>saveState({ entries: state.entries.filter((_,x)=>x!==i) })}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="small" style={{marginTop:12, opacity:0.85}}>
        Tip: If you want “rules” and reminders (hydration, meds, appointments), tell me what you want and I’ll wire a safe local reminder system into this panel.
      </div>
    </div>
  );
}
