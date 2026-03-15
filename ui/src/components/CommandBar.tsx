import React, { useEffect, useMemo, useRef, useState } from "react";
import { COMMAND_SUGGESTIONS, executeCommand } from "../lib/commandCenter";
import { getVoiceEngineBadges, loadVoiceEngineSnapshot, summarizeVoiceEngine, type VoiceEngineSnapshot } from "../lib/voice";
import { PANEL_META, getPanelMeta, normalizePanelId } from "../lib/brain";
import { addPulse, recordPanelVisit, togglePinnedPanel } from "../lib/osActionCenter";
import ActionCenterDock from "./ActionCenterDock";

type VoiceStatusDetail = {
  status?: "started" | "transcript" | "error" | "ended" | "info";
  message?: string;
  transcript?: string;
  source?: string;
};

type CmdMode = "expanded" | "compact" | "collapsed";

type Cat = "All" | "Daily" | "Trading" | "Grow" | "Family" | "System";

export default function CommandBar({
  activePanelId,
  onNavigate,
  onOpenHowTo,
  mode = "expanded",
  setMode,
}: {
  activePanelId: string;
  onNavigate: (id: string) => void;
  onOpenHowTo?: () => void;
  mode?: CmdMode;
  setMode?: (next: CmdMode) => void;
}) {
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("");
  const [listening, setListening] = useState(false);
  const [voiceSnapshot, setVoiceSnapshot] = useState<VoiceEngineSnapshot>(() => loadVoiceEngineSnapshot());
  const inputRef = useRef<HTMLInputElement | null>(null);
  const activeNormalized = normalizePanelId(activePanelId);

  useEffect(() => {
    recordPanelVisit(activeNormalized);
  }, [activeNormalized]);

  useEffect(() => {
    const focus = () => {
      if (mode === "collapsed") setMode?.("compact");
      setTimeout(() => inputRef.current?.focus(), 30);
    };
    const onVoiceStatus = (event: Event) => {
      const detail = (event as CustomEvent<VoiceStatusDetail>).detail || {};
      if (detail.source && detail.source !== "commandbar") return;
      if (detail.status === "started") setListening(true);
      if (detail.status === "ended" || detail.status === "error") setListening(false);
      if (detail.transcript) setInput(detail.transcript);
      if (detail.message) setStatus(detail.message);
    };
    const onVoiceEngine = () => setVoiceSnapshot(loadVoiceEngineSnapshot());
    window.addEventListener("oddengine:focus-commandbar", focus as EventListener);
    window.addEventListener("oddengine:voice-status", onVoiceStatus as EventListener);
    window.addEventListener("oddengine:voice-engine-changed", onVoiceEngine as EventListener);
    window.addEventListener("storage", onVoiceEngine as EventListener);
    return () => {
      window.removeEventListener("oddengine:focus-commandbar", focus as EventListener);
      window.removeEventListener("oddengine:voice-status", onVoiceStatus as EventListener);
      window.removeEventListener("oddengine:voice-engine-changed", onVoiceEngine as EventListener);
      window.removeEventListener("storage", onVoiceEngine as EventListener);
    };
  }, [mode, setMode]);

  const suggested = useMemo(() => COMMAND_SUGGESTIONS, []);
  const searchablePanels = useMemo(() => PANEL_META, []);

  const [cat, setCat] = useState<Cat>("All");
  const [favorites, setFavorites] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("oddengine:cmdFavorites") || "[]") || []; } catch { return []; }
  });
  const [recent, setRecent] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("oddengine:cmdRecent") || "[]") || []; } catch { return []; }
  });

  useEffect(() => {
    try { localStorage.setItem("oddengine:cmdFavorites", JSON.stringify(favorites.slice(0, 24))); } catch(_e){}
  }, [favorites]);
  useEffect(() => {
    try { localStorage.setItem("oddengine:cmdRecent", JSON.stringify(recent.slice(0, 16))); } catch(_e){}
  }, [recent]);

  function inferCat(cmd: string): Cat {
    const t = cmd.toLowerCase();
    if (/(trading|nvda|spy|options|chain|contract|put|call|risk|market|graph)/.test(t)) return "Trading";
    if (/(grow|vpd|ac\s*infinity|tent|flower|veg|nutrient|cannabis)/.test(t)) return "Grow";
    if (/(family|health|doctor|med|budget|grocery|meals|calendar|chores)/.test(t)) return "Family";
    if (/(install|repair|bridge|deps|plugin|update|probe|voice|command|status)/.test(t)) return "System";
    if (/(morning|daily|digest|briefing|run next|operator|resume)/.test(t)) return "Daily";
    return "All";
  }

  const filtered = useMemo(() => {
    if (cat === "All") return suggested;
    return suggested.filter((c) => inferCat(c) === cat);
  }, [suggested, cat]);

  const panelMatches = useMemo(() => {
    const q = input.trim().toLowerCase();
    if (!q) return [] as typeof searchablePanels;
    const cleaned = q.replace(/^(open|go to|jump to|resume)\s+/i, "");
    return searchablePanels
      .filter((panel) => {
        const hay = `${panel.id} ${panel.title} ${panel.sub} ${panel.section}`.toLowerCase();
        return hay.includes(cleaned);
      })
      .slice(0, 7);
  }, [input, searchablePanels]);

  function runPanelOpen(panelId: string) {
    const meta = getPanelMeta(panelId);
    onNavigate(panelId);
    setStatus(`Opened ${meta.title}.`);
    addPulse({ kind: "good", label: `Opened ${meta.title}`, body: meta.sub, panelId });
    setInput("");
  }

  function trySmartPanelOpen(text: string) {
    const q = text.trim();
    if (!q) return false;
    const cleaned = q.replace(/^(open|go to|jump to|resume)\s+/i, "").trim().toLowerCase();
    if (!cleaned) return false;
    const match = searchablePanels.find((panel) => {
      const hay = `${panel.id} ${panel.title} ${panel.title.replace(/\s+/g, "")}`.toLowerCase();
      return hay.includes(cleaned);
    });
    if (!match) return false;
    runPanelOpen(match.id);
    return true;
  }

  function runCommand(raw?: string) {
    const text = (raw ?? input).trim();
    if (!text) return;
    setRecent((prev) => [text, ...prev.filter((x) => x !== text)].slice(0, 16));
    if (trySmartPanelOpen(text)) return;
    executeCommand({ text, activePanelId, onNavigate, onOpenHowTo, onStatus: setStatus });
    setInput("");
  }

  function toggleFavorite(cmd: string) {
    setFavorites((prev) => (prev.includes(cmd) ? prev.filter((x) => x !== cmd) : [cmd, ...prev]));
  }

  function startVoice() {
    window.dispatchEvent(new CustomEvent("oddengine:voice-request", { detail: { source: "commandbar", action: listening ? "stop" : "listen" } }));
    if (!listening) setStatus("Asked Homie to listen for a command…");
  }

  const isCollapsed = mode === "collapsed";
  const isCompact = mode === "compact";
  const quick = (favorites.length ? favorites : recent).slice(0, 6);
  const activeMeta = getPanelMeta(activeNormalized);

  const searchLane = panelMatches.length ? (
    <div className="commandSearchLane">
      <div className="small shellEyebrow">Open panels fast</div>
      <div className="commandResultList">
        {panelMatches.map((panel) => (
          <button key={panel.id} className="commandResultItem" onClick={() => runPanelOpen(panel.id)}>
            <span className="commandResultTitle">{panel.icon} {panel.title}</span>
            <small>{panel.sub}</small>
          </button>
        ))}
      </div>
    </div>
  ) : null;

  if (isCollapsed) {
    const favCount = favorites.length;
    const rec = recent[0] || "";
    return (
      <>
        <div className="commandBar card heroCard commandBarCollapsed">
          <div className="row commandBarRow">
            <div className="commandLabel">Action Center</div>
            <div className="small" style={{ opacity: 0.85, flex: 1, minWidth: 220 }}>
              HUD mode: collapsed • {favCount ? `${favCount}★ favorites` : "no favorites yet"}{rec ? ` • last: ${rec}` : ""}
            </div>
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <button className="tabBtn" onClick={() => togglePinnedPanel(activeMeta.id)}>Pin {activeMeta.title}</button>
              <button className="tabBtn" onClick={() => { setMode?.("compact"); setTimeout(() => window.dispatchEvent(new CustomEvent("oddengine:focus-commandbar")), 10); }}>Open HUD</button>
            </div>
          </div>
        </div>
        <ActionCenterDock activePanelId={activeNormalized} onNavigate={onNavigate} mode="collapsed" />
      </>
    );
  }

  if (isCompact) {
    return (
      <>
        <div className="commandBar card heroCard commandBarCompact">
          <div className="row commandBarRow">
            <div className="commandLabel">Action Center</div>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") runCommand(); }}
              placeholder="Open any panel • resume Trading • open Calendar • run trading chain"
            />
            <button className={`tabBtn ${listening ? "active" : ""}`} onClick={startVoice}>{listening ? "Stop" : "Voice"}</button>
            <button onClick={() => runCommand()}>Run</button>
            <button className="tabBtn" onClick={() => togglePinnedPanel(activeMeta.id)}>Pin</button>
            <button className="tabBtn" onClick={() => setMode?.("expanded")} title="Expand (full HUD)">Expand</button>
            <button className="tabBtn" onClick={() => setMode?.("collapsed")} title="Collapse (tiny HUD)">Collapse</button>
          </div>
          {searchLane}
          {!!quick.length && (
            <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 10, alignItems: "center" }}>
              <span className="small" style={{ opacity: 0.8 }}>{favorites.length ? "Favorites:" : "Recent:"}</span>
              {quick.map((cmd) => (
                <button key={cmd} className={`tabBtn ${favorites.includes(cmd) ? "active" : ""}`} onClick={() => runCommand(cmd)} title="Run">{favorites.includes(cmd) ? "★ " : ""}{cmd}</button>
              ))}
              <span className="small" style={{ opacity: 0.7, marginLeft: 4 }}>Tip: Ctrl/Cmd + K focuses this bar.</span>
            </div>
          )}
          {!!status && <div className="small" style={{ marginTop: 8 }}>{status}</div>}
        </div>
        <ActionCenterDock activePanelId={activeNormalized} onNavigate={onNavigate} mode="compact" />
      </>
    );
  }

  return (
    <>
      <div className="commandBar card heroCard commandBarEnhanced">
        <div className="row commandBarRow">
          <div className="commandLabel">Action Center</div>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") runCommand(); }}
            placeholder="Open any panel • resume Trading • continue Studio • open Grocery Meals • run trading chain"
          />
          <button className={`tabBtn ${listening ? "active" : ""}`} onClick={startVoice}>{listening ? "Stop voice" : "Voice via Homie"}</button>
          <button onClick={() => runCommand()}>Run</button>
          <button className="tabBtn" onClick={() => togglePinnedPanel(activeMeta.id)}>Pin active</button>
          <button className="tabBtn" onClick={() => setMode?.("compact")} title="Shrink (clean HUD)">Shrink</button>
          <button className="tabBtn" onClick={() => setMode?.("collapsed")} title="Collapse (tiny HUD)">Collapse</button>
        </div>

        <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 10, alignItems: "center" }}>
          {(["All","Daily","Trading","Grow","Family","System"] as Cat[]).map((c) => (
            <button key={c} className={`tabBtn ${cat === c ? "active" : ""}`} onClick={() => setCat(c)}>{c}</button>
          ))}
          <span className="small" style={{ opacity: 0.75, marginLeft: 6 }}>Search commands, panels, and resume lanes from one place.</span>
        </div>

        {searchLane}

        {!!favorites.length && (
          <div style={{ marginTop: 10 }}>
            <div className="small" style={{ opacity: 0.85, marginBottom: 6 }}>Favorites</div>
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              {favorites.slice(0, 8).map((cmd) => (
                <button key={cmd} className="tabBtn active" onClick={() => runCommand(cmd)} title="Run favorite">★ {cmd}</button>
              ))}
            </div>
          </div>
        )}

        {!!recent.length && (
          <div style={{ marginTop: 10 }}>
            <div className="small" style={{ opacity: 0.85, marginBottom: 6 }}>Recent commands</div>
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              {recent.slice(0, 8).map((cmd) => (
                <button key={cmd} className="tabBtn" onClick={() => runCommand(cmd)}>{cmd}</button>
              ))}
            </div>
          </div>
        )}

        <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          {filtered.map((cmd) => (
            <div key={cmd} className="cmdChipWrap">
              <button className="tabBtn" onClick={() => runCommand(cmd)}>{cmd}</button>
              <button className={`cmdStar ${favorites.includes(cmd) ? "on" : ""}`} onClick={() => toggleFavorite(cmd)} title={favorites.includes(cmd) ? "Unfavorite" : "Favorite"}>★</button>
            </div>
          ))}
        </div>

        <div className="assistantChipWrap" style={{ marginTop: 10 }}>
          {getVoiceEngineBadges(voiceSnapshot).map((badge) => (
            <span key={badge.label} className={`badge ${badge.tone}`}>{badge.label}</span>
          ))}
        </div>
        <div className="small" style={{ marginTop: 8 }}>{summarizeVoiceEngine(voiceSnapshot)}</div>
        <div className="small" style={{ marginTop: 8 }}>Tip: press <b>Ctrl/Cmd + K</b> to jump here fast. This lane now doubles as your global launcher, action center, and live status dock.</div>
        {status && <div className="small" style={{ marginTop: 8 }}>{status}</div>}
      </div>
      <ActionCenterDock activePanelId={activeNormalized} onNavigate={onNavigate} />
    </>
  );
}
