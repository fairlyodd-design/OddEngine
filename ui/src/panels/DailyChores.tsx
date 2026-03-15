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

type LaneName = "household" | "outdoor" | "animals";

const KEY = "oddengine:dailyChores:v1";
const seed = (): ChoreState => ({
  household: { title: "Household", items: [
    { id: "h1", text: "Dishes / kitchen reset", done: false },
    { id: "h2", text: "Laundry sweep", done: false },
    { id: "h3", text: "Trash + quick tidy", done: false },
  ] },
  outdoor: { title: "Outdoor", items: [
    { id: "o1", text: "Check yard / porch", done: false },
    { id: "o2", text: "Water plants or beds", done: false },
    { id: "o3", text: "Tools / bins / gates check", done: false },
  ] },
  animals: { title: "Animals", items: [
    { id: "a1", text: "Feed / water refresh", done: false },
    { id: "a2", text: "Walk / play / enrichment", done: false },
    { id: "a3", text: "Clean area / litter / waste", done: false },
  ] },
  todayNote: "",
});

const recurringTemplates: Record<LaneName, string[]> = {
  household: ["Entryway reset", "Bathroom wipe-down", "15-minute floor pickup"],
  outdoor: ["Mailbox / front gate check", "Sweep walkway", "Quick irrigation glance"],
  animals: ["Treat / meds check", "Brush / grooming minute", "Refill supplies"],
};

function uid(){ return Math.random().toString(16).slice(2)+Date.now().toString(16); }
function lanePriority(openCount: number){
  if (openCount >= 4) return "High";
  if (openCount >= 2) return "Medium";
  return "Low";
}
function laneTone(openCount: number){
  if (openCount >= 4) return "bad";
  if (openCount >= 2) return "warn";
  return "good";
}

