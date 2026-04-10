import type { AvatarRuntime } from "../types/avatar";
import type { BridgeStatus } from "../types/bridge";
import type { DesktopStatus, HomieState } from "../types/homie";
import { avatarSummary } from "../lib/avatarRuntime";
import { displayLabel } from "../lib/screen";

type Props = {
  state: HomieState;
  bridgeStatus: BridgeStatus;
  desktopStatus: DesktopStatus;
  avatar: AvatarRuntime;
  presenceLabel: string;
};

export function CompanionStatusBar({ state, bridgeStatus, desktopStatus, avatar, presenceLabel }: Props) {
  const windowMode = desktopStatus.alwaysOnTop ? "Pinned on top" : "Normal floating";

  return (
    <div className="card compact-status-card slim-status-card">
      <div className="card-title">Quick status</div>
      <div className="status-stack compact-status-pills">
        <span className="pill soft">state: {state}</span>
        <span className="pill soft">display: {displayLabel(desktopStatus)}</span>
        <span className={`pill ${bridgeStatus.ok ? "ok" : "warn"}`}>
          {bridgeStatus.ok ? "bridge connected" : "bridge disconnected"}
        </span>
        <span className={`pill ${avatar.status === "ready" || avatar.status === "fallback" ? "ok" : avatar.status === "error" ? "warn" : "soft"}`}>
          {avatarSummary(avatar)}
        </span>
      </div>

      <div className="slim-status-inline">
        <span><span className="muted">presence</span> {presenceLabel}</span>
        <span className="slim-separator">•</span>
        <span><span className="muted">window</span> {windowMode}</span>
      </div>
    </div>
  );
}
