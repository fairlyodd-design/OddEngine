
// Starter Electron main-process bridge for monitor enumeration.
// Merge into your real Electron main entry if not already present.
import { ipcMain, screen } from "electron";

export function registerOddMonitorBridge() {
  ipcMain.handle("odd:getDisplays", () => {
    return screen.getAllDisplays().map((d) => ({
      id: d.id,
      bounds: d.bounds,
      workArea: d.workArea,
      scaleFactor: d.scaleFactor,
      rotation: d.rotation,
      internal: d.internal,
    }));
  });
}
