import React, { useMemo, useState } from "react";
import { PanelHeader } from "../components/PanelHeader";
import { loadJSON, saveJSON } from "../lib/storage";

type ChoreItem = { id: string; text: string; done: boolean };
type Bucket = { title: string; items: ChoreItem[] };
type ChoreState = {
  household: Bucket;
  outdoor: Bucket;
  animals: Bucket;
  todayNote: string;
};

const KEY = "oddengine:dailyChores:v1";
const seed = (): ChoreState => ({
  household: { title: "Household", items: [
    { id: 'h1', text: 'Dishes / kitchen reset', done: false },
    { id: 'h2', text: 'Laundry sweep', done: false },
    { id: 'h3', text: 'Trash + quick tidy', done: false },
  ] },
  outdoor: { title: "Outdoor", items: [
    { id: 'o1', text: 'Check yard / porch', done: false },
    { id: 'o2', text: 'Water plants or beds', done: false },
    { id: 'o3', text: 'Tools / bins / gates check', done: false },
  ] },
  animals: { title: "Animals", items: [
    { id: 'a1', text: 'Feed / water refresh', done: false },
    { id: 'a2', text: 'Walk / play / enrichment', done: false },
    { id: 'a3', text: 'Clean area / litter / waste', done: false },
  ] },
  todayNote: '',
});
function uid(){ return Math.random().toString(16).slice(2)+Date.now().toString(16); }

export default function DailyChores(){
  const [state, setState] = useState<ChoreState>(() => ({ ...seed(), ...loadJSON(KEY, seed()) }));
  const [drafts, setDrafts] = useState({ household:'', outdoor:'', animals:'' });
  const persist = (next: ChoreState) => { setState(next); saveJSON(KEY, next); };
  const buckets = [state.household, state.outdoor, state.animals] as const;
  const total = useMemo(() => buckets.reduce((sum,b) => sum + b.items.length, 0), [state]);
  const done = useMemo(() => buckets.reduce((sum,b) => sum + b.items.filter(i => i.done).length, 0), [state]);
  const pct = total ? Math.round((done/total)*100) : 0;

  function updateBucket(name: keyof ChoreState, bucket: Bucket){
    persist({ ...state, [name]: bucket } as ChoreState);
  }
  function toggle(name: 'household'|'outdoor'|'animals', id: string){
    const bucket = state[name];
    updateBucket(name, { ...bucket, items: bucket.items.map(i => i.id===id ? { ...i, done: !i.done } : i) });
  }
  function addItem(name: 'household'|'outdoor'|'animals'){
    const text = drafts[name].trim(); if(!text) return;
    const bucket = state[name];
    updateBucket(name, { ...bucket, items: [...bucket.items, { id: uid(), text, done:false }] });
    setDrafts({ ...drafts, [name]: '' });
  }

  return (
    <div className="page">
      <PanelHeader panelId="DailyChores" title="🧹 Daily Chores" subtitle="Household + outdoor + animals command center." storagePrefix="oddengine:dailyChores" />
      <div className="creativeHeroBand">
        <div className="creativeHeroCard">
          <div className="small shellEyebrow">HOUSE OPS</div>
          <div className="creativeHeroTitle">Daily Chores Command</div>
          <div className="creativeHeroSub">One calm place to run the house: home reset, outside tasks, and animal care.</div>
        </div>
      </div>
      <div className="choresMetricStrip">
        <div className="card creativeMetricCard"><div className="small shellEyebrow">DONE</div><div className="groceryMetricValue">{done}</div><div className="small">{pct}% of the board complete.</div></div>
        <div className="card creativeMetricCard"><div className="small shellEyebrow">OPEN</div><div className="groceryMetricValue">{Math.max(0,total-done)}</div><div className="small">Tasks still waiting today.</div></div>
        <div className="card creativeMetricCard"><div className="small shellEyebrow">ANIMALS</div><div className="groceryMetricValue">{state.animals.items.filter(i=>!i.done).length}</div><div className="small">Animal-care items still open.</div></div>
        <div className="card creativeMetricCard"><div className="small shellEyebrow">NOTE</div><div className="small">{state.todayNote || 'No handoff note yet.'}</div></div>
      </div>
      <div className="card softCard mt-4">
        <div className="small shellEyebrow">TODAY NOTE</div>
        <textarea className="input mt-3" rows={3} value={state.todayNote} onChange={(e)=>persist({ ...state, todayNote: e.target.value })} placeholder="What needs special attention today?" />
      </div>
      <div className="choresGrid">
        {(['household','outdoor','animals'] as const).map((name) => {
          const bucket = state[name];
          return (
            <div key={name} className="choresCard">
              <div className="small shellEyebrow">{bucket.title.toUpperCase()}</div>
              <div className="grocerySectionTitle">{bucket.title} lane</div>
              <div style={{ marginTop: 12 }}>
                {bucket.items.map((item) => (
                  <label key={item.id} className="choresTask">
                    <input type="checkbox" checked={item.done} onChange={() => toggle(name, item.id)} />
                    <span className={item.done ? 'choresDone' : ''}>{item.text}</span>
                  </label>
                ))}
              </div>
              <div className="row wrap mt-4">
                <input className="input" style={{ flex:1, minWidth: 160 }} value={drafts[name]} onChange={(e)=>setDrafts({ ...drafts, [name]: e.target.value })} placeholder={`Add ${bucket.title.toLowerCase()} task…`} />
                <button className="tabBtn active" onClick={() => addItem(name)}>Add</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
