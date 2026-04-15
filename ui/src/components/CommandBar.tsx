import React, { useEffect, useMemo, useRef, useState } from "react";
import { COMMAND_SUGGESTIONS, executeCommand } from "../lib/commandCenter";
import { getPanelMeta, runQuickAction } from "../lib/brain";
import { getOperatorBrainSnapshot } from "../lib/operatorBrain";
import { getVoiceEngineBadges, loadVoiceEngineSnapshot, summarizeVoiceEngine, type VoiceEngineSnapshot } from "../lib/voice";

type VoiceStatusDetail = {
  status?: "started" | "transcript" | "error" | "ended" | "info";
  message?: string;
  transcript?: string;
  source?: string;
};

type CmdMode = "expanded" | "compact" | "collapsed";

type GodModeAction = {
  id: string;
  label: string;
  hint: string;
  panelId: string;
  actionId?: string;
};

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
  const [brainTick, setBrainTick] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

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

  useEffect(() => {
    const refresh = () => setBrainTick((x) => x + 1);
    const t = window.setInterval(refresh, 30000);
    window.addEventListener("storage", refresh);
    window.addEventListener("oddengine:calendar-changed", refresh as EventListener);
    window.addEventListener("oddengine:calendar-done-changed", refresh as EventListener);
    return () => {
      window.clearInterval(t);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("oddengine:calendar-changed", refresh as EventListener);
      window.removeEventListener("oddengine:calendar-done-changed", refresh as EventListener);
    };
  }, []);

  const suggested = useMemo(() => COMMAND_SUGGESTIONS, []);

  type Cat = "All" | "Daily" | "Trading" | "Grow" | "Family" | "System";
  const [cat, setCat] = useState<Cat>("All");
  const [favorites, setFavorites] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("oddengine:cmdFavorites") || "[]") || []; } catch { return []; }
  });
  const [recent, setRecent] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("oddengine:cmdRecent") || "[]") || []; } catch { return []; }
  });

  useEffect(() => {
    try { localStorage.setItem("oddengine:cmdFavorites", JSON.stringify(favorites.slice(0, 24))); } catch (_e) {}
  }, [favorites]);
  useEffect(() => {
    try { localStorage.setItem("oddengine:cmdRecent", JSON.stringify(recent.slice(0, 16))); } catch (_e) {}
  }, [recent]);

  function inferCat(cmd: string): Cat {
    const t = cmd.toLowerCase();
    if (/(trading|nvda|spy|options|chain|contract|put|call|risk)/.test(t)) return "Trading";
    if (/(grow|vpd|ac\s*infinity|tent|flower|veg|nutrient|cannabis)/.test(t)) return "Grow";
    if (/(family|health|doctor|med|budget|grocery|meals|chores)/.test(t)) return "Family";
    if (/(install|repair|bridge|deps|plugin|update|probe|voice)/.test(t)) return "System";
    if (/(morning|daily|digest|briefing|run next|operator|phoenix|what matters|next move)/.test(t)) return "Daily";
    return "All";
  }

  const filtered = useMemo(() => {
    if (cat === "All") return suggested;
    return suggested.filter((c) => inferCat(c) === cat);
  }, [suggested, cat]);

  const snapshot = useMemo(() => {
    void brainTick;
    return getOperatorBrainSnapshot();
  }, [brainTick, activePanelId]);

  const godModeActions = useMemo<GodModeAction[]>(() => {
    const actions: GodModeAction[] = [
      {
        id: "what-matters-now",
        label: "What matters now",
        hint: snapshot.whatMattersNow.title,
        panelId: snapshot.whatMattersNow.panelId,
        actionId: snapshot.whatMattersNow.actionId,
      },
      {
        id: "do-this-next",
        label: "Do this next",
        hint: snapshot.whatToDoNext.title,
        panelId: snapshot.whatToDoNext.panelId,
        actionId: snapshot.whatToDoNext.actionId,
      },
      {
        id: "family-lane",
        label: "Family lane",
        hint: snapshot.familyLane.title,
        panelId: snapshot.familyLane.panelId,
        actionId: snapshot.familyLane.actionId,
      },
      {
        id: "operator-lane",
        label: "Operator lane",
        hint: snapshot.operatorLane.title,
        panelId: snapshot.operatorLane.panelId,
        actionId: snapshot.operatorLane.actionId,
      },
      {
        id: "money-lane",
        label: "Money lane",
        hint: "Household financial ops",
        panelId: "Money",
      },
      {
        id: "calendar-lane",
        label: "Calendar",
        hint: snapshot.todayTasks.length ? `${snapshot.todayTasks.length} task${snapshot.todayTasks.length === 1 ? "" : "s"} today` : "Open the shared family timeline",
        panelId: "Calendar",
      },
    ];
    const seen = new Set<string>();
    return actions.filter((item) => {
      const key = `${item.label}:${item.panelId}:${item.actionId || ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 6);
  }, [snapshot]);

  function runCommand(raw?: string) {
    const text = (raw ?? input).trim();
    if (!text) return;
    setRecent((prev) => [text, ...prev.filter((x) => x !== text)].slice(0, 16));
    executeCommand({ text, activePanelId, onNavigate, onOpenHowTo, onStatus: setStatus });
    setInput("");
    setBrainTick((x) => x + 1);
  }

  function runGodModeAction(action: GodModeAction) {
    if (action.actionId) {
      const result = runQuickAction(action.actionId);
      if (result.panelId) onNavigate(result.panelId);
      setStatus(result.message || action.hint);
      setBrainTick((x) => x + 1);
      return;
    }
    onNavigate(action.panelId);
    setStatus(`${getPanelMeta(action.panelId).title} • ${action.hint}`);
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

  if (isCollapsed) {
    const favCount = favorites.length;
    const rec = recent[0] || "";
    return (
      <div className="commandBar card heroCard commandBarCollapsed">
        <div className="row commandBarRow">
          <div className="commandLabel">AI Command Bar</div>
          <div className="small" style={{ opacity: 0.85, flex: 1, minWidth: 220 }}>
            HUD mode: collapsed • {favCount ? `${favCount}★ favorites` : "no favorites yet"}{rec ? ` • last: ${rec}` : ""} • next: {snapshot.whatToDoNext.title}
          </div>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <button className="tabBtn" onClick={() => runGodModeAction(godModeActions[1] || godModeActions[0])}>Run next</button>
            <button className="tabBtn" onClick={() => { setMode?.("compact"); setTimeout(() => window.dispatchEvent(new CustomEvent("oddengine:focus-commandbar")), 10); }}>Shrink</button>
            <button className="tabBtn" onClick={() => { setMode?.("expanded"); setTimeout(() => window.dispatchEvent(new CustomEvent("oddengine:focus-commandbar")), 10); }}>Expand</button>
          </div>
        </div>
      </div>
    );
  }

  if (isCompact) {
    return (
      <div className="commandBar card heroCard commandBarCompact">
        <div className="row commandBarRow">
          <div className="commandLabel">AI Command Bar</div>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") runCommand(); }}
            placeholder="Try: what matters now • do this next • family lane • run trading chain"
          />
          <button className={`tabBtn ${listening ? "active" : ""}`} onClick={startVoice}>{listening ? "Stop" : "Voice"}</button>
          <button onClick={() => runCommand()}>Run</button>
          <button className="tabBtn" onClick={() => setMode?.("expanded")} title="Expand (full HUD)">Expand</button>
          <button className="tabBtn" onClick={() => setMode?.("collapsed")} title="Collapse (tiny HUD)">Collapse</button>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 10, alignItems: "center" }}>
          {godModeActions.slice(0, 4).map((action) => (
            <button key={action.id} className="tabBtn active" onClick={() => runGodModeAction(action)} title={action.hint}>
              {action.label}
            </button>
          ))}
        </div>
        {!!quick.length && (
          <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 10, alignItems: "center" }}>
            <span className="small" style={{ opacity: 0.8 }}>{favorites.length ? "Favorites:" : "Recent:"}</span>
            {quick.map((cmd) => (
              <button key={cmd} className={`tabBtn ${favorites.includes(cmd) ? "active" : ""}`} onClick={() => runCommand(cmd)} title="Run">
                {favorites.includes(cmd) ? "★ " : ""}{cmd}
              </button>
            ))}
            <span className="small" style={{ opacity: 0.7, marginLeft: 4 }}>Tip: Ctrl/Cmd + K focuses this bar.</span>
          </div>
        )}
        {!!status && <div className="small" style={{ marginTop: 8 }}>{status}</div>}
      </div>
    );
  }

  return (
    <div className="commandBar card heroCard">
      <div className="row commandBarRow">
        <div className="commandLabel">AI Command Bar</div>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") runCommand(); }}
          placeholder="Try: what matters now • do this next • family lane • operator lane • run trading chain"
        />
        <button className={`tabBtn ${listening ? "active" : ""}`} onClick={startVoice}>{listening ? "Stop voice" : "Voice via Homie"}</button>
        <button onClick={() => runCommand()}>Run</button>
        <button className="tabBtn" onClick={() => setMode?.("compact")} title="Shrink (clean HUD)">Shrink</button>
        <button className="tabBtn" onClick={() => setMode?.("collapsed")} title="Collapse (tiny HUD)">Collapse</button>
      </div>

      <div className="card" style={{ marginTop: 10, padding: 12, background: "rgba(12,18,28,0.5)" }}>
        <div className="small shellEyebrow">GOD MODE PHOENIX</div>
        <div style={{ fontWeight: 900, marginTop: 4 }}>{snapshot.whatMattersNow.title}</div>
        <div className="small" style={{ marginTop: 6 }}>{snapshot.whatMattersNow.text}</div>
        <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          {godModeActions.map((action) => (
            <button key={action.id} className="tabBtn active" onClick={() => runGodModeAction(action)} title={action.hint}>
              {action.label}
            </button>
          ))}
        </div>
      </div>

      <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 10, alignItems: "center" }}>
        {(["All","Daily","Trading","Grow","Family","System"] as Cat[]).map((c) => (
          <button key={c} className={`tabBtn ${cat === c ? "active" : ""}`} onClick={() => setCat(c)}>{c}</button>
        ))}
        <span className="small" style={{ opacity: 0.75, marginLeft: 6 }}>Tip: star your go-to commands.</span>
      </div>

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
          <div className="small" style={{ opacity: 0.85, marginBottom: 6 }}>Recent</div>
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
      <div className="small" style={{ marginTop: 8 }}>
        Tip: press <b>Ctrl/Cmd + K</b> to jump here fast. God Mode quick actions now mirror the shared Phoenix daily truth lane.
      </div>
      {status && <div className="small" style={{ marginTop: 8 }}>{status}</div>}
    </div>
  );
}
