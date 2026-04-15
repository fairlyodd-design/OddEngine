import React, { useEffect, useMemo, useState } from "react";
import { buildActionQueue, buildInboxSummary, buildMorningDigest, getBrainNotes, getGoals, getPanelMeta, runQuickAction } from "../lib/brain";

type RailTab = "Next" | "Copilots" | "Log";

const EMPTY_DATA = {
  panelHealth: [] as any[],
  panelCards: [] as any[],
  operatorFeed: [] as any[],
};

function safeRailTab(value: unknown): RailTab {
  return value === "Copilots" || value === "Log" ? value : "Next";
}

export default function ActivityRail({ activePanelId, onNavigate }: { activePanelId: string; onNavigate: (id: string) => void; }) {
  const [tick, setTick] = useState(0);
  const [tab, setTab] = useState<RailTab>("Next");
  const [isScrollHot, setIsScrollHot] = useState(false);

  const safeTab = safeRailTab(tab);

  const data = useMemo(() => {
    try {
      const next = buildInboxSummary();
      return next || EMPTY_DATA;
    } catch {
      return EMPTY_DATA;
    }
  }, [tick, activePanelId]);

  const digest = useMemo(() => {
    try {
      return buildMorningDigest();
    } catch {
      return "Morning digest is temporarily unavailable.";
    }
  }, [tick]);

  const queue = useMemo(() => {
    try {
      return buildActionQueue(4) || [];
    } catch {
      return [];
    }
  }, [tick]);

  const goals = useMemo(() => {
    try {
      return getGoals().split(/\n+/).filter(Boolean);
    } catch {
      return [] as string[];
    }
  }, [tick]);

  const noteCount = useMemo(() => {
    try {
      return getBrainNotes().length;
    } catch {
      return 0;
    }
  }, [tick]);

  useEffect(() => {
    let coolDownId: number | null = null;

    const markScrolling = () => {
      setIsScrollHot(true);
      if (coolDownId !== null) window.clearTimeout(coolDownId);
      coolDownId = window.setTimeout(() => {
        setIsScrollHot(false);
      }, 180);
    };

    const main = document.querySelector(".main");
    const rail = document.querySelector(".activityRail");

    main?.addEventListener("scroll", markScrolling, { passive: true });
    rail?.addEventListener("scroll", markScrolling, { passive: true });
    window.addEventListener("scroll", markScrolling, { passive: true });

    return () => {
      if (coolDownId !== null) window.clearTimeout(coolDownId);
      main?.removeEventListener("scroll", markScrolling as EventListener);
      rail?.removeEventListener("scroll", markScrolling as EventListener);
      window.removeEventListener("scroll", markScrolling as EventListener);
    };
  }, []);

  useEffect(() => {
    if (isScrollHot) return;
    const id = window.setInterval(() => setTick((v) => v + 1), 4000);
    return () => window.clearInterval(id);
  }, [isScrollHot]);

  function fireAction(actionId?: string) {
    if (!actionId) return;
    try {
      const result = runQuickAction(actionId);
      if (result.panelId) onNavigate(result.panelId);
    } catch {}
    setTick((v) => v + 1);
  }

  return (
    <div className="activityRail">
      <div className="card heroCard">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
          <div>
            <div className="assistantTitle">Mission Control Rail</div>
            <div className="small">Digest, queue, panel health, and the live AI operator stream.</div>
          </div>
          <button className="tabBtn" onClick={() => onNavigate("Brain")}>Open Brain</button>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          {(["Next","Copilots","Log"] as const).map((t) => (
            <button key={t} className={`tabBtn ${safeTab === t ? "active" : ""}`} onClick={() => setTab(t)}>{t}</button>
          ))}
        </div>
        <div className="assistantChipWrap" style={{ marginTop: 10 }}>
          <span className={`badge ${queue.length ? "warn" : "good"}`}>{queue.length} queued actions</span>
          <span className={`badge ${data.panelHealth?.[0]?.status === "error" ? "bad" : data.panelHealth?.[0]?.status === "warn" ? "warn" : "good"}`}>{data.panelHealth?.[0] ? `${data.panelHealth[0].title} is hottest` : "Stable"}</span>
          <span className={`badge ${noteCount ? "good" : "muted"}`}>{noteCount} notes</span>
          <span className={`badge ${goals.length ? "good" : "warn"}`}>{goals.length} goals</span>
          <span className={`badge ${isScrollHot ? "warn" : "good"}`}>{isScrollHot ? "Scroll hot" : "Rail calm"}</span>
        </div>
      </div>

      {safeTab === "Copilots" && (
        <div className="card softCard">
          <div className="assistantSectionTitle">Panel copilots</div>
          <div className="small">Each panel registers its hottest priority, next action, and suggested chips.</div>
          <div className="assistantStack" style={{ marginTop: 10 }}>
            {data.panelCards?.length ? data.panelCards.slice(0, 9).map((card: any) => (
              <div key={card.id} className="timelineCard">
                <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div className="small">{getPanelMeta(card.panelId).icon} {getPanelMeta(card.panelId).title}</div>
                    <div style={{ fontWeight: 750, marginTop: 4 }}>{card.priorityTitle}</div>
                  </div>
                  <span className={`badge ${card.level === "error" ? "bad" : card.level === "warn" ? "warn" : "good"}`}>{card.score}</span>
                </div>
                <div className="small" style={{ marginTop: 6 }}>{card.priorityText}</div>
                <div className="row" style={{ marginTop: 10, gap: 8, flexWrap: "wrap" }}>
                  {card.nextActionId && <button className="tabBtn active" onClick={() => fireAction(card.nextActionId)}>{card.nextActionLabel || "Run"}</button>}
                  <button className="tabBtn" onClick={() => onNavigate(card.panelId)}>Open</button>
                </div>
                {card.chips?.length ? (
                  <div className="assistantChipWrap" style={{ marginTop: 10 }}>
                    {card.chips.slice(0, 5).map((chip: any) => (
                      <button key={chip.actionId} className="tabBtn" onClick={() => fireAction(chip.actionId)}>{chip.label}</button>
                    ))}
                  </div>
                ) : null}
              </div>
            )) : <div className="small">No panel copilots registered yet.</div>}
          </div>
        </div>
      )}

      {safeTab === "Next" && (
        <>
          <div className="card softCard">
            <div className="assistantSectionTitle">Morning digest</div>
            <div className="small" style={{ whiteSpace: "pre-wrap", lineHeight: 1.45 }}>{digest}</div>
          </div>

          <div className="card softCard">
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <div className="assistantSectionTitle">Action queue</div>
              <button className="tabBtn" onClick={() => fireAction("brain:run-next-queue")}>Run next</button>
            </div>
            <div className="assistantStack">
              {queue.length ? queue.map((item: any) => (
                <div key={item.id} className="timelineCard">
                  <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div className="small">{getPanelMeta(item.panelId).title}</div>
                      <div style={{ fontWeight: 700, marginTop: 4 }}>{item.title}</div>
                    </div>
                    <span className={`badge ${item.level === "error" ? "bad" : item.level === "warn" ? "warn" : "good"}`}>{item.score}</span>
                  </div>
                  <div className="small" style={{ marginTop: 6 }}>{item.body}</div>
                  <div className="row" style={{ marginTop: 8, gap: 8 }}>
                    {item.actionId && <button className="tabBtn active" onClick={() => fireAction(item.actionId)}>{item.actionLabel || "Run"}</button>}
                    <button className="tabBtn" onClick={() => onNavigate(item.panelId)}>Open</button>
                  </div>
                </div>
              )) : <div className="small">No queued actions right now.</div>}
            </div>
          </div>
        </>
      )}

      {safeTab === "Log" && (
        <>
          <div className="card softCard">
            <div className="assistantSectionTitle">Panel health</div>
            <div className="assistantStack">
              {data.panelHealth?.length ? data.panelHealth.slice(0, 6).map((item: any) => (
                <div key={item.panelId} className="timelineCard" onClick={() => onNavigate(item.panelId)}>
                  <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div className="small">{item.icon} {item.title}</div>
                      <div style={{ fontWeight: 700, marginTop: 4 }}>{item.headline}</div>
                    </div>
                    <span className={`badge ${item.status === "error" ? "bad" : item.status === "warn" ? "warn" : "good"}`}>{item.score}/100</span>
                  </div>
                  <div className="healthBar" style={{ marginTop: 8 }}><div className={`healthFill ${item.status}`} style={{ width: `${item.score}%` }} /></div>
                </div>
              )) : <div className="small">No panel health data yet.</div>}
            </div>
          </div>

          <div className="card softCard">
            <div className="assistantSectionTitle">AI operator feed</div>
            <div className="assistantStack">
              {data.operatorFeed?.length ? data.operatorFeed.map((item: any) => (
                <div key={item.id} className="timelineCard" onClick={() => onNavigate(item.panelId)}>
                  <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div className="small">{getPanelMeta(item.panelId).title} • {item.source}</div>
                      <div style={{ fontWeight: 700, marginTop: 4 }}>{item.title}</div>
                    </div>
                    <span className={`badge ${item.level === "error" ? "bad" : item.level === "warn" ? "warn" : item.level === "good" ? "good" : "muted"}`}>{item.level}</span>
                  </div>
                  <div className="small" style={{ marginTop: 6 }}>{item.body}</div>
                </div>
              )) : <div className="small">No operator feed events yet.</div>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
