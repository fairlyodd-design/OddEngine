import React, { useEffect, useMemo, useState } from "react";
import {
  PANEL_META,
  buildAssistantInsight,
  buildMissions,
  getBrainNotes,
  getGoals,
  getPanelMeta,
  normalizePanelId,
} from "../lib/brain";
import "./FairlyGodModeHUD.css";

type Props = {
  activePanelId: string;
  onNavigate: (id: string) => void;
};

type Tab = "Overview" | "Panels" | "Layout" | "Safety";

type LayoutState = {
  locked?: boolean;
  grid?: boolean;
  gridSize?: number;
  compact?: boolean;
  compactKeep?: number;
};

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJSON<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage can fail in restricted contexts; keep HUD non-fatal.
  }
}

function removeKey(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function countMatchingLocalStorage(prefix: string) {
  let count = 0;
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i) || "";
      if (key.startsWith(prefix)) count += 1;
    }
  } catch {
    return 0;
  }
  return count;
}

function removeMatchingLocalStorage(prefix: string) {
  const keys: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i) || "";
      if (key.startsWith(prefix)) keys.push(key);
    }
    keys.forEach((key) => localStorage.removeItem(key));
  } catch {
    // ignore
  }
  return keys.length;
}

function getVisibleCardCount() {
  try {
    return Array.from(document.querySelectorAll(".panelMain .card")).filter((node) => {
      const el = node as HTMLElement;
      return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
    }).length;
  } catch {
    return 0;
  }
}

function getProblemCardCount() {
  try {
    return Array.from(document.querySelectorAll(".panelMain .card")).filter((node) => {
      const el = node as HTMLElement;
      const rect = el.getBoundingClientRect();
      const tooWide = rect.width > window.innerWidth * 0.92;
      const offLeft = rect.left < -24;
      const offRight = rect.right > window.innerWidth + 24;
      return tooWide || offLeft || offRight;
    }).length;
  } catch {
    return 0;
  }
}

function setAllPanelLocks(locked: boolean) {
  PANEL_META.forEach((panel) => {
    const key = `oddengine:godlayout:${panel.id}`;
    const current = readJSON<LayoutState>(key, {});
    writeJSON(key, { ...current, locked });
  });
  window.dispatchEvent(new CustomEvent("oddengine:fairlygodmode-layout-updated", { detail: { locked } }));
}

function setAllPanelGrid(grid: boolean) {
  PANEL_META.forEach((panel) => {
    const key = `oddengine:godlayout:${panel.id}`;
    const current = readJSON<LayoutState>(key, {});
    writeJSON(key, { ...current, grid });
  });
  window.dispatchEvent(new CustomEvent("oddengine:fairlygodmode-layout-updated", { detail: { grid } }));
}

function resetPanelLayout(panelId: string) {
  const normalized = normalizePanelId(panelId);
  const removedCards = removeMatchingLocalStorage(`oddengine:godcard:${normalized}::`);
  removeKey(`oddengine:godlayout:${normalized}`);
  removeKey(`oddengine:godtemplate:${normalized}`);
  return removedCards;
}

