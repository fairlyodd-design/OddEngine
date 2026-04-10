import type { BridgeStatus } from "../types/bridge";
import type { DesktopStatus, HomieState } from "../types/homie";

type Props = {
  bridgeStatus: BridgeStatus;
  desktopStatus: DesktopStatus;
  state: HomieState;
  presenceLabel: string;
  onMoveDisplay: () => void;
  onTogglePin: () => void;
  onResetBounds: () => void;
  onMinimize: () => void;
  onClose: () => void;
};

export function CompanionHeader({
  bridgeStatus,
  desktopStatus,
  state,
  presenceLabel,
  onMoveDisplay,
  onTogglePin,
  onResetBounds,
  onMinimize,
  onClose
}: Props) {
  const isPinned = Boolean(desktopStatus.alwaysOnTop);

  return (
    <div className="topbar">
      <div className="drag-copy">
        <div className="eyebrow">Homie Companion</div>
        <h1>Full-body desktop MVP</h1>
        <div className="topbar-sub">Warm co-pilot mode · {presenceLabel} · state {state}</div>
      </div>
      <div className="status-row no-drag">
        <span className={`pill ${bridgeStatus.ok ? "ok" : "warn"}`}>
          <span className={`status-dot ${bridgeStatus.ok ? "ok" : "warn"}`} />
          {bridgeStatus.ok ? "Bridge ready" : "Bridge down"}
        </span>
        <span className="pill soft">{isPinned ? "Pinned" : "Floating"}</span>
        <button className="mini-btn" onClick={onMoveDisplay}>Next screen</button>
        <button className="mini-btn" onClick={onTogglePin}>{isPinned ? "Unpin" : "Pin"}</button>
        <button className="mini-btn" onClick={onResetBounds}>Reset</button>
        <button className="mini-btn" onClick={onMinimize}>_</button>
        <button className="mini-btn danger" onClick={onClose}>×</button>
      </div>
    </div>
  );
}
