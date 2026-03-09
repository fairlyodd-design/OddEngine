import React, { useEffect, useMemo, useRef, useState } from "react";
import { COMMAND_SUGGESTIONS, executeCommand } from "../lib/commandCenter";
import { getVoiceEngineBadges, loadVoiceEngineSnapshot, summarizeVoiceEngine, type VoiceEngineSnapshot } from "../lib/voice";

type VoiceStatusDetail = {
  status?: "started" | "transcript" | "error" | "ended" | "info";
  message?: string;
  transcript?: string;
  source?: string;
};

type CmdMode = "expanded" | "compact" | "collapsed";

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

  useEffect(() => {
    const focus = () => {
      if (mode === "collapsed") setMode?.("compact");
      // wait a tick so the input exists after expanding
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

  type Cat = "All" | "Daily" | "Trading" | "Grow" | "Family" | "System";
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
    if (/(trading|nvda|spy|options|chain|contract|put|call|risk)/.test(t)) return "Trading";
    if (/(grow|vpd|ac\s*infinity|tent|flower|veg|nutrient|cannabis)/.test(t)) return "Grow";
    if (/(family|health|doctor|med|budget|grocery|meals)/.test(t)) return "Family";
    if (/(install|repair|bridge|deps|plugin|update|probe|voice)/.test(t)) return "System";
    if (/(morning|daily|digest|briefing|run next|operator)/.test(t)) return "Daily";
    return "All";
  }

  const filtered = useMemo(() => {
    if (cat === "All") return suggested;
    return suggested.filter((c) => inferCat(c) === cat);
  }, [suggested, cat]);

  function runCommand(raw?: string) {
    const text = (raw ?? input).trim();
    if (!text) return;
    setRecent((prev) => [text, ...prev.filter((x) => x !== text)].slice(0, 16));
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

  if (isCollapsed) {
    const favCount = favorites.length;
    const rec = recent[0] || "";
    return (
      <div className="commandBar card heroCard commandBarCollapsed">
        <div className="row commandBarRow">
          <div className="commandLabel">AI Command Bar</div>
          <div className="small" style={{ opacity: 0.85, flex: 1, minWidth: 220 }}>
            HUD mode: collapsed • {favCount ? `${favCount}★ favorites` : "no favorites yet"}{rec ? ` • last: ${rec}` : ""}
          </div>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
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
            placeholder="Try: morning digest • refresh news • run trading chain"
          />
          <button className={`tabBtn ${listening ? "active" : ""}`} onClick={startVoice}>{listening ? "Stop" : "Voice"}</button>
          <button onClick={() => runCommand()}>Run</button>
          <button className="tabBtn" onClick={() => setMode?.("expanded")} title="Expand (full HUD)">Expand</button>
          <button className="tabBtn" onClick={() => setMode?.("collapsed")} title="Collapse (tiny HUD)">Collapse</button>
        </div>
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
          placeholder="Try: morning digest • refresh news • research family health • build grocery list • run trading chain"
        />
        <button className={`tabBtn ${listening ? "active" : ""}`} onClick={startVoice}>{listening ? "Stop voice" : "Voice via Homie"}</button>
        <button onClick={() => runCommand()}>Run</button>
        <button className="tabBtn" onClick={() => setMode?.("compact")} title="Shrink (clean HUD)">Shrink</button>
        <button className="tabBtn" onClick={() => setMode?.("collapsed")} title="Collapse (tiny HUD)">Collapse</button>
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
      <div className="small" style={{ marginTop: 8 }}>Tip: press <b>Ctrl/Cmd + K</b> to jump here fast. Voice now routes through Homie so diagnostics and fallback behavior stay in one place.</div>
      {status && <div className="small" style={{ marginTop: 8 }}>{status}</div>}
    </div>
  );
}