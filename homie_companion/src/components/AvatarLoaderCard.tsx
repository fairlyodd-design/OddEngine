import { useEffect, useState } from "react";
import type { AvatarRuntime } from "../types/avatar";
import { avatarSummary, normalizeAvatarPath } from "../lib/avatarRuntime";

type Props = {
  avatar: AvatarRuntime;
  onLoadPath: (path: string) => void;
  onUseFallback: () => void;
  onSetScale: (value: number) => void;
};

export function AvatarLoaderCard({ avatar, onLoadPath, onUseFallback, onSetScale }: Props) {
  const [value, setValue] = useState(avatar.sourceUrl || "/models/homie.glb");

  useEffect(() => {
    if (avatar.sourceUrl) setValue(avatar.sourceUrl);
  }, [avatar.sourceUrl]);

  return (
    <div className="card">
      <div className="card-title">Avatar loader</div>
      <p className="loader-copy">
        Put a <strong>.glb</strong> or <strong>.vrm</strong> file in <code>homie_companion/public/models</code>, then load it here.
      </p>
      <label className="field-label" htmlFor="avatar-path">Model path</label>
      <input
        id="avatar-path"
        className="text-input"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="/models/my-homie.glb"
      />
      <div className="button-row">
        <button className="mini-btn" onClick={() => onLoadPath(normalizeAvatarPath(value))}>Load path</button>
        <button className="mini-btn" onClick={() => setValue("/models/homie.glb")}>Try GLB path</button>
        <button className="mini-btn" onClick={() => setValue("/models/homie.vrm")}>Try VRM path</button>
        <button className="mini-btn" onClick={onUseFallback}>Use fallback buddy</button>
      </div>
      <div className="field-label">Avatar scale: {avatar.scale.toFixed(2)}</div>
      <input
        className="range-input"
        type="range"
        min="0.35"
        max="2.5"
        step="0.05"
        value={avatar.scale}
        onChange={(event) => onSetScale(Number(event.target.value))}
      />
      <div className="status-stack top-gap">
        <span className={`pill ${avatar.status === "ready" || avatar.status === "fallback" ? "ok" : avatar.status === "error" ? "warn" : "soft"}`}>
          {avatarSummary(avatar)}
        </span>
        <span className="pill soft">kind: {avatar.kind}</span>
      </div>
      {avatar.sourceUrl ? <p className="loader-path muted">Current path: {avatar.sourceUrl}</p> : null}
      {avatar.error ? <p className="loader-error">{avatar.error}</p> : null}
    </div>
  );
}
