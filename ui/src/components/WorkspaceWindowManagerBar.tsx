import React, { useMemo, useState } from "react";
import type { WorkspaceSnapshot, WindowSession } from "../lib/windowManager";

type DisplayOption = { id: string; label: string };

export default function WorkspaceWindowManagerBar({
  activePanelId,
  activeWorkspaceName,
  sessions,
  snapshots,
  displays,
  assignedDisplayId,
  onChangeDisplay,
  onPopoutActive,
  onSaveSnapshot,
  onRestoreSnapshot,
  onResetMemory,
}: {
  activePanelId: string;
  activeWorkspaceName?: string;
  sessions: WindowSession[];
  snapshots: WorkspaceSnapshot[];
  displays: DisplayOption[];
  assignedDisplayId?: string;
  onChangeDisplay: (displayId: string) => void;
  onPopoutActive: () => void;
  onSaveSnapshot: (name: string) => void;
  onRestoreSnapshot: (id: string) => void;
  onResetMemory: () => void;
}) {
  const [name, setName] = useState("");
  const openSessions = useMemo(() => sessions.filter((item) => item.status !== "closed").slice(0, 5), [sessions]);
  return (
    <div className="trueWindowBar">
      <div className="trueWindowBarTop">
        <div>
          <div className="small">True window manager</div>
          <div className="trueWindowHeadline">{activeWorkspaceName || "Freeform desk"} • {openSessions.length} floating window{openSessions.length === 1 ? "" : "s"}</div>
          <div className="trueWindowSub">Save the current desk, reopen it later, and route the active panel to a target display.</div>
        </div>
        <div className="trueWindowActions">
          <button className="tabBtn" onClick={onPopoutActive}>Pop out active</button>
          <button className="tabBtn" onClick={onResetMemory}>Reset memory</button>
        </div>
      </div>
      <div className="trueWindowGrid">
        <label className="workspaceInlineField">Active display
          <select value={assignedDisplayId || ""} onChange={(e) => onChangeDisplay(e.target.value)}>
            <option value="">Auto / remembered</option>
            {displays.map((display) => <option key={display.id} value={display.id}>{display.label}</option>)}
          </select>
        </label>
        <label className="workspaceInlineField">Save snapshot
          <div style={{ display: "flex", gap: 8 }}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Night desk / Writer wall / Trader 3-screen" />
            <button className="tabBtn active" onClick={() => { onSaveSnapshot(name || `Snapshot ${new Date().toLocaleTimeString()}`); setName(""); }}>Save</button>
          </div>
        </label>
      </div>
      <div className="trueWindowMiniRow">
        {openSessions.length ? openSessions.map((item) => (
          <span key={item.id} className="workspaceMiniChip">{item.title}{item.targetDisplayId ? ` • ${item.targetDisplayId}` : ""}</span>
        )) : <span className="small">No remembered detached windows yet. Pop panels out and they will show up here.</span>}
      </div>
      {!!snapshots.length && (
        <div className="trueWindowSnapshotRow">
          {snapshots.slice(0, 5).map((item) => (
            <button key={item.id} className="tabBtn" onClick={() => onRestoreSnapshot(item.id)}>{item.name}</button>
          ))}
        </div>
      )}
    </div>
  );
}
