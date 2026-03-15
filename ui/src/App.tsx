import React, { Suspense, lazy, useEffect, useMemo, useState } from "react";
import HowToModal from "./components/HowToModal";
import { HOWTO } from "./howtoContent";
import AssistantDock from "./components/AssistantDock";
import ActivityRail from "./components/ActivityRail";
import CommandBar from "./components/CommandBar";
import HomieBuddy from "./components/HomieBuddy";
import LilHomieAgent from "./components/LilHomieAgent";
import CardGODMode from "./components/CardGODMode";
import ErrorBoundary from "./components/ErrorBoundary";
import { startAutomationLoop } from "./lib/automation";
import { loadJSON } from "./lib/storage";
import { APP_VERSION } from "./lib/version";
import { isDesktop, oddApi } from "./lib/odd";
import { PANEL_META, buildAssistantInsight, buildMissions, getBrainNotes, getGoals, getPanelMeta, logActivity, normalizePanelId, readPanelContext } from "./lib/brain";
import { loadPrefs } from "./lib/prefs";
import { rememberPanelVisit } from "./lib/homieMemoryContext";
import { pushHomiePulse } from "./lib/homieNotificationPulse";
import fairlyOddLogo from "./assets/fairlyodd-logo.png";
import osWallpaper from "./assets/os-wallpaper.png";

const OddBrain = lazy(() => import("./panels/OddBrain"));
const Home = lazy(() => import("./panels/Home"));
const DevEngine = lazy(() => import("./panels/DevEngine"));
const Autopilot = lazy(() => import("./panels/Autopilot"));
const Builder = lazy(() => import("./panels/Builder"));
const Plugins = lazy(() => import("./panels/Plugins"));
const Money = lazy(() => import("./panels/Money"));
const FamilyBudget = lazy(() => import("./panels/FamilyBudget"));
const Preferences = lazy(() => import("./panels/Preferences"));
const Brain = lazy(() => import("./panels/Brain"));
const Trading = lazy(() => import("./panels/Trading"));
const Grow = lazy(() => import("./panels/Grow"));
const Mining = lazy(() => import("./panels/Mining"));
const CryptoGames = lazy(() => import("./panels/CryptoGames"));
const Cameras = lazy(() => import("./panels/Cameras"));
const OptionsSaaS = lazy(() => import("./panels/OptionsSaaS"));
const News = lazy(() => import("./panels/News"));
const FamilyHealth = lazy(() => import("./panels/FamilyHealth"));
const GroceryMeals = lazy(() => import("./panels/GroceryMeals"));
const Security = lazy(() => import("./panels/Security"));
const Homie = lazy(() => import("./panels/Homie"));
const Cannabis = lazy(() => import("./panels/Cannabis"));
const HappyHealthy = lazy(() => import("./panels/HappyHealthy"));
const Entertainment = lazy(() => import("./panels/Entertainment"));
const Books = lazy(() => import("./panels/Books"));
const RoutineLauncher = lazy(() => import("./panels/RoutineLauncher"));
const Calendar = lazy(() => import("./panels/Calendar"));
const DailyChores = lazy(() => import("./panels/DailyChores"));
const MarketMap = lazy(() => import("./panels/MarketMap"));
const TimeMachine = lazy(() => import("./panels/TimeMachine"));
const FiftyTo1K = lazy(() => import("./panels/FiftyTo1K"));
const OptionsSniperTerminal = lazy(() => import("./panels/OptionsSniperTerminal"));

function PanelLoading({ panelId }: { panelId: string }) {
  const meta = getPanelMeta(panelId);
  return (
    <div className="card softCard panelLoadingCard">
      <div className="small shellEyebrow">Loading panel chunk</div>
      <div className="h" style={{ marginTop: 6 }}>{meta.icon} {meta.title}</div>
      <div className="sub">Pulling the {meta.title} workspace into the shell.</div>
    </div>
  );
}

