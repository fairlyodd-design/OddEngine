import React, { useMemo, useState } from "react";
import { loadJSON, saveJSON } from "../lib/storage";
import { pushNotif } from "../lib/notifs";
import { PanelHeader } from "../components/PanelHeader";

type Day = {
  date: string;
  pain: number;
  hydration: number;
  energy: number;
  notes: string;
  redFlags: { fever: boolean; blood: boolean; severePain: boolean; dehydration: boolean; chestPain: boolean; confusion: boolean };
};

const KEY = "oddengine:happyhealthy:v1";

function today() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function redFlagCount(entry: Day) {
  return Object.values(entry.redFlags).filter(Boolean).length;
}

export default function HappyHealthy() {
  const [state, setState] = useState<{ entries: Day[] }>(() => loadJSON(KEY, { entries: [] }));
  const [current, setCurrent] = useState<Day>(() => ({
    date: today(),
    pain: 0,
    hydration: 0,
    energy: 5,
    notes: "",
    redFlags: { fever: false, blood: false, severePain: false, dehydration: false, chestPain: false, confusion: false }
  }));

  function saveState(next: any) {
    setState(next);
    saveJSON(KEY, next);
  }

  const latest = useMemo(() => state.entries.slice().sort((a, b) => (a.date < b.date ? 1 : -1))[0] || null, [state.entries]);

  const metrics = useMemo(() => {
    const entries = state.entries.slice(0, 7);
    const avgPain = entries.length ? (entries.reduce((sum, e) => sum + e.pain, 0) / entries.length).toFixed(1) : "—";
    const avgHydration = entries.length ? (entries.reduce((sum, e) => sum + e.hydration, 0) / entries.length).toFixed(1) : "—";
    const avgEnergy = entries.length ? (entries.reduce((sum, e) => sum + e.energy, 0) / entries.length).toFixed(1) : "—";
    const flagsThisWeek = entries.reduce((sum, e) => sum + redFlagCount(e), 0);
    return { avgPain, avgHydration, avgEnergy, flagsThisWeek };
  }, [state.entries]);

  function saveToday() {
    const existingIdx = state.entries.findIndex((e) => e.date === current.date);
    const nextEntries = state.entries.slice();
    if (existingIdx >= 0) nextEntries[existingIdx] = current;
    else nextEntries.unshift(current);
    saveState({ entries: nextEntries });
    pushNotif({ title: "Happy Healthy", body: "Saved today’s entry.", tags: ["Health"], level: "good" });
  }

  function setFlag(k: keyof Day["redFlags"], v: boolean) {
    setCurrent({ ...current, redFlags: { ...current.redFlags, [k]: v } });
  }

  const currentFlags = redFlagCount(current);
  const latestFlags = latest ? redFlagCount(latest) : 0;

  return (
    <div className="card happyHealthyRoot">
      <PanelHeader panelId="HappyHealthy" title="Happy Healthy" storagePrefix="oddengine:happyhealthy" />

      <div className="happyHeroBar mt-3">
        <div>
          <div className="small shellEyebrow">HEALTH COMMAND CENTER</div>
          <div className="happyHeroTitle">Happy Healthy</div>
          <div className="happyHeroSub">
            Track symptoms, protect hydration, log flare-day notes, and keep a calmer daily snapshot right inside your OS.
          </div>
        </div>
        <div className="happyHeroBadges row wrap" style={{ justifyContent: "flex-end" }}>
          <span className={`badge ${currentFlags > 0 ? "warn" : "good"}`}>{currentFlags > 0 ? `${currentFlags} current flag${currentFlags === 1 ? "" : "s"}` : "No current flags"}</span>
          <span className="badge">Latest {latest?.date || "No entry yet"}</span>
          <span className={`badge ${latestFlags > 0 ? "warn" : "good"}`}>{latestFlags > 0 ? `Last entry flagged` : "Last entry stable"}</span>
          <span className="badge">Stored locally</span>
        </div>
      </div>

      <div className="happyMetricStrip">
        <div className="card happyMetricCard">
          <div className="small shellEyebrow">7-DAY PAIN</div>
          <div className="happyMetricValue">{metrics.avgPain}</div>
          <div className="small">Average pain level logged across recent entries.</div>
        </div>
        <div className="card happyMetricCard">
          <div className="small shellEyebrow">7-DAY HYDRATION</div>
          <div className="happyMetricValue">{metrics.avgHydration}</div>
          <div className="small">Average cups tracked per logged day.</div>
        </div>
        <div className="card happyMetricCard">
          <div className="small shellEyebrow">7-DAY ENERGY</div>
          <div className="happyMetricValue">{metrics.avgEnergy}</div>
          <div className="small">Energy trend for pacing the day and recovery.</div>
        </div>
        <div className="card happyMetricCard">
          <div className="small shellEyebrow">FLAGS THIS WEEK</div>
          <div className="happyMetricValue">{metrics.flagsThisWeek}</div>
          <div className="small">Use this as a signal to escalate care sooner when needed.</div>
        </div>
      </div>

      <div className="spotlightGrid happyFollowupGrid mt-4">
        <div className="card spotlightCard happyFollowupCard">
          <div className="small shellEyebrow">TODAY'S FOCUS</div>
          <div style={{ fontWeight: 900, fontSize: 18, marginTop: 6 }}>{current.pain >= 7 ? "Protect the day" : current.energy >= 7 ? "Use the energy window" : "Keep the pace gentle"}</div>
          <div className="small" style={{ marginTop: 8, lineHeight: 1.55 }}>Pain {current.pain}/10 • Hydration {current.hydration} cups • Energy {current.energy}/10. Build the day around what your body is actually saying right now.</div>
        </div>
        <div className="card spotlightCard happyFollowupCard">
          <div className="small shellEyebrow">RECOVERY SIGNAL</div>
          <div style={{ fontWeight: 900, fontSize: 18, marginTop: 6 }}>{Number(metrics.avgHydration || 0) >= 6 ? "Hydration lane improving" : "Hydration needs attention"}</div>
          <div className="small" style={{ marginTop: 8, lineHeight: 1.55 }}>Use the history lane to spot when hydration, energy, and pain move together so you can adjust earlier, not later.</div>
        </div>
      </div>

      <div className="spotlightGrid mt-4">
        <div className="card spotlightCard happySafetyCard">
          <div className="small shellEyebrow">QUICK SAFETY</div>
          <div style={{ fontWeight: 900, fontSize: 18, marginTop: 6 }}>Know when to escalate</div>
          <div className="small" style={{ marginTop: 8, lineHeight: 1.55 }}>
            If you have heavy bleeding, fainting, trouble breathing, severe dehydration, confusion, chest pain, or a high fever,
            seek urgent care / ER. If you’re unsure, call a clinician or nurse line.
          </div>
        </div>
        <div className="card spotlightCard happySafetyCard">
          <div className="small shellEyebrow">TODAY’S READOUT</div>
          <div style={{ fontWeight: 900, fontSize: 18, marginTop: 6 }}>
            Pain {current.pain}/10 • Hydration {current.hydration} • Energy {current.energy}/10
          </div>
          <div className="small" style={{ marginTop: 8, lineHeight: 1.55 }}>
            Best move: prioritize fluids, simple food if tolerated, rest, and use the notes box to track what changed today.
          </div>
        </div>
      </div>

      <div className="happyGuideGrid mt-4">
        <div className="card happyGuideCard">
          <div className="small shellEyebrow">HEADACHE RELIEF</div>
          <div className="happyGuideTitle">General relief checklist</div>
          <ul className="small happyList">
            <li>Start with water + electrolytes, dim light, and a small snack if tolerated.</li>
            <li>Acetaminophen is often preferred when NSAIDs are not advised for GI inflammation.</li>
            <li>Worst-ever headache, fever + stiff neck, confusion, or vision change = urgent care.</li>
          </ul>
        </div>
        <div className="card happyGuideCard">
          <div className="small shellEyebrow">FLARE-DAY BASICS</div>
          <div className="happyGuideTitle">Protect the day</div>
          <ul className="small happyList">
            <li>Hydration first: frequent small sips + electrolytes.</li>
            <li>Simple foods if tolerated: soups, rice, toast, bananas, yogurt if okay.</li>
            <li>Track stress, sleep, food, caffeine, nicotine, and other trigger patterns.</li>
          </ul>
        </div>
        <div className="card happyGuideCard">
          <div className="small shellEyebrow">HABIT SUPPORT</div>
          <div className="happyGuideTitle">Ease tapering</div>
          <div className="small" style={{ marginTop: 8, lineHeight: 1.55 }}>
            If you want to reduce caffeine or nicotine, a gradual taper of roughly 10–25% every few days can reduce rebound headaches and irritability.
          </div>
        </div>
      </div>

      <div className="card happySectionCard mt-4">
        <div className="small shellEyebrow">DAILY ENTRY</div>
        <div className="happySectionTitle">Today’s check-in</div>
        <div className="small">Log symptoms + notes. Stored in your browser via localStorage.</div>

        <div className="happyFormGrid">
          <div>
            <div className="small">Date</div>
            <input value={current.date} onChange={(e) => setCurrent({ ...current, date: e.target.value })} />
          </div>
          <div>
            <div className="small">Pain (0–10)</div>
            <input type="number" min={0} max={10} value={current.pain} onChange={(e) => setCurrent({ ...current, pain: Number(e.target.value) })} />
          </div>
          <div>
            <div className="small">Hydration (cups)</div>
            <input type="number" min={0} max={30} value={current.hydration} onChange={(e) => setCurrent({ ...current, hydration: Number(e.target.value) })} />
          </div>
          <div>
            <div className="small">Energy (0–10)</div>
            <input type="number" min={0} max={10} value={current.energy} onChange={(e) => setCurrent({ ...current, energy: Number(e.target.value) })} />
          </div>
        </div>

        <div className="mt-3">
          <div className="small">Notes</div>
          <textarea rows={4} value={current.notes} onChange={(e) => setCurrent({ ...current, notes: e.target.value })} placeholder="What happened today? Triggers? Foods? Sleep? Meds? Stress?" />
        </div>

        <div className="card happyMiniCard mt-3">
          <div className="small shellEyebrow">RED FLAGS</div>
          <div className="happySectionTitle">Escalation checklist</div>
          <div className="small">Turn these on if present. If multiple are on, consider urgent care.</div>
          <div className="happyFlagGrid">
            {([
              ["fever", "Fever"],
              ["blood", "Blood in stool"],
              ["severePain", "Severe pain"],
              ["dehydration", "Dehydration"],
              ["chestPain", "Chest pain / trouble breathing"],
              ["confusion", "Confusion / fainting"],
            ] as [keyof Day["redFlags"], string][]).map(([k, label]) => (
              <label key={String(k)} className="happyFlagPill">
                <input type="checkbox" checked={current.redFlags[k]} onChange={(e) => setFlag(k, e.target.checked)} />
                <span className="small">{label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="row wrap mt-3" style={{ gap: 10 }}>
          <button onClick={saveToday}>Save entry</button>
          <button onClick={() => setCurrent({ ...current, notes: "" })}>Clear notes</button>
        </div>
      </div>

      <div className="card happySectionCard mt-4">
        <div className="small shellEyebrow">HISTORY</div>
        <div className="happySectionTitle">Recent entries</div>
        <div className="small">Your last 30 entries.</div>

        <div className="happyHistoryList">
          {state.entries.slice(0, 30).length === 0 && <div className="small mt-3">No entries yet.</div>}
          {state.entries.slice(0, 30).map((e, i) => (
            <div key={i} className="happyHistoryRow">
              <div style={{ maxWidth: "72%" }}>
                <div style={{ fontWeight: 800 }}>
                  {e.date} {redFlagCount(e) > 0 && <span className="badge warn">Flags</span>}
                </div>
                <div className="small">Pain {e.pain}/10 · Hydration {e.hydration} · Energy {e.energy}/10</div>
                {e.notes && <div className="small" style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>{e.notes}</div>}
              </div>
              <div className="row wrap" style={{ alignItems: "center", gap: 8 }}>
                <button onClick={() => setCurrent(e)}>Load</button>
                <button onClick={() => saveState({ entries: state.entries.filter((_, x) => x !== i) })}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="small mt-3" style={{ opacity: 0.85 }}>
        Tip: if you want rules and reminders for hydration, meds, appointments, or flare-day routines, I can wire a safe local reminder system into this panel next.
      </div>
    </div>
  );
}
