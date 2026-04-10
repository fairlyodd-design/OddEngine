const path = require("node:path");
const { app, BrowserWindow, ipcMain, screen } = require("electron");
const { loadWindowState, saveWindowState } = require("./window-state.cjs");
const { getDisplaysSummary, moveWindowToNextDisplay } = require("./display-tools.cjs");
const { createBridgeServer } = require("./bridge-server.cjs");
const { isDev, rendererUrl, rendererFile } = require("./paths.cjs");

let mainWindow = null;
let bridge = null;
const recentRendererEvents = [];

function rememberRendererEvent(event) {
  recentRendererEvents.unshift({
    receivedAt: new Date().toISOString(),
    ...event
  });
  if (recentRendererEvents.length > 25) recentRendererEvents.length = 25;
}

function sendBridgeEventToRenderer(event) {
  rememberRendererEvent(event);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("homie:bridge:event", event);
  }
}

function buildDefaultBounds() {
  const primary = screen.getPrimaryDisplay();
  const workArea = primary?.workArea || { x: 0, y: 0, width: 1280, height: 900 };
  const width = Math.max(470, Math.min(560, Math.round(workArea.width * 0.34)));
  const height = Math.max(720, Math.min(860, Math.round(workArea.height * 0.9)));
  return {
    width,
    height,
    x: workArea.x + workArea.width - width - 36,
    y: workArea.y + 28
  };
}

async function createMainWindow() {
  const state = loadWindowState();
  const fallback = buildDefaultBounds();

  mainWindow = new BrowserWindow({
    width: state.width || fallback.width,
    height: state.height || fallback.height,
    x: Number.isFinite(state.x) ? state.x : fallback.x,
    y: Number.isFinite(state.y) ? state.y : fallback.y,
    minWidth: 420,
    minHeight: 620,
    autoHideMenuBar: true,
    backgroundColor: "#09111d",
    title: "Homie Companion",
    alwaysOnTop: Boolean(state.alwaysOnTop),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.on("close", () => saveWindowState(mainWindow));
  mainWindow.on("moved", () => saveWindowState(mainWindow));
  mainWindow.on("resized", () => saveWindowState(mainWindow));

  if (isDev()) {
    await mainWindow.loadURL(rendererUrl());
  } else {
    await mainWindow.loadFile(rendererFile());
  }
}

function desktopStatus() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return { ok: false, error: "window-not-ready" };
  }
  const bounds = mainWindow.getBounds();
  const currentDisplay = screen.getDisplayMatching(bounds);
  return {
    ok: true,
    bounds,
    alwaysOnTop: mainWindow.isAlwaysOnTop(),
    display: {
      id: currentDisplay.id,
      label: currentDisplay.label || `Display ${currentDisplay.id}`
    },
    displays: getDisplaysSummary()
  };
}

app.whenReady().then(async () => {
  bridge = createBridgeServer({
    port: 45777,
    onEvent: sendBridgeEventToRenderer,
    getRecentEvents: () => recentRendererEvents
  });
  await bridge.listen();
  await createMainWindow();

  ipcMain.handle("homie:desktop:getStatus", () => desktopStatus());

  ipcMain.handle("homie:desktop:moveToNextDisplay", () => {
    if (!mainWindow) return { ok: false };
    const result = moveWindowToNextDisplay(mainWindow);
    saveWindowState(mainWindow);
    return { ok: true, ...result, status: desktopStatus() };
  });

  ipcMain.handle("homie:desktop:toggleAlwaysOnTop", () => {
    if (!mainWindow) return { ok: false };
    const next = !mainWindow.isAlwaysOnTop();
    mainWindow.setAlwaysOnTop(next);
    saveWindowState(mainWindow);
    return { ok: true, alwaysOnTop: next, status: desktopStatus() };
  });

  ipcMain.handle("homie:desktop:resetBounds", () => {
    if (!mainWindow) return { ok: false };
    const fallback = buildDefaultBounds();
    mainWindow.setBounds(fallback);
    saveWindowState(mainWindow);
    return { ok: true, status: desktopStatus() };
  });

  ipcMain.handle("homie:desktop:minimize", () => {
    if (!mainWindow) return { ok: false };
    mainWindow.minimize();
    return { ok: true };
  });

  ipcMain.handle("homie:desktop:close", () => {
    if (!mainWindow) return { ok: false };
    mainWindow.close();
    return { ok: true };
  });

  ipcMain.handle("homie:bridge:getStatus", () => ({
    ok: true,
    port: 45777,
    url: "http://127.0.0.1:45777",
    recentEventCount: recentRendererEvents.length
  }));

  ipcMain.handle("homie:bridge:getRecentEvents", () => ({
    ok: true,
    events: [...recentRendererEvents]
  }));

  ipcMain.handle("homie:bridge:sendTestEvent", (_event, payload) => {
    sendBridgeEventToRenderer(payload);
    return { ok: true, event: payload };
  });

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow();
    }
  });
});

app.on("window-all-closed", async () => {
  if (bridge) await bridge.close();
  if (process.platform !== "darwin") app.quit();
});
