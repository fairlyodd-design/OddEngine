const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("__ODD__", {
  isDesktop: () => true,

  // fs/shell
  pickDirectory: (opts) => ipcRenderer.invoke("odd:pickDirectory", opts || {}),
  pickFile: (opts) => ipcRenderer.invoke("odd:pickFile", opts || {}),
  openPath: (p) => ipcRenderer.invoke("odd:openPath", p),
  openExternal: (url) => ipcRenderer.invoke("odd:openExternal", url),

  // windows
  openWindow: (opts) => ipcRenderer.invoke("odd:openWindow", opts || {}),
  getDisplays: () => ipcRenderer.invoke("odd:getDisplays"),
  tileRoutineWindows: (payload) => ipcRenderer.invoke("odd:tileRoutineWindows", payload || {}),
  closeRoutineWindows: (payload) => ipcRenderer.invoke("odd:closeRoutineWindows", payload || {}),

  openEntertainmentPlayer: (opts) => ipcRenderer.invoke("odd:openEntertainmentPlayer", opts || {}),
  focusEntertainmentPlayer: () => ipcRenderer.invoke("odd:focusEntertainmentPlayer"),
  getEntertainmentLast: () => ipcRenderer.invoke("odd:getEntertainmentLast"),
  resetWindowBounds: () => ipcRenderer.invoke("odd:resetWindowBounds"),


  // generators / commands
  generate: (payload) => ipcRenderer.invoke("odd:generate", payload),
  run: (payload) => ipcRenderer.invoke("odd:run", payload),
  stopRun: (id) => ipcRenderer.invoke("odd:stopRun", id),
  tcpPing: (payload) => ipcRenderer.invoke("odd:tcpPing", payload),

  // dev snapshot / playbooks
  getDevSnapshot: (opts) => ipcRenderer.invoke("odd:getDevSnapshot", opts || {}),
  runPlaybook: (payload) => ipcRenderer.invoke("odd:runPlaybook", payload),

  // system
  getSystemInfo: () => ipcRenderer.invoke("odd:getSystemInfo"),
  updateGrowBundle: () => ipcRenderer.invoke("odd:updateGrowBundle"),
  growPlannerHandoff: (payload) => ipcRenderer.invoke("odd:growPlannerHandoff", payload || {}),

  // network (Desktop only; used for ZBD scan + HA import)
  fetchText: (payload) => ipcRenderer.invoke("odd:fetchText", payload),

  // plugins
  listPlugins: () => ipcRenderer.invoke("odd:listPlugins"),
  openPluginsFolder: () => ipcRenderer.invoke("odd:openPluginsFolder"),

  // emulators
  detectEmulators: () => ipcRenderer.invoke("odd:detectEmulators"),
  emuAction: (payload) => ipcRenderer.invoke("odd:emuAction", payload),

  // Homie AI (Desktop-only; local Ollama)
  homieCheck: () => ipcRenderer.invoke("odd:homieCheck"),
  homieChat: (payload) => ipcRenderer.invoke("odd:homieChat", payload),

  // External/local voice bridge
  voiceBridgeProbe: (payload) => ipcRenderer.invoke("odd:voiceBridgeProbe", payload || {}),
  voiceBridgeTranscribe: (payload) => ipcRenderer.invoke("odd:voiceBridgeTranscribe", payload || {}),

  onRunOutput: (cb) => {
    const handler = (_evt, msg) => cb(msg);
    ipcRenderer.on("odd:runOutput", handler);
    return () => ipcRenderer.removeListener("odd:runOutput", handler);
  }});