function renderPanel(id: string, setActive: (id: string) => void, activeId: string, openHowTo: () => void) {
  const panelId = normalizePanelId(id);
  switch (panelId) {
    case "Home": return <Home onNavigate={setActive} />;
    case "OddBrain": return <OddBrain onNavigate={setActive} />;
    case "Homie": return <Homie onNavigate={setActive} activePanelId={activeId} onOpenHowTo={openHowTo} />;
    case "DevEngine": return <DevEngine onNavigate={setActive} onOpenHowTo={openHowTo} />;
    case "Autopilot": return <Autopilot projectDir={null} exportBase={null} />;
    case "Builder": return <Builder />;
    case "Plugins": return <Plugins onNavigate={setActive} />;
    case "Money": return <Money onNavigate={setActive} />;
    case "FamilyBudget": return <FamilyBudget />;
    case "Brain": return <Brain onNavigate={setActive} activePanelId={activeId} />;
    case "HappyHealthy": return <HappyHealthy />;
    case "Cannabis": return <Cannabis />;
    case "Entertainment": return <Entertainment />;
    case "Books": return <Books onNavigate={setActive} />;
    case "RoutineLauncher": return <RoutineLauncher onNavigate={setActive} />;
    case "Calendar": return <Calendar onNavigate={setActive} />;
    case "DailyChores": return <DailyChores />;
    case "Trading": return <Trading />;
    case "Grow": return <Grow />;
    case "Mining": return <Mining onNavigate={setActive} />;
    case "CryptoGames": return <CryptoGames />;
    case "Cameras": return <Cameras />;
    case "OptionsSaaS": return <OptionsSaaS />;
    case "News": return <News onNavigate={setActive} onOpenHowTo={openHowTo} />;
    case "FamilyHealth": return <FamilyHealth onNavigate={setActive} onOpenHowTo={openHowTo} />;
    case "GroceryMeals": return <GroceryMeals onNavigate={setActive} onOpenHowTo={openHowTo} />;
    case "Preferences": return <Preferences />;
    case "Security": return <Security onNavigate={setActive} />;
    case "MarketMap": return <MarketMap />;
    case "TimeMachine": return <TimeMachine />;
    case "FiftyTo1K": return <FiftyTo1K />;
    case "OptionsSniperTerminal": return <OptionsSniperTerminal />;
    default: return <div className="card">Unknown panel</div>;
  }
}

function panelHasDock(panelId: string) {
  const normalized = normalizePanelId(panelId);
  return !["Homie", "Brain"].includes(normalized);
}

