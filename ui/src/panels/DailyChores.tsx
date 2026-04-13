import React, { useMemo, useState } from "react";
import { PanelHeader } from "../components/PanelHeader";
import { saveJSON } from "../lib/storage";
import {
  DAILY_CHORES_EVENT,
  DAILY_CHORES_KEY,
  computeDailyChoresSnapshot,
  createDailyChoresSeed,
  lanePriority,
  laneTone,
  type DailyChoreState,
  type LaneName,
} from "../lib/dailyChoresCommand";

type ChoreItem = { id: string; text: string; done: boolean };
type Bucket = { title: string; items: ChoreItem[] };

const recurringTemplates: Record<LaneName, string[]> = {
  household: ["Entryway reset", "Bathroom wipe-down", "15-minute floor pickup"],
  outdoor: ["Mailbox / front gate check", "Sweep walkway", "Quick irrigation glance"],
  animals: ["Treat / meds check", "Brush / grooming minute", "Refill supplies"],
};

function uid(){ return Math.random().toString(16).slice(2)+Date.now().toString(16); }

export default function DailyChores(){
  const [state, setState] = useState<DailyChoreState>(() => createDailyChoresSeed());
  const [drafts, setDrafts] = useState({ household:"", outdoor:"", animals:"" });

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(DAILY_CHORES_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as DailyChoreState;
        setState({ ...createDailyChoresSeed(), ...parsed });
      }
    } catch {
      // ignore
    }
  }, []);

  const persist = (next: DailyChoreState) => {
    setState(next);
    saveJSON(DAILY_CHORES_KEY, next);
    try {
      window.dispatchEvent(new CustomEvent(DAILY_CHORES_EVENT, { detail: { ts: Date.now(), open: computeDailyChoresSnapshot(next).open } }));
    } catch {
      // ignore
    }
  };

  const laneOrder: LaneName[] = ["household", "outdoor", "animals"];
  const snapshot = useMemo(() => computeDailyChoresSnapshot(state), [state]);
  const buckets = laneOrder.map((name) => ({ name, ...state[name] }));
  const total = snapshot.total;
  const done = snapshot.done;
  const openCount = snapshot.open;
  const pct = snapshot.pct;

  function updateBucket(name: LaneName, bucket: Bucket){
    persist({ ...state, [name]: bucket } as DailyChoreState);
  }
  function toggle(name: LaneName, id: string){
    const bucket = state[name];
    updateBucket(name, { ...bucket, items: bucket.items.map(i => i.id===id ? { ...i, done: !i.done } : i) });
  }
  function addItem(name: LaneName, textOverride?: string){
    const text = (textOverride ?? drafts[name]).trim();
    if(!text) return;
    const bucket = state[name];
    const exists = bucket.items.some((item) => item.text.toLowerCase() === text.toLowerCase());
    if (exists) {
      if (!textOverride) setDrafts({ ...drafts, [name]: "" });
      return;
    }
    updateBucket(name, { ...bucket, items: [...bucket.items, { id: uid(), text, done:false }] });
    if (!textOverride) setDrafts({ ...drafts, [name]: "" });
  }
  function clearDone(name: LaneName){
    const bucket = state[name];
    updateBucket(name, { ...bucket, items: bucket.items.filter((item) => !item.done) });
  }
  function completeNext(name: LaneName){
    const bucket = state[name];
    const nextItem = bucket.items.find((item) => !item.done);
    if (!nextItem) return;
    toggle(name, nextItem.id);
  }
  function seedRecurring(name: LaneName){
    recurringTemplates[name].forEach((task) => addItem(name, task));
  }
  function resetDay(){
    const next: DailyChoreState = {
      ...state,
      household: { ...state.household, items: state.household.items.map((item) => ({ ...item, done: false })) },
      outdoor: { ...state.outdoor, items: state.outdoor.items.map((item) => ({ ...item, done: false })) },
      animals: { ...state.animals, items: state.animals.items.map((item) => ({ ...item, done: false })) },
    };
    persist(next);
  }

  return (
    <div className="page">
      <PanelHeader panelId="DailyChores" title="🧹 Daily Chores" subtitle="House reset + outdoor + animals command lane." storagePrefix="oddengine:dailyChores" />
      <div className="creativeHeroBand">
        <div className="creativeHeroCard choresHeroCard">
          <div className="small shellEyebrow">HOUSE / OUTDOOR / ANIMALS</div>
          <div className="creativeHeroTitle">Daily Chores Command</div>
          <div className="creativeHeroSub">One trustworthy board for what must happen today, what lane is hottest, and what the family should do next without hunting through separate lists.</div>
          <div className="assistantChipWrap" style={{ marginTop: 12 }}>
            <span className={`badge ${laneTone(openCount)}`}>{openCount} open</span>
            <span className="badge good">{done} done</span>
            <span className={`badge ${laneTone(snapshot.hotLane?.open || 0)}`}>Start with {snapshot.hotLane?.title || "Clear board"}</span>
          </div>
        </div>
      </div>

      <div className="choresMetricStrip">
        <div className="card creativeMetricCard"><div className="small shellEyebrow">DONE</div><div className="groceryMetricValue">{done}</div><div className="small">{pct}% of today’s board complete.</div></div>
        <div className="card creativeMetricCard"><div className="small shellEyebrow">OPEN</div><div className="groceryMetricValue">{openCount}</div><div className="small">Tasks still waiting across all lanes.</div></div>
        <div className="card creativeMetricCard"><div className="small shellEyebrow">HOT LANE</div><div className="groceryMetricValue">{snapshot.hotLane?.title || "Clear"}</div><div className="small">Priority: {lanePriority(snapshot.hotLane?.open || 0)}</div></div>
        <div className="card creativeMetricCard"><div className="small shellEyebrow">MUST DO</div><div className="groceryMetricValue">{snapshot.mustDoToday.length}</div><div className="small">Top household / outdoor / animal moves.</div></div>
      </div>

      <div className="choresTopGrid">
        <div className="card softCard choresFocusCard">
          <div className="row wrap" style={{ justifyContent: "space-between", gap: 10 }}>
            <div>
              <div className="small shellEyebrow">WHAT MATTERS TODAY</div>
              <div className="grocerySectionTitle">Must-do queue</div>
            </div>
            <span className={`badge ${laneTone(snapshot.hotLane?.open || 0)}`}>{snapshot.hotLane?.title || "Board clear"}</span>
          </div>
          <div className="choresFocusList">
            {snapshot.mustDoToday.length ? snapshot.mustDoToday.map((item) => (
              <div key={item.taskId} className="choresFocusRow">
                <div>
                  <div className="small shellEyebrow">{item.laneTitle.toUpperCase()}</div>
                  <div className="small">{item.text}</div>
                </div>
                <button className="tabBtn active" onClick={() => completeNext(item.lane)}>Done next</button>
              </div>
            )) : (
              <div className="small" style={{ opacity: 0.82 }}>The board is clear right now. Use recurring buttons or the note field to stage anything special.</div>
            )}
          </div>
        </div>

        <div className="card softCard choresFocusCard">
          <div className="small shellEyebrow">FAMILY HANDOFF</div>
          <div className="grocerySectionTitle">What to do next</div>
          <div className="timelineCard" style={{ marginTop: 12 }}>{snapshot.summary}</div>
          <div className="timelineCard" style={{ marginTop: 10 }}>{snapshot.familyDirection}</div>
          <div className="row wrap mt-3">
            <button className="tabBtn active" onClick={() => seedRecurring("household")}>House reset</button>
            <button className="tabBtn" onClick={() => seedRecurring("outdoor")}>Outdoor sweep</button>
            <button className="tabBtn" onClick={() => seedRecurring("animals")}>Animal loop</button>
            <button className="tabBtn" onClick={resetDay}>Reset day</button>
          </div>
          <div className="small mt-3" style={{ opacity: 0.82 }}>
            This board is the calm source of truth for the family: start with the hot lane, clear one next-step per lane, then close the day out.
          </div>
        </div>
      </div>

      <div className="card softCard mt-4">
        <div className="small shellEyebrow">TODAY NOTE</div>
        <textarea className="input mt-3" rows={3} value={state.todayNote} onChange={(e)=>persist({ ...state, todayNote: e.target.value })} placeholder="What needs special attention today?" />
      </div>

      <div className="choresGrid">
        {laneOrder.map((name) => {
          const bucket = state[name];
          const laneSnapshot = snapshot.lanes.find((lane) => lane.name === name);
          const laneOpen = laneSnapshot?.open || 0;
          const lanePct = laneSnapshot?.pct || 0;
          return (
            <div key={name} className="choresCard">
              <div className="row wrap" style={{ justifyContent: "space-between", gap: 10 }}>
                <div>
                  <div className="small shellEyebrow">{bucket.title.toUpperCase()}</div>
                  <div className="grocerySectionTitle">{bucket.title} lane</div>
                </div>
                <div className="row wrap" style={{ gap: 8 }}>
                  <span className={`badge ${laneTone(laneOpen)}`}>{lanePriority(laneOpen)}</span>
                  <span className="badge">{lanePct}% done</span>
                </div>
              </div>
              <div className="choresProgress mt-3"><span style={{ width: `${lanePct}%` }} /></div>
              <div className="small mt-3" style={{ opacity: 0.82 }}>
                {laneSnapshot?.next ? `Next up: ${laneSnapshot.next.text}` : "This lane is clear right now."}
              </div>
              <div className="row wrap mt-3" style={{ gap: 8 }}>
                <button className="tabBtn active" onClick={() => completeNext(name)}>Complete next</button>
                <button className="tabBtn" onClick={() => seedRecurring(name)}>Add recurring</button>
                <button className="tabBtn" onClick={() => clearDone(name)}>Clear done</button>
              </div>
              <div style={{ marginTop: 12 }}>
                {bucket.items.map((item) => (
                  <label key={item.id} className="choresTask">
                    <input type="checkbox" checked={item.done} onChange={() => toggle(name, item.id)} />
                    <span className={item.done ? "choresDone" : ""}>{item.text}</span>
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