export default function FairlyGodModeHUD({ activePanelId, onNavigate }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("Overview");
  const [tick, setTick] = useState(0);
  const active = normalizePanelId(activePanelId);
  const activeMeta = getPanelMeta(active);

  useEffect(() => {
    const id = window.setInterval(() => setTick((value) => value + 1), 2500);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "g") {
        event.preventDefault();
        setOpen((value) => !value);
      }
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const snapshot = useMemo(() => {
    const missions = buildMissions();
    const notes = getBrainNotes();
    const goals = getGoals().split(/\n+/).filter(Boolean);
    const insight = buildAssistantInsight(active);
    const visibleCards = getVisibleCardCount();
    const problemCards = getProblemCardCount();
    const layoutKeys = countMatchingLocalStorage("oddengine:godlayout:");
    const cardKeys = countMatchingLocalStorage("oddengine:godcard:");
    const sections = Array.from(new Set(PANEL_META.map((panel) => panel.section)));
    return { missions, notes, goals, insight, visibleCards, problemCards, layoutKeys, cardKeys, sections };
  }, [active, tick]);

  const panels = useMemo(() => {
    return PANEL_META.map((panel) => {
      const layout = readJSON<LayoutState>(`oddengine:godlayout:${panel.id}`, {});
      const insight = buildAssistantInsight(panel.id);
      return { ...panel, layout, insight };
    });
  }, [tick]);

  const openPanel = (panelId: string) => {
    onNavigate(panelId);
    setOpen(false);
  };

  const confirmResetActive = () => {
    const ok = window.confirm(`Reset FairlyGod layout memory for ${activeMeta.title}? This only clears saved card layout state for this panel.`);
    if (!ok) return;
    const removed = resetPanelLayout(active);
    window.alert(`Reset ${activeMeta.title}. Cleared ${removed} saved card layout item(s). Reload if the current panel does not refresh immediately.`);
    setTick((value) => value + 1);
  };

  return (
    <>
      <button
        className={`fgmLauncher ${open ? "open" : ""}`}
        onClick={() => setOpen((value) => !value)}
        title="FairlyGodMode — Ctrl+Shift+G"
        type="button"
      >
        <span>FG</span>
        <b>GOD</b>
      </button>

      {open && (
        <div className="fgmOverlay" role="dialog" aria-label="FairlyGodMode whole OS command deck">
          <div className="fgmPanel card">
            <div className="fgmHeader">
              <div>
                <div className="small shellEyebrow">FAIRLYGODMODE • WHOLE OS COMMAND DECK</div>
                <div className="fgmTitle">{activeMeta.icon} {activeMeta.title}</div>
                <div className="small">Audit the OS, navigate panels, and control layout debt without touching panel logic.</div>
              </div>
              <div className="fgmHeaderActions">
                <button className="tabBtn" onClick={() => setTick((value) => value + 1)} type="button">Refresh</button>
                <button className="tabBtn" onClick={() => setOpen(false)} type="button">Close</button>
              </div>
            </div>

            <div className="fgmTabs">
              {(["Overview", "Panels", "Layout", "Safety"] as Tab[]).map((name) => (
                <button key={name} className={`tabBtn ${tab === name ? "active" : ""}`} onClick={() => setTab(name)} type="button">
                  {name}
                </button>
              ))}
            </div>

            {tab === "Overview" && (
              <div className="fgmGrid">
                <div className="fgmStat"><b>{PANEL_META.length}</b><span>registered panels</span></div>
                <div className="fgmStat"><b>{snapshot.visibleCards}</b><span>visible active cards</span></div>
                <div className={`fgmStat ${snapshot.problemCards ? "warn" : "good"}`}><b>{snapshot.problemCards}</b><span>overflow warnings</span></div>
                <div className="fgmStat"><b>{snapshot.missions.length}</b><span>missions</span></div>
                <div className="fgmStat"><b>{snapshot.notes.length}</b><span>brain notes</span></div>
                <div className="fgmStat"><b>{snapshot.goals.length}</b><span>goals</span></div>
                <div className="fgmWideCard">
                  <div className="assistantSectionTitle">Active insight</div>
                  <div className="small">{snapshot.insight.headline}</div>
                  <div className="assistantChipWrap" style={{ marginTop: 10 }}>
                    {snapshot.insight.badges.slice(0, 6).map((badge) => (
                      <span key={badge.label} className={`badge ${badge.tone}`}>{badge.label}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {tab === "Panels" && (
              <div className="fgmPanelList">
                {snapshot.sections.map((section) => (
                  <div key={section} className="fgmSectionBlock">
                    <div className="fgmSectionTitle">{section}</div>
                    <div className="fgmPanelRows">
                      {panels.filter((panel) => panel.section === section).map((panel) => (
                        <button
                          key={panel.id}
                          className={`fgmPanelRow ${panel.id === active ? "active" : ""}`}
                          onClick={() => openPanel(panel.id)}
                          type="button"
                        >
                          <span className="fgmPanelIcon">{panel.icon}</span>
                          <span className="fgmPanelText"><b>{panel.title}</b><small>{panel.sub}</small></span>
                          <span className={`badge ${panel.insight.tone}`}>{panel.insight.tone}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab === "Layout" && (
              <div className="fgmLayoutTools">
                <div className="fgmWideCard">
                  <div className="assistantSectionTitle">Whole OS layout commands</div>
                  <div className="small">These write to existing CardGODMode layout keys. They do not rewrite CardGODMode internals.</div>
                  <div className="fgmActionRow">
                    <button className="tabBtn active" onClick={() => { setAllPanelLocks(true); setTick((v) => v + 1); }} type="button">Lock all panels</button>
                    <button className="tabBtn" onClick={() => { setAllPanelLocks(false); setTick((v) => v + 1); }} type="button">Unlock all panels</button>
                    <button className="tabBtn" onClick={() => { setAllPanelGrid(true); setTick((v) => v + 1); }} type="button">Grid all on</button>
                    <button className="tabBtn" onClick={() => { setAllPanelGrid(false); setTick((v) => v + 1); }} type="button">Grid all off</button>
                    <button className="tabBtn danger" onClick={confirmResetActive} type="button">Reset active panel layout</button>
                  </div>
                </div>
                <div className="fgmGrid two">
                  <div className="fgmStat"><b>{snapshot.layoutKeys}</b><span>panel layout records</span></div>
                  <div className="fgmStat"><b>{snapshot.cardKeys}</b><span>card layout records</span></div>
                </div>
              </div>
            )}

            {tab === "Safety" && (
              <div className="fgmSafety">
                <div className="fgmWideCard">
                  <div className="assistantSectionTitle">FairlyGodMode safety rails</div>
                  <ul>
                    <li>Do not rewrite Trading rendering just to make global UI changes.</li>
                    <li>Do not touch Homie voice, memory, or bridge logic from this deck.</li>
                    <li>Do not add regex-overlay patches when a file has drifted too far.</li>
                    <li>Prefer layout memory reset over new stacking hacks.</li>
                    <li>Keep shell, rails, panel body, and Homie pop-out ownership separate.</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
