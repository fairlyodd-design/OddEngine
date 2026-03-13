import React, { useEffect, useMemo, useState } from "react";
import HomieAvatar from "../components/HomieAvatar";
import {
  buildHomiePresenceFromCore,
  buildHomieQuickActions,
  buildHomieStatusLine,
  loadHomieCoreState,
  saveHomieCoreState,
  updateHomieCoreState,
  type HomieCoreMode,
  type HomieCoreState,
} from "../lib/homieRealLifeCore";

type Props = {
  activePanel?: string;
  onNavigate?: (panelId: string) => void;
};

const MODES: HomieCoreMode[] = ["idle", "assist", "talk", "observe", "mission"];

function copy(text: string) {
  return navigator.clipboard.writeText(text);
}

export default function Homie({ activePanel = "Home", onNavigate }: Props) {
  const [state, setState] = useState<HomieCoreState>(() => loadHomieCoreState());
  const [memoryDraft, setMemoryDraft] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setState((prev) => ({ ...prev, activePanel }));
  }, [activePanel]);

  useEffect(() => {
    saveHomieCoreState(state);
  }, [state]);

  const emotion = useMemo(() => buildHomiePresenceFromCore(state), [state]);
  const quickActions = useMemo(() => buildHomieQuickActions(state), [state]);
  const statusLine = useMemo(() => buildHomieStatusLine(state), [state]);

  const applyPatch = (patch: Partial<HomieCoreState>) => {
    const next = updateHomieCoreState(patch);
    setState(next);
  };

  const addMemoryNote = () => {
    const note = memoryDraft.trim();
    if (!note) return;
    applyPatch({ memoryNotes: [note, ...state.memoryNotes].slice(0, 12) });
    setMemoryDraft("");
  };

  const copySummary = async () => {
    const text = [
      `Homie core mode: ${state.mode}`,
      `Emotion: ${emotion}`,
      `Active panel: ${state.activePanel}`,
      `Mission focus: ${state.missionFocus}`,
      `Next action: ${state.nextSuggestedAction}`,
      `Memory notes: ${state.memoryNotes.join(" | ") || "None"}`,
    ].join("\n");
    await copy(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="card softCard">
        <div className="small shellEyebrow">REAL LIFE HOMIE CORE</div>
        <div className="h mt-2">Embodied AI assistant control deck</div>
        <div className="sub mt-2">
          One place to control Homie’s body, voice, vision, memory, mission focus, and next-best action behavior.
        </div>
      </div>

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "minmax(320px, 400px) minmax(0, 1fr)", alignItems: "start" }}>
        <div style={{ display: "grid", gap: 16 }}>
          <div className="card softCard" style={{ minHeight: 460, display: "grid", placeItems: "center" }}>
            <HomieAvatar
              emotion={emotion}
              speaking={state.mode === "talk" && state.speakerEnabled}
              listening={state.micEnabled}
              micEnabled={state.micEnabled}
              cameraEnabled={state.cameraEnabled}
            />
          </div>

          <div className="card softCard">
            <div className="small shellEyebrow">LIVE STATUS</div>
            <div className="small mt-2"><b>{statusLine}</b></div>
            <div className="small mt-2"><b>Active panel:</b> {state.activePanel}</div>
            <div className="small mt-2"><b>Mission focus:</b> {state.missionFocus}</div>
            <div className="small mt-2"><b>Next action:</b> {state.nextSuggestedAction}</div>
          </div>
        </div>

        <div style={{ display: "grid", gap: 16 }}>
          <div className="card softCard">
            <div className="small shellEyebrow">CORE MODE</div>
            <div className="row wrap mt-3" style={{ gap: 8 }}>
              {MODES.map((mode) => (
                <button
                  key={mode}
                  className={`tabBtn ${state.mode === mode ? "active" : ""}`}
                  onClick={() => applyPatch({ mode })}
                >
                  {mode}
                </button>
              ))}
            </div>

            <div className="mt-4" style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              <button className={`tabBtn ${state.micEnabled ? "active" : ""}`} onClick={() => applyPatch({ micEnabled: !state.micEnabled })}>
                {state.micEnabled ? "Mic on" : "Mic off"}
              </button>
              <button className={`tabBtn ${state.speakerEnabled ? "active" : ""}`} onClick={() => applyPatch({ speakerEnabled: !state.speakerEnabled })}>
                {state.speakerEnabled ? "Speaker on" : "Speaker off"}
              </button>
              <button className={`tabBtn ${state.cameraEnabled ? "active" : ""}`} onClick={() => applyPatch({ cameraEnabled: !state.cameraEnabled })}>
                {state.cameraEnabled ? "Camera on" : "Camera off"}
              </button>
              <button className={`tabBtn ${state.wakeWordEnabled ? "active" : ""}`} onClick={() => applyPatch({ wakeWordEnabled: !state.wakeWordEnabled })}>
                {state.wakeWordEnabled ? "Wake word on" : "Wake word off"}
              </button>
            </div>

            <label className="small mt-4" style={{ display: "block" }}>
              Wake word
              <input className="input mt-2" value={state.wakeWord} onChange={(e) => applyPatch({ wakeWord: e.target.value })} />
            </label>
          </div>

          <div className="card softCard">
            <div className="small shellEyebrow">MISSION + NEXT ACTION</div>
            <label className="small mt-3" style={{ display: "block" }}>
              Mission focus
              <textarea className="input mt-2" rows={3} value={state.missionFocus} onChange={(e) => applyPatch({ missionFocus: e.target.value })} />
            </label>
            <label className="small mt-3" style={{ display: "block" }}>
              Next suggested action
              <textarea className="input mt-2" rows={3} value={state.nextSuggestedAction} onChange={(e) => applyPatch({ nextSuggestedAction: e.target.value })} />
            </label>
            <div className="row wrap mt-3" style={{ gap: 8 }}>
              {quickActions.map((action) => (
                <button key={action.id} className="tabBtn" onClick={() => applyPatch({ nextSuggestedAction: action.note || state.nextSuggestedAction })}>
                  {action.label}
                </button>
              ))}
            </div>
          </div>

          <div className="card softCard">
            <div className="small shellEyebrow">MEMORY NOTES</div>
            <div className="row wrap mt-3" style={{ gap: 8 }}>
              <input className="input" style={{ minWidth: 260 }} value={memoryDraft} onChange={(e) => setMemoryDraft(e.target.value)} placeholder="Add a memory or preference note" />
              <button className="tabBtn active" onClick={addMemoryNote}>Save note</button>
            </div>
            <div className="mt-3" style={{ display: "grid", gap: 8 }}>
              {state.memoryNotes.map((note, idx) => (
                <div key={`${note}-${idx}`} className="card softCard small">{note}</div>
              ))}
            </div>
          </div>

          <div className="card softCard">
            <div className="small shellEyebrow">PANEL SHORTCUTS</div>
            <div className="row wrap mt-3" style={{ gap: 8 }}>
              {[
                ["Home", "Home"],
                ["Studio", "Books"],
                ["Grocery", "GroceryMeals"],
                ["Budget", "FamilyBudget"],
                ["Calendar", "Calendar"],
                ["Preferences", "Preferences"],
              ].map(([label, panel]) => (
                <button key={panel} className="tabBtn" onClick={() => onNavigate?.(panel)}>{label}</button>
              ))}
            </div>
          </div>

          <div className="card softCard">
            <div className="small shellEyebrow">EXPORT</div>
            <button className="tabBtn mt-3" onClick={() => void copySummary()}>{copied ? "Copied" : "Copy Homie core summary"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
