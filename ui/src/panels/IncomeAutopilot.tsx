import React, { useEffect, useMemo, useState } from "react";
import { PanelHeader } from "../components/PanelHeader";
import CardFrame from "../components/CardFrame";
import { INCOME_AUTOPILOT_EVENT, getAutonomousSettings, listAutonomousCycles, runAutonomousCycle, saveAutonomousSettings } from "../lib/autonomousIncome";
import { autoDraftListingsFromWinners, listCommerceListings, publishCommerceListing } from "../lib/commerceEngine";
import { buildMoneyAutopilotPlan } from "../lib/moneyAutopilot";

export default function IncomeAutopilot({ onNavigate }: { onNavigate: (panelId: string) => void }) {
  const [tick, setTick] = useState(0);
  const settings = getAutonomousSettings();
  const cycles = useMemo(() => { void tick; return listAutonomousCycles(); }, [tick]);
  const listings = useMemo(() => { void tick; return listCommerceListings(); }, [tick]);
  const plan = buildMoneyAutopilotPlan();

  useEffect(() => {
    const fn = () => setTick((x) => x + 1);
    try {
      window.addEventListener(INCOME_AUTOPILOT_EVENT as any, fn);
      window.addEventListener("storage", fn);
    } catch {}
    return () => {
      try {
        window.removeEventListener(INCOME_AUTOPILOT_EVENT as any, fn);
        window.removeEventListener("storage", fn);
      } catch {}
    };
  }, []);

  return (
    <div className="panelRoot">
      <PanelHeader title="🤖 Income Autopilot" subtitle="Daily autonomous cycles, product drafts, and sleep-mode money moves." panelId="IncomeAutopilot" storagePrefix="oddengine:incomeAutopilot" showCopilot />
      <div className="writersGrid">
        <div className="writersLeft">
          <CardFrame title="Autonomous scheduler" subtitle="Runs daily cycles while the OS sleeps." storageKey="income:scheduler" className="softCard">
            <div className="studioInlineSelect">
              <select className="input" value={settings.mode} onChange={(e) => { saveAutonomousSettings({ mode: e.target.value as any, enabled: e.target.value !== "off" }); setTick((x) => x + 1); }}>
                <option value="off">Off</option>
                <option value="assist">Assist</option>
                <option value="full-auto">Full Auto</option>
              </select>
              <input className="input" type="number" value={settings.intervalMinutes} onChange={(e) => { saveAutonomousSettings({ intervalMinutes: Number(e.target.value || 180) }); setTick((x) => x + 1); }} placeholder="Interval minutes" />
              <button className="tabBtn" onClick={() => { runAutonomousCycle(); setTick((x) => x + 1); }}>Run now</button>
            </div>
            <div className="studioInlineSelect mt-4">
              <label className="cluster"><input type="checkbox" checked={settings.autoDraftProducts} onChange={(e) => { saveAutonomousSettings({ autoDraftProducts: e.target.checked }); setTick((x) => x + 1); }} /> Auto draft products</label>
              <label className="cluster"><input type="checkbox" checked={settings.autoPublishProducts} onChange={(e) => { saveAutonomousSettings({ autoPublishProducts: e.target.checked }); setTick((x) => x + 1); }} /> Auto publish products</label>
              <input className="input" type="number" value={settings.maxActionsPerCycle} onChange={(e) => { saveAutonomousSettings({ maxActionsPerCycle: Number(e.target.value || 3) }); setTick((x) => x + 1); }} placeholder="Max actions" />
            </div>
            <div className="studioInlineSelect mt-4">
              <input className="input" type="number" value={settings.quietHours.start} onChange={(e) => { saveAutonomousSettings({ quietHours: { ...settings.quietHours, start: Number(e.target.value || 1) } }); setTick((x) => x + 1); }} placeholder="Quiet start" />
              <input className="input" type="number" value={settings.quietHours.end} onChange={(e) => { saveAutonomousSettings({ quietHours: { ...settings.quietHours, end: Number(e.target.value || 7) } }); setTick((x) => x + 1); }} placeholder="Quiet end" />
              <button className="tabBtn" onClick={() => { saveAutonomousSettings({ mode: "full-auto", enabled: true, autoDraftProducts: true, autoPublishProducts: true, intervalMinutes: 120, quietHours: { start: 1, end: 7 } }); setTick((x) => x + 1); }}>Overnight mode</button>
            </div>
            <div className="studioPillRow mt-4">
              <span className="studioPill">quiet hours: {settings.quietHours.start}:00 - {settings.quietHours.end}:00</span>
              <span className="studioPill">interval: {settings.intervalMinutes} min</span>
              <span className="studioPill">top lane: {plan.topContentType} → {plan.topPlatform}</span>
            </div>
          </CardFrame>

          <CardFrame title="Commerce drafts" subtitle="Auto-listed product packs for Gumroad / Stripe / Etsy / local export." storageKey="income:commerce" className="softCard">
            <div className="row wrap">
              <button className="tabBtn" onClick={() => { autoDraftListingsFromWinners(); setTick((x) => x + 1); }}>Draft from winners</button>
              <button className="tabBtn" onClick={() => onNavigate("PublisherHub")}>Open Publisher Hub</button>
            </div>
            <div className="grid mt-4">
              {listings.length === 0 ? <div className="small">No product listings yet.</div> : listings.slice(0, 8).map((item) => (
                <div key={item.id} className="studioPipelineCard">
                  <div className="cluster spread">
                    <div>
                      <div className="h">{item.title}</div>
                      <div className="small">{item.productType} • {item.platform}</div>
                    </div>
                    <button className="tabBtn" onClick={() => { publishCommerceListing(item.id); setTick((x) => x + 1); }}>Publish</button>
                  </div>
                  <div className="studioPillRow mt-4">
                    <span className="studioPill">{item.status}</span>
                    <span className="studioPill">${item.price.toFixed(2)}</span>
                  </div>
                  {item.url ? <div className="small mt-2">{item.url}</div> : null}
                </div>
              ))}
            </div>
          </CardFrame>
        </div>

        <div className="writersCenter">
          <CardFrame title="Cycle history" subtitle="What the autonomous income system did last." storageKey="income:cycles" className="softCard">
            <div className="grid">
              {cycles.length === 0 ? <div className="small">No autonomous cycles run yet.</div> : cycles.map((cycle) => (
                <div key={cycle.id} className="studioPipelineCard">
                  <div className="cluster spread">
                    <div>
                      <div className="h">{cycle.recommendationTitle}</div>
                      <div className="small">{new Date(cycle.ts).toLocaleString()}</div>
                    </div>
                    <span className="badge good">{cycle.actions.filter((x) => x.status === "done").length} actions</span>
                  </div>
                  <div className="small mt-2">{cycle.summary}</div>
                  <div className="grid mt-4">
                    {cycle.actions.map((action, idx) => <div key={`${cycle.id}-${idx}`} className="cluster spread"><span>{action.title}</span><span className="small">{action.status}</span></div>)}
                  </div>
                </div>
              ))}
            </div>
          </CardFrame>
        </div>

        <div className="writersRight">
          <CardFrame title="Autonomy brain" subtitle="The strongest next move chosen from real outcome data." storageKey="income:brain" className="softCard">
            <div className="studioPipelineCard">
              <div className="small">Current recommendation</div>
              <div className="h">{plan.recommendation.title}</div>
              <div className="small mt-2">{plan.recommendation.body}</div>
              <div className="studioPillRow mt-4">
                <span className="studioPill">confidence: {plan.recommendation.confidence}%</span>
                <span className="studioPill">est rev: ${plan.recommendation.estimatedRevenue.toFixed(2)}</span>
              </div>
            </div>
            <div className="row wrap mt-4">
              <button className="tabBtn" onClick={() => onNavigate("Books")}>Open Studio</button>
              <button className="tabBtn" onClick={() => onNavigate("RenderLab")}>Open Render Lab</button>
              <button className="tabBtn" onClick={() => onNavigate("PublisherHub")}>Open Publisher Hub</button>
            </div>
          </CardFrame>
        </div>
      </div>
    </div>
  );
}
