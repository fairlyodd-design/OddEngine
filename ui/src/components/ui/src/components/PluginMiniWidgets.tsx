import React, { useEffect, useMemo, useState } from "react";
import { executeCommand } from "../lib/commandCenter";
import {
  UPGRADE_PACKS_EVENT,
  getInjectedPanelWidgets,
  grantAllUpgradePackPermissions,
  installUpgradePack,
  repairUpgradePackDependencies,
  type UpgradeSurfaceAction,
} from "../lib/plugins";

export default function PluginMiniWidgets({
  panelId,
  onNavigate,
  onOpenHowTo,
}: {
  panelId: string;
  onNavigate?: (id: string) => void;
  onOpenHowTo?: () => void;
}) {
  const [tick, setTick] = useState(0);
  const widgets = useMemo(() => getInjectedPanelWidgets(panelId), [panelId, tick]);

  useEffect(() => {
    const handler = () => setTick((v) => v + 1);
    window.addEventListener(UPGRADE_PACKS_EVENT, handler as EventListener);
    return () => window.removeEventListener(UPGRADE_PACKS_EVENT, handler as EventListener);
  }, []);

  if (!widgets.length) return null;

  function handleAction(action: UpgradeSurfaceAction) {
    if (action.kind === "install-pack") {
      const packId = action.id.split(":")[0];
      installUpgradePack(packId);
      setTick((v) => v + 1);
      return;
    }
    if (action.kind === "grant-permissions") {
      const packId = action.id.split(":")[0];
      grantAllUpgradePackPermissions(packId);
      setTick((v) => v + 1);
      return;
    }
    if (action.kind === "repair-dependencies") {
      const packId = action.id.split(":")[0];
      repairUpgradePackDependencies(packId);
      setTick((v) => v + 1);
      return;
    }
    if (action.kind === "navigate" && action.panelId) {
      onNavigate?.(action.panelId);
      return;
    }
    if (action.kind === "command" && action.commandText) {
      executeCommand({
        text: action.commandText,
        activePanelId: panelId,
        onNavigate: (id) => onNavigate?.(id),
        onOpenHowTo,
      });
      setTick((v) => v + 1);
    }
  }

  return (
    <div className="pluginWidgetGrid">
      {widgets.map((widget) => (
        <div key={widget.id} className={`card softCard pluginMiniWidget ${widget.tone || "good"}`}>
          {widget.eyebrow ? <div className="small pluginCardEyebrow">{widget.eyebrow}</div> : null}
          <div style={{ fontWeight: 800, marginTop: 4 }}>{widget.title}</div>
          <div className="small" style={{ marginTop: 6, lineHeight: 1.45 }}>{widget.body}</div>
          <div className="assistantChipWrap" style={{ marginTop: 10 }}>
            {widget.actions.map((action) => (
              <button key={action.id} className={`tabBtn ${action.tone === "good" ? "active" : ""}`} onClick={() => handleAction(action)}>
                {action.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
