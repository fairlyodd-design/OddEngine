const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("homie", {
  desktop: {
    getStatus: () => ipcRenderer.invoke("homie:desktop:getStatus"),
    moveToNextDisplay: () => ipcRenderer.invoke("homie:desktop:moveToNextDisplay"),
    toggleAlwaysOnTop: () => ipcRenderer.invoke("homie:desktop:toggleAlwaysOnTop"),
    resetBounds: () => ipcRenderer.invoke("homie:desktop:resetBounds"),
    minimize: () => ipcRenderer.invoke("homie:desktop:minimize"),
    close: () => ipcRenderer.invoke("homie:desktop:close")
  },
  bridge: {
    getStatus: () => ipcRenderer.invoke("homie:bridge:getStatus"),
    getRecentEvents: () => ipcRenderer.invoke("homie:bridge:getRecentEvents"),
    sendTestEvent: (event) => ipcRenderer.invoke("homie:bridge:sendTestEvent", event),
    onEvent: (callback) => {
      const handler = (_event, payload) => callback(payload);
      ipcRenderer.on("homie:bridge:event", handler);
      return () => ipcRenderer.removeListener("homie:bridge:event", handler);
    }
  }
});
