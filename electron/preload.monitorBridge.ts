
// Starter preload bridge for monitor enumeration.
// Wire this into your real Electron preload if not already present.
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("oddMonitorBridge", {
  getDisplays: () => ipcRenderer.invoke("odd:getDisplays"),
});
