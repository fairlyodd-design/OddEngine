import type { AvatarRuntime } from "../types/avatar";
import type { HomieState } from "../types/homie";

type Props = {
  state: HomieState;
  avatar: AvatarRuntime;
  message?: string;
  onRetry?: () => void;
  onUseSafeMode?: () => void;
  onReenable3D?: () => void;
  safeMode?: boolean;
};

export function SceneFallback({
  state,
  avatar,
  message,
  onRetry,
  onUseSafeMode,
  onReenable3D,
  safeMode
}: Props) {
  return (
    <div className="scene-fallback">
      <div className="scene-fallback-buddy">🙂</div>
      <div className="scene-fallback-copy">
        <div className="card-title">Homie safe view</div>
        <h3>{safeMode ? "3D scene is paused" : "3D scene hit a bump"}</h3>
        <p>
          {message || "Homie switched to a simple safe view so the window does not go blank while we keep the companion lane alive."}
        </p>
        <div className="status-stack top-gap">
          <span className="pill soft">state: {state}</span>
          <span className={`pill ${avatar.status === "ready" || avatar.status === "fallback" ? "ok" : avatar.status === "error" ? "warn" : "soft"}`}>
            avatar: {avatar.status}
          </span>
          <span className="pill soft">mode: {safeMode ? "safe 2D" : "fallback 2D"}</span>
        </div>
        <div className="button-row top-gap">
          {onRetry ? <button className="mini-btn" onClick={onRetry}>Retry 3D scene</button> : null}
          {onUseSafeMode ? <button className="mini-btn" onClick={onUseSafeMode}>Use safe mode</button> : null}
          {onReenable3D ? <button className="mini-btn" onClick={onReenable3D}>Turn 3D back on</button> : null}
        </div>
      </div>
    </div>
  );
}
