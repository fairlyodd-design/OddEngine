import React, { useMemo, useState } from "react";
import { PanelHeader } from "../components/PanelHeader";
import CardFrame from "../components/CardFrame";
import { buildPhoenixIncomeForgeBoard } from "../lib/incomeForge";
import { buildRecoverySnapshot } from "../lib/recoveryPlanner";
import { loadJSON, saveJSON } from "../lib/storage";
import { seedHomieDraft } from "../lib/homieCore";

type Props = { onNavigate?: (panelId: string) => void };

type ForgeLog = { id: string; title: string; amountUsd: number; ts: number };
type ForgePrefs = {
  weeklyShipTarget: number;
  weeklyIncomeTarget: number;
  focusMode: "balanced" | "speed" | "scalable";
  killList: string;
  shipLog: ForgeLog[];
};

const KEY = "oddengine:phoenix-income-forge:v1";

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

export default function PhoenixIncomeForge({ onNavigate }: Props) {
  const nav = onNavigate || (() => {});
  const [prefs, setPrefs] = useState<ForgePrefs>(() => loadJSON<ForgePrefs>(KEY, {
    weeklyShipTarget: 1,
    weeklyIncomeTarget: 100,
    focusMode: "balanced",
    killList: "",
    shipLog: [],
  }));
  const [logTitle, setLogTitle] = useState("");
  const [logAmount, setLogAmount] = useState("0");
  const board = useMemo(() => buildPhoenixIncomeForgeBoard(6), [prefs]);
  const recovery = useMemo(() => buildRecoverySnapshot(), [prefs]);
  const fillerLane = recovery.capacity === "low"
    ? { title: "Prolific / UserTesting fallback", detail: "Use filler cash only to keep money moving while recovery is low. Protect energy and keep sessions short." }
    : recovery.capacity === "medium"
    ? { title: "Short affiliate or survey block", detail: "Good bridge lane when you need something lighter between product sprints." }
    : { title: "Stay on assets first", detail: "Use your higher-capacity window for a product, GPT, app, or listing push before filler cash." };

  function save(next: ForgePrefs) {
    setPrefs(next);
    saveJSON(KEY, next);
  }

  function patch(next: Partial<ForgePrefs>) {
    save({ ...prefs, ...next });
  }

  function logShip() {
    const title = String(logTitle || "").trim();
    if (!title) return;
    const amountUsd = Number(logAmount || 0) || 0;
    const next = [{ id: uid(), title, amountUsd, ts: Date.now() }, ...prefs.shipLog].slice(0, 24);
    save({ ...prefs, shipLog: next });
    setLogTitle("");
    setLogAmount("0");
  }

  function askHomie(prompt: string) {
    seedHomieDraft(prompt, { source: "phoenix-income-forge", panelId: "PhoenixIncomeForge" });
    nav("Homie");
  }

  return (
    <div className="panelMain">
      <PanelHeader
        panelId="PhoenixIncomeForge"
        title="🐦‍🔥 Phoenix Income Forge"
        subtitle="Dedicated income board: rank lanes, pick one, ship one, and cut dead-end effort."
        storagePrefix="oddengine:phoenix-income-forge"
        showCopilot
      />

      <div className="card panelFinishHero panelFinishGlow moneyFinishHero">
        <div className="panelFinishHeroTop">
          <div>
            <div className="small shellEyebrow">PHOENIX INCOME FORGE</div>
            <div className="panelFinishHeroLead">{board.todayShipLane?.title || "Pick one tiny sellable"}</div>
            <div className="small panelFinishLeadCopy">{board.headline} This board exists to keep the best path visible and stop shiny-side-lane overload.</div>
          </div>
          <div className="panelFinishActionStrip">
            <button className="tabBtn active" onClick={() => nav(board.todayShipLane?.panelId || "Books")}>{board.todayShipLane?.actionLabel || "Open Writers Lounge"}</button>
            <button className="tabBtn" onClick={() => askHomie(`Coach me through today's Phoenix Income Forge move and keep it realistic for my current energy.`)}>Coach me</button>
            <button className="tabBtn" onClick={() => nav("Books")}>Writers Lounge</button>
            <button className="tabBtn" onClick={() => nav("Money")}>Money</button>
          </div>
        </div>
        <div className="panelFinishMetrics">
          <div className="finishMetricCard"><div className="small shellEyebrow">SHIP TARGET</div><div className="finishMetricValue">{prefs.weeklyShipTarget}</div><div className="small">products this week</div></div>
          <div className="finishMetricCard"><div className="small shellEyebrow">INCOME TARGET</div><div className="finishMetricValue">${Math.round(prefs.weeklyIncomeTarget).toLocaleString()}</div><div className="small">weekly target</div></div>
          <div className="finishMetricCard"><div className="small shellEyebrow">FOCUS</div><div className="finishMetricLabel">{prefs.focusMode}</div><div className="small">balanced • speed • scalable</div></div>
          <div className="finishMetricCard"><div className="small shellEyebrow">RECOVERY FIT</div><div className="finishMetricLabel">{recovery.mode} • {recovery.capacity}</div><div className="small">{recovery.timeAvailableMin}m window</div></div>
        </div>
      </div>

      <div className="homieCoreGrid">
        <div className="timelineCard">
          <div className="small shellEyebrow">Today’s best move</div>
          <div className="homieCoreCardTitle">{board.todayShipLane?.title || "Pick one tiny sellable"}</div>
          <div className="small" style={{ marginTop: 6 }}>{board.shipOneThingToday}</div>
          {board.todayShipLane ? (
            <div className="assistantChipWrap" style={{ marginTop: 10 }}>
              <span className="badge good">{board.todayShipLane.platform}</span>
              <span className="badge">{board.todayShipLane.upfront} upfront</span>
              <span className="badge muted">{board.todayShipLane.minMinutes}m</span>
              <span className="badge warn">${Math.round(board.todayShipLane.weeklyPotentialUsd).toLocaleString()}/wk path</span>
            </div>
          ) : null}
          <div className="row" style={{ marginTop: 10, gap: 8, flexWrap: "wrap" }}>
            <button className="tabBtn active" onClick={() => nav(board.todayShipLane?.panelId || "Books")}>{board.todayShipLane?.actionLabel || "Open Writers Lounge"}</button>
            <button className="tabBtn" onClick={() => askHomie(`Break today's Phoenix move into 3 tiny steps I can actually finish.`)}>Tiny steps</button>
          </div>
        </div>
        <div className="timelineCard">
          <div className="small shellEyebrow">Fallback filler-cash lane</div>
          <div className="homieCoreCardTitle">{fillerLane.title}</div>
          <div className="small" style={{ marginTop: 6 }}>{fillerLane.detail}</div>
          <div className="row" style={{ marginTop: 10, gap: 8, flexWrap: "wrap" }}>
            <button className="tabBtn" onClick={() => askHomie(`I need a low-energy filler cash plan for today. Keep it short and realistic.`)}>Low-energy plan</button>
            <button className="tabBtn" onClick={() => nav("Money")}>Money routes</button>
          </div>
        </div>
      </div>

      <div className="grid2" style={{ marginTop: 12, alignItems: "start" }}>
        <CardFrame title="Lane ranking" subtitle="Strongest realistic from-home lanes right now" storageKey="phoenix-income-forge:lanes" className="softCard">
          <div style={{ display: "grid", gap: 10 }}>
            {board.lanes.map((lane, idx) => (
              <div key={lane.id} className={`card softCard ${idx === 0 ? "spotlightCard" : ""}`}>
                <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <div>
                    <div className="small">{lane.platform} • {lane.categoryLabel}</div>
                    <div style={{ fontWeight: 900, marginTop: 4 }}>{lane.title}</div>
                  </div>
                  <span className={`badge ${lane.score >= 82 ? "good" : lane.score >= 70 ? "warn" : "muted"}`}>{lane.score}</span>
                </div>
                <div className="small" style={{ marginTop: 8 }}>{lane.whyNow}</div>
                <div className="assistantChipWrap" style={{ marginTop: 10 }}>
                  <span className="badge">{lane.upfront} upfront</span>
                  <span className="badge muted">{lane.minMinutes}m</span>
                  <span className={`badge ${lane.effort === "low" ? "good" : lane.effort === "medium" ? "warn" : "bad"}`}>{lane.effort} effort</span>
                  <span className="badge warn">${Math.round(lane.weeklyPotentialUsd).toLocaleString()}/wk</span>
                </div>
                <div className="small" style={{ marginTop: 8 }}>{lane.shipToday}</div>
                <div className="row" style={{ marginTop: 10, gap: 8, flexWrap: "wrap" }}>
                  <button className="tabBtn active" onClick={() => nav(lane.panelId)}>{lane.actionLabel}</button>
                  <button className="tabBtn" onClick={() => askHomie(`Coach me through the ${lane.title} lane. Keep it honest, practical, and recovery-aware.`)}>Ask Homie</button>
                </div>
              </div>
            ))}
          </div>
        </CardFrame>

        <div style={{ display: "grid", gap: 12 }}>
          <CardFrame title="Weekly targets" subtitle="Set a simple scoreboard you can actually hit" storageKey="phoenix-income-forge:targets" className="softCard">
            <div className="grid2">
              <div>
                <div className="small">Weekly ship target</div>
                <input className="input" type="number" min={1} value={prefs.weeklyShipTarget} onChange={(e) => patch({ weeklyShipTarget: Math.max(1, Number(e.target.value || 1)) })} />
              </div>
              <div>
                <div className="small">Weekly income target</div>
                <input className="input" type="number" min={0} value={prefs.weeklyIncomeTarget} onChange={(e) => patch({ weeklyIncomeTarget: Math.max(0, Number(e.target.value || 0)) })} />
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              <div className="small">Focus mode</div>
              <select className="input" value={prefs.focusMode} onChange={(e) => patch({ focusMode: e.target.value as ForgePrefs["focusMode"] })}>
                <option value="balanced">balanced</option>
                <option value="speed">speed</option>
                <option value="scalable">scalable</option>
              </select>
            </div>
          </CardFrame>

          <CardFrame title="Shipped outcomes" subtitle="Log what actually got out the door" storageKey="phoenix-income-forge:shiplog" className="softCard">
            <div className="grid2">
              <input className="input" value={logTitle} onChange={(e) => setLogTitle(e.target.value)} placeholder="What did you ship?" />
              <input className="input" value={logAmount} onChange={(e) => setLogAmount(e.target.value)} placeholder="USD earned / expected" />
            </div>
            <div className="row" style={{ marginTop: 10, gap: 8, flexWrap: "wrap" }}>
              <button className="tabBtn active" onClick={logShip}>Log ship</button>
              <button className="tabBtn" onClick={() => nav("Books")}>Open Writers Lounge</button>
            </div>
            <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
              {prefs.shipLog.length ? prefs.shipLog.map((item) => (
                <div key={item.id} className="timelineCard">
                  <div className="row" style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 800 }}>{item.title}</div>
                    <span className="badge good">${Math.round(item.amountUsd).toLocaleString()}</span>
                  </div>
                  <div className="small" style={{ marginTop: 6 }}>{new Date(item.ts).toLocaleString()}</div>
                </div>
              )) : <div className="small">Log the little wins too. Shipped beats almost done.</div>}
            </div>
          </CardFrame>

          <CardFrame title="Kill list" subtitle="Cut dead-end effort before it steals another week" storageKey="phoenix-income-forge:killlist" className="softCard">
            <textarea className="input" style={{ minHeight: 140 }} value={prefs.killList} onChange={(e) => patch({ killList: e.target.value })} placeholder="Write down lanes, habits, or distractions that keep looking shiny but do not pay..." />
          </CardFrame>
        </div>
      </div>
    </div>
  );
}