export default function DailyChores({ onNavigate }: { onNavigate?: (id: string) => void } = {}){
  const [state, setState] = useState<ChoreState>(() => ({ ...seed(), ...loadJSON(KEY, seed()) }));
  const [drafts, setDrafts] = useState({ household:"", outdoor:"", animals:"" });
  const persist = (next: ChoreState) => { setState(next); saveJSON(KEY, next); };
  const laneOrder: LaneName[] = ["household", "outdoor", "animals"];
  const buckets = laneOrder.map((name) => ({ name, ...state[name] }));

  const total = useMemo(() => buckets.reduce((sum,b) => sum + b.items.length, 0), [state]);
  const done = useMemo(() => buckets.reduce((sum,b) => sum + b.items.filter(i => i.done).length, 0), [state]);
  const openCount = Math.max(0, total - done);
  const pct = total ? Math.round((done/total)*100) : 0;
  const todayFocus = useMemo(() => {
    const nextByLane = buckets.map((bucket) => ({
      name: bucket.name,
      title: bucket.title,
      next: bucket.items.find((item) => !item.done) || null,
      open: bucket.items.filter((item) => !item.done).length,
    }));
    const hotLane = [...nextByLane].sort((a,b) => b.open - a.open)[0];
    return { nextByLane, hotLane };
  }, [state]);

  function updateBucket(name: LaneName, bucket: Bucket){
    persist({ ...state, [name]: bucket } as ChoreState);
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
    const next: ChoreState = {
      ...state,
      household: { ...state.household, items: state.household.items.map((item) => ({ ...item, done: false })) },
      outdoor: { ...state.outdoor, items: state.outdoor.items.map((item) => ({ ...item, done: false })) },
      animals: { ...state.animals, items: state.animals.items.map((item) => ({ ...item, done: false })) },
    };
    persist(next);
  }

  return (
    <div className="page">
      <PanelHeader panelId="DailyChores" title="🧹 Daily Chores" subtitle="Household + outdoor + animals command center." storagePrefix="oddengine:dailyChores" />
      <div className="creativeHeroBand">
        <div className="creativeHeroCard choresHeroCard">
          <div className="small shellEyebrow">HOUSEHOLD OPS CENTER</div>
          <div className="creativeHeroTitle">Daily Chores Command</div>
          <div className="creativeHeroSub">Run your inside, outside, and animal-care flow from one calm board with a daily focus, recurring loops, and quick-complete actions.</div>
        </div>
      </div>

      <div className="card softCard familyCohesionCard">
        <div className="familyCohesionTop">
          <div>
            <div className="small shellEyebrow">FAMILY FLOW</div>
            <div className="familyCohesionTitle">Run the house without losing the rest of the day</div>
            <div className="small familyCohesionSub">Tie chores into meals, budget, and calendar so the household lane feels like one operating system, not four separate checklists.</div>
          </div>
          <div className="familyRouteRow">
            <button className="tabBtn" onClick={() => onNavigate?.("Home")}>Open Home</button>
            <button className="tabBtn" onClick={() => onNavigate?.("GroceryMeals")}>Meals + Grocery</button>
            <button className="tabBtn" onClick={() => onNavigate?.("FamilyBudget")}>Budget</button>
            <button className="tabBtn" onClick={() => onNavigate?.("Calendar")}>Calendar</button>
          </div>
        </div>
      </div>

      <div className="choresMetricStrip">
        <div className="card creativeMetricCard"><div className="small shellEyebrow">DONE</div><div className="groceryMetricValue">{done}</div><div className="small">{pct}% of today’s board complete.</div></div>
        <div className="card creativeMetricCard"><div className="small shellEyebrow">OPEN</div><div className="groceryMetricValue">{openCount}</div><div className="small">Tasks still waiting across all lanes.</div></div>
        <div className="card creativeMetricCard"><div className="small shellEyebrow">HOT LANE</div><div className="groceryMetricValue">{todayFocus.hotLane?.title || "Clear"}</div><div className="small">Priority: {lanePriority(todayFocus.hotLane?.open || 0)}</div></div>
        <div className="card creativeMetricCard"><div className="small shellEyebrow">RECURRING</div><div className="groceryMetricValue">3</div><div className="small">Household / outdoor / animal loops ready.</div></div>
      </div>

      <div className="choresTopGrid">
        <div className="card softCard choresFocusCard">
          <div className="row wrap" style={{ justifyContent: "space-between", gap: 10 }}>
            <div>
              <div className="small shellEyebrow">TODAY FOCUS</div>
              <div className="grocerySectionTitle">Next best actions</div>
            </div>
            <span className={`badge ${laneTone(todayFocus.hotLane?.open || 0)}`}>{todayFocus.hotLane?.title || "Clear board"}</span>
          </div>
          <div className="choresFocusList">
            {todayFocus.nextByLane.map((lane) => (
              <div key={lane.name} className="choresFocusRow">
                <div>
                  <div className="small shellEyebrow">{lane.title.toUpperCase()}</div>
                  <div className="small">{lane.next?.text || "Lane is clear."}</div>
                </div>
                <span className={`badge ${laneTone(lane.open)}`}>{lane.open} open</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card softCard choresFocusCard">
          <div className="small shellEyebrow">QUICK OPS</div>
          <div className="grocerySectionTitle">Recurring loops + reset</div>
          <div className="row wrap mt-3">
            <button className="tabBtn active" onClick={() => seedRecurring("household")}>Morning reset</button>
            <button className="tabBtn" onClick={() => seedRecurring("outdoor")}>Outdoor sweep</button>
            <button className="tabBtn" onClick={() => seedRecurring("animals")}>Animal loop</button>
            <button className="tabBtn" onClick={resetDay}>Reset day</button>
          </div>
          <div className="small mt-3" style={{ opacity: 0.82 }}>
            Add your recurring house loops in one click, then run the board lane by lane without hunting through separate lists.
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
          const laneOpen = bucket.items.filter((item) => !item.done).length;
          const laneDone = bucket.items.length - laneOpen;
          const lanePct = bucket.items.length ? Math.round((laneDone / bucket.items.length) * 100) : 0;
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