function ShellSummary({
  activeId,
  onNavigate,
  onFocusCommandBar,
  mode,
  onToggleMode,
}: {
  activeId: string;
  onNavigate: (id: string) => void;
  onFocusCommandBar?: () => void;
  mode: "expanded" | "compact";
  onToggleMode: () => void;
}) {
  const meta = getPanelMeta(activeId);
  const ctx = readPanelContext(activeId);
  const missions = buildMissions();
  const missionCount = missions.length;
  const insight = buildAssistantInsight(activeId);
  const noteCount = getBrainNotes().length;
  const goalCount = getGoals().split(/\n+/).filter(Boolean).length;

  if (mode === "compact") {
    return (
      <div className="card shellBar">
        <div className="shellBarLeft">
          <img src={fairlyOddLogo} alt="FairlyOdd logo" className="shellBarLogo" />
          <div style={{ minWidth: 0 }}>
            <div className="shellBarEyebrow">
              {meta.section} • {isDesktop() ? "Desktop" : "Web"} • FAIRLYODD OS
            </div>
            <div className="shellBarTitle">{meta.icon} {meta.title}</div>
            <div className="shellBarSub">{ctx.summary}</div>
          </div>
        </div>
        <div className="shellBarRight">
          <div className="shellBarBadges">
            <span className="badge">{missionCount} missions</span>
            <span className="badge">{noteCount} notes</span>
            <span className="badge">{goalCount} goals</span>
          </div>
          <div className="shellBarActions">
            <button className="tabBtn" onClick={() => onFocusCommandBar?.()}>Cmd</button>
            <button className="tabBtn" onClick={() => onNavigate("Calendar")}>Calendar</button>
            <button className="tabBtn" onClick={onToggleMode}>Expand</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card shellHero fairlyOddShellHero">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
          <img src={fairlyOddLogo} alt="FairlyOdd logo" className="shellLogo" />
          <div>
            <div className="small shellEyebrow">{meta.section} • {isDesktop() ? "Desktop" : "Web"} • FAIRLYODD OS</div>
            <div className="shellTitle">{meta.icon} {meta.title}</div>
            <div className="sub" style={{ maxWidth: 760 }}>{ctx.summary}</div>
            <div className="assistantChipWrap" style={{ marginTop: 12 }}>
              {insight.badges.slice(0, 4).map((badge) => <span key={badge.label} className={`badge ${badge.tone}`}>{badge.label}</span>)}
            </div>
          </div>
        </div>
        <div className="shellStats">
          <div className="statPill"><b>{missionCount}</b><span>active missions</span></div>
          <div className="statPill"><b>{noteCount}</b><span>brain notes</span></div>
          <div className="statPill"><b>{goalCount}</b><span>saved goals</span></div>
        </div>
      </div>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
        <div className="small">{insight.headline}</div>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <button className="tabBtn" onClick={() => onNavigate("Brain")}>Open Brain</button>
          <button className="tabBtn" onClick={() => onNavigate("Calendar")}>Open Calendar</button>
          <button className="tabBtn" onClick={() => onFocusCommandBar?.()}>Focus command bar</button>
          <button className="tabBtn" onClick={onToggleMode}>Collapse</button>
        </div>
      </div>
    </div>
  );
}
export default function App() {
  const [active, setActiveRaw] = useState<string>(() => {
    const prefs: any = loadJSON("oddengine:prefs:v1", null as any);
    const start = String(prefs?.desktop?.startPanel || "Home");
    return normalizePanelId(loadJSON("oddengine:activePanel", start));
  });
  const [helpOpen, setHelpOpen] = useState(false);
  const [familyNight, setFamilyNight] = useState<boolean>(() => !!loadJSON("oddengine:familyNight", false));
  type CmdMode = "expanded" | "compact" | "collapsed";
  const [cmdMode, setCmdMode] = useState<CmdMode>(() => {
    // New tri-mode setting
    try {
      const raw = localStorage.getItem("oddengine:cmdMode");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed === "expanded" || parsed === "compact" || parsed === "collapsed") return parsed;
      }
    } catch(_e){}
    // Back-compat: old boolean key
    try {
      const old = JSON.parse(localStorage.getItem("oddengine:cmdCollapsed") || "true");
      return old ? "collapsed" : "expanded";
    } catch { return "collapsed"; }
  });

  type ShellMode = "expanded" | "compact";

  useEffect(() => {
    try {
      rememberPanelVisit(active);
      pushHomiePulse({
        id: `visit-${Date.now()}-${active}`,
        kind: "visit",
        title: `Opened ${normalizePanelId(active)}`,
        panelId: normalizePanelId(active),
        body: `Recent workspace updated for ${normalizePanelId(active)}.`,
        ts: Date.now(),
      });
    } catch {
      // ignore
    }
  }, [active]);

  const [shellMode, setShellMode] = useState<ShellMode>(() => {
    try {
      const raw = localStorage.getItem("oddengine:shellMode");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed === "expanded" || parsed === "compact") return parsed;
      }
    } catch(_e){}
    return "compact";
  });

  useEffect(() => {
    try { localStorage.setItem("oddengine:shellMode", JSON.stringify(shellMode)); } catch(_e){}
  }, [shellMode]);

  const setActive = (id: string) => setActiveRaw(normalizePanelId(id));
  const activeId = normalizePanelId(active);

  useEffect(() => {
    const handler = (evt: any) => {
      const enabled = !!(evt?.detail?.enabled);
      setFamilyNight(enabled);
      try { localStorage.setItem("oddengine:familyNight", JSON.stringify(enabled)); } catch(_e){}
    };
    window.addEventListener("oddengine:family-night", handler as any);
    return () => window.removeEventListener("oddengine:family-night", handler as any);
  }, []);

  useEffect(() => {
    try { localStorage.setItem("oddengine:cmdMode", JSON.stringify(cmdMode)); } catch(_e){}
    // keep legacy key updated for older builds
    try { localStorage.setItem("oddengine:cmdCollapsed", JSON.stringify(cmdMode === "collapsed")); } catch(_e){}
  }, [cmdMode]);


  const qs = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const forcedPanel = normalizePanelId((qs?.get("panel") || "").trim());
  const undockKind = (qs?.get("undock") || "").trim();

  const buddyMode = (qs?.get("buddy") || "").trim() === "1";

  useEffect(() => {
    if (!isDesktop() || buddyMode || forcedPanel) return;
    const prefs = loadPrefs();
    if (!prefs.ai.homieCompanionWindow) return;
    const key = "oddengine:homie-companion-opened:v1";
    if (sessionStorage.getItem(key) === "1") return;
    sessionStorage.setItem(key, "1");
    oddApi().openWindow?.({
      title: "Homie Buddy",
      query: { buddy: "1" },
      width: 420,
      height: 720,
      alwaysOnTop: true,
      frame: false,
      transparent: true,
      skipTaskbar: false,
      resizable: true,
    });
  }, [buddyMode, forcedPanel]);

  useEffect(() => { setHelpOpen(false); }, [activeId]);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "F1") {
        e.preventDefault();
        setHelpOpen((v) => !v);
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "/" || e.key === "?")) {
        e.preventDefault();
        setHelpOpen(true);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("oddengine:focus-commandbar"));
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "h") {
        e.preventDefault();
        setShellMode((m) => (m === "compact" ? "expanded" : "compact"));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const sec = loadJSON<any>("oddengine:security:v1", { ipLock: true });
  const host = window.location.hostname;
  const isLocal = host === "localhost" || host === "127.0.0.1" || host === "::1";
  const lanWarn = !sec.ipLock && !isLocal;

  useEffect(() => {
    localStorage.setItem("oddengine:activePanel", JSON.stringify(activeId));
    logActivity({ kind: "visit", panelId: activeId, title: `Opened ${activeId}`, body: `Mode: ${isDesktop() ? "Desktop" : "Web"}` });
  }, [activeId]);

  useEffect(() => {
    startAutomationLoop();
  }, []);

  const grouped = useMemo(() => {
    const groups: Record<string, typeof PANEL_META> = {} as any;
    for (const item of PANEL_META) {
      if (!groups[item.section]) groups[item.section] = [] as any;
      groups[item.section].push(item as any);
    }
    return groups;
  }, []);

  // HUD nav UX
  const [navQuery, setNavQuery] = useState<string>(() => String(loadJSON("oddengine:navQuery", "")));
  const [pinnedPanels, setPinnedPanels] = useState<string[]>(() => {
    const raw = loadJSON<any>("oddengine:pinnedPanels", []);
    return Array.isArray(raw) ? raw.map((x) => normalizePanelId(String(x))) : [];
  });

  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(() => {
    const raw: any = loadJSON("oddengine:navCollapsedSections", {} as any);
    return raw && typeof raw === "object" ? raw : {};
  });

  useEffect(() => {
    try { localStorage.setItem("oddengine:navCollapsedSections", JSON.stringify(collapsedSections)); } catch(_e){}
  }, [collapsedSections]);

  function toggleSection(section: string) {
    setCollapsedSections((prev) => ({ ...prev, [section]: !prev?.[section] }));
  }

  useEffect(() => {
    try { localStorage.setItem("oddengine:pinnedPanels", JSON.stringify(pinnedPanels)); } catch(_e){}
  }, [pinnedPanels]);

  useEffect(() => {
    try { localStorage.setItem("oddengine:navQuery", JSON.stringify(navQuery)); } catch(_e){}
  }, [navQuery]);

  const allPanels = useMemo(() => PANEL_META.map((p) => ({ ...p, id: normalizePanelId(p.id) })), []);
  const filteredPanels = useMemo(() => {
    const q = navQuery.trim().toLowerCase();
    if (!q) return allPanels;
    return allPanels.filter((p: any) => (p.title + " " + p.sub + " " + p.section).toLowerCase().includes(q));
  }, [allPanels, navQuery]);

  const pinnedItems = useMemo(() => {
    const map = new Map(allPanels.map((p: any) => [p.id, p]));
    return pinnedPanels.map((id) => map.get(id)).filter(Boolean);
  }, [allPanels, pinnedPanels]);

  function togglePin(panelId: string) {
    const id = normalizePanelId(panelId);
    setPinnedPanels((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [id, ...prev]));
  }

  if (buddyMode) {
    return (
      <div className="buddyStandaloneShell">
        <HomieBuddy activePanelId={activeId} onNavigate={setActive} onOpenHowTo={() => setHelpOpen(true)} mode="standalone" />
      </div>
    );
  }

  if (forcedPanel && qs?.has("panel")) {
    const showDock = panelHasDock(forcedPanel);
    return (
      <div className="layout" style={{ gridTemplateColumns: "1fr" }}>
        <div className="main" style={{ paddingTop: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, gap: 8, flexWrap: "wrap" }}>
            <div className="small" style={{ opacity: 0.9 }}>{undockKind ? `Undocked: ${undockKind}` : "Undocked"}</div>
            <button className="helpFab" onClick={() => setHelpOpen(true)} title="How to Use (F1)">ℹ️ How to Use (F1)</button>
          </div>
		  <HowToModal open={helpOpen} onClose={() => setHelpOpen(false)} panel={forcedPanel} />
		  <ErrorBoundary panelId={forcedPanel} label="Shell summary" onNavigate={setActive}>
		    <ShellSummary
		      activeId={forcedPanel}
		      onNavigate={setActive}
		      onFocusCommandBar={() => {
		        setCmdMode("compact");
		        window.dispatchEvent(new CustomEvent("oddengine:focus-commandbar"));
		      }}
		      mode={shellMode}
		      onToggleMode={() => setShellMode((m) => (m === "compact" ? "expanded" : "compact"))}
		    />
		  </ErrorBoundary>
          <ErrorBoundary panelId={forcedPanel} label="Command bar" onNavigate={setActive}><CommandBar mode={cmdMode} setMode={setCmdMode} activePanelId={forcedPanel} onNavigate={setActive} onOpenHowTo={() => setHelpOpen(true)} /></ErrorBoundary>
          <div className={showDock ? "panelShell" : "panelSolo"}>
            <div className="panelMain" data-panelid={forcedPanel}>
              <CardGODMode panelId={forcedPanel} />
              <ErrorBoundary panelId={forcedPanel} label={forcedPanel} onNavigate={setActive}>{<Suspense fallback={<PanelLoading panelId={forcedPanel} />}>{renderPanel(forcedPanel, () => {}, forcedPanel, () => setHelpOpen(true))}</Suspense>}</ErrorBoundary>
            </div>
            {showDock && <ErrorBoundary panelId={forcedPanel} label={`${forcedPanel} assistant`} onNavigate={setActive}><AssistantDock panelId={forcedPanel} onNavigate={setActive} onOpenHowTo={() => setHelpOpen(true)} /></ErrorBoundary>}
          </div>
          <HomieBuddy activePanelId={forcedPanel} onNavigate={setActive} onOpenHowTo={() => setHelpOpen(true)} />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`layout layoutWide ${familyNight ? "familyNight" : ""}`.trim()}
      style={{ "--os-wallpaper": `url(${osWallpaper})` } as any}
    >
      <div className="rail">
        <div>
          <div className="card brandRailCard">
            <img src={fairlyOddLogo} alt="FairlyOdd" className="brandLogo" />
            <div className="brandWord">FairlyOdd OS</div>
            <div className="brandTag">Mission-driven family, trading, grow, and operator workflow in one shell.</div>
          </div>
          <div className="hudNavSearch">
            <input
              value={navQuery}
              onChange={(e) => setNavQuery(e.target.value)}
              placeholder="Search panels…"
            />
          </div>

                    {(() => {
            if (!pinnedItems.length) return null;
            const key = "__favorites";
            const collapsed = !!collapsedSections[key];
            return (
              <div>
                <div className="navSectionHeader" onClick={() => toggleSection(key)}>
                  <div className="navSectionTitle">Favorites</div>
                  <div className="navSectionMeta">
                    <span className="navSectionCount">{pinnedItems.length}</span>
                    <span className={"navCaret " + (collapsed ? "collapsed" : "")}>▾</span>
                  </div>
                </div>
                {!collapsed && pinnedItems.map((it: any) => (
                  <div key={it.id} className={"navItem " + (activeId === it.id ? "active" : "")} onClick={() => setActive(it.id)}>
                    <div className="navIcon">{it.icon}</div>
                    <div style={{ minWidth: 0 }}>
                      <div className="navTitle">{it.title}</div>
                      <div className="navSub">{it.sub}</div>
                    </div>
                    <button
                      className="pinBtn pinned"
                      title="Unpin"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); togglePin(it.id); }}
                    >★</button>
                  </div>
                ))}
              </div>
            );
          })()}

          {Object.entries(grouped).map(([section, items]) => {
            const visible = (items as any[]).filter((it) => filteredPanels.find((p: any) => p.id === it.id));
            if (!visible.length) return null;
            return (
              <div key={section}>
                <div className="navSectionHeader" onClick={() => toggleSection(section)}>
                  <div className="navSectionTitle">{section}</div>
                  <div className="navSectionMeta">
                    <span className="navSectionCount">{visible.length}</span>
                    <span className={"navCaret " + ((!!collapsedSections[section]) ? "collapsed" : "")}>▾</span>
                  </div>
                </div>
                {!collapsedSections[section] && visible.map((it: any) => (
                  <div key={it.id} className={"navItem " + (activeId === it.id ? "active" : "")} onClick={() => setActive(it.id)}>
                    <div className="navIcon">{it.icon}</div>
                    <div style={{ minWidth: 0 }}>
                      <div className="navTitle">{it.title}</div>
                      <div className="navSub">{it.sub}</div>
                    </div>
                    <button
                      className={"pinBtn " + (pinnedPanels.includes(it.id) ? "pinned" : "")}
                      title={pinnedPanels.includes(it.id) ? "Unpin" : "Pin"}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); togglePin(it.id); }}
                    >★</button>
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: "auto", padding: "10px 12px", opacity: 0.9 }}>
          <div className="small">v{APP_VERSION} • {isDesktop() ? "Desktop" : "Web"}</div>
        </div>
      </div>

      <div className="main">
        <HowToModal open={helpOpen} onClose={() => setHelpOpen(false)} howto={(HOWTO as any)[activeId] ?? null} />
        {(HOWTO as any)[activeId] && (
          <button className="helpFab" onClick={() => setHelpOpen(true)} title="How to use this panel (F1)">ℹ️ How to Use (F1)</button>
        )}

        {lanWarn && (
          <div className="bannerLan">⚠️ <b>LAN mode:</b> IP Lock is OFF and you are not on localhost. Don’t leave this exposed.</div>
        )}

        {familyNight && (
          <div className="bannerFamilyNight">
            <div>
              🎬 <b>Family Night Mode</b> is ON — UI dimmed + distractions reduced.
            </div>
            <button className="btn ghost" onClick={() => window.dispatchEvent(new CustomEvent("oddengine:family-night", { detail: { enabled: false } }))}>
              Exit
            </button>
          </div>
        )}

		<ErrorBoundary panelId={activeId} label="Shell summary" onNavigate={setActive}>
		  <ShellSummary
		    activeId={activeId}
		    onNavigate={setActive}
		    onFocusCommandBar={() => {
		      setCmdMode("compact");
		      window.dispatchEvent(new CustomEvent("oddengine:focus-commandbar"));
		    }}
		    mode={shellMode}
		    onToggleMode={() => setShellMode((m) => (m === "compact" ? "expanded" : "compact"))}
		  />
		</ErrorBoundary>
        <ErrorBoundary panelId={activeId} label="Command bar" onNavigate={setActive}><CommandBar mode={cmdMode} setMode={setCmdMode} activePanelId={activeId} onNavigate={setActive} onOpenHowTo={() => setHelpOpen(true)} /></ErrorBoundary>

        <div className={panelHasDock(activeId) ? "panelShell" : "panelSolo"}>
          <div className="panelMain" data-panelid={activeId}>
            <CardGODMode panelId={activeId} />
            <ErrorBoundary panelId={activeId} label={activeId} onNavigate={setActive}>{<Suspense fallback={<PanelLoading panelId={activeId} />}>{renderPanel(activeId, setActive, activeId, () => setHelpOpen(true))}</Suspense>}</ErrorBoundary>
          </div>
          {panelHasDock(activeId) && <ErrorBoundary panelId={activeId} label={`${activeId} assistant`} onNavigate={setActive}><AssistantDock panelId={activeId} onNavigate={setActive} onOpenHowTo={() => setHelpOpen(true)} /></ErrorBoundary>}
        </div>
      </div>

      <ErrorBoundary panelId={activeId} label="AI inbox rail" onNavigate={setActive}><ActivityRail activePanelId={activeId} onNavigate={setActive} /></ErrorBoundary>
      <LilHomieAgent activePanelId={activeId} onNavigate={setActive} />
      <HomieBuddy activePanelId={activeId} onNavigate={setActive} onOpenHowTo={() => setHelpOpen(true)} />
    </div>
  );
}
