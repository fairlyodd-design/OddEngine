const fs = require("node:fs");
const path = require("node:path");
const { app } = require("electron");

const FILE_NAME = "homie-companion-window-state.json";

function stateFile() {
  return path.join(app.getPath("userData"), FILE_NAME);
}

function loadWindowState() {
  try {
    const raw = fs.readFileSync(stateFile(), "utf8");
    return JSON.parse(raw);
  } catch {
    return {
      width: 560,
      height: 820,
      x: undefined,
      y: undefined,
      alwaysOnTop: false
    };
  }
}

function saveWindowState(browserWindow) {
  if (!browserWindow || browserWindow.isDestroyed()) return;
  const bounds = browserWindow.getBounds();
  const state = {
    ...bounds,
    alwaysOnTop: browserWindow.isAlwaysOnTop()
  };
  fs.mkdirSync(path.dirname(stateFile()), { recursive: true });
  fs.writeFileSync(stateFile(), JSON.stringify(state, null, 2), "utf8");
}

module.exports = {
  loadWindowState,
  saveWindowState
};
