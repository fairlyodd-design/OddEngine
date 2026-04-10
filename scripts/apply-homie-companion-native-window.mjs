import fs from "fs";
import path from "path";

const root = process.cwd();
const mainPath = path.join(root, "electron", "main.cjs");
const preloadPath = path.join(root, "electron", "preload.cjs");
const htmlPath = path.join(root, "electron", "homie-companion.html");
const marker = "/* ODDENGINE_HOMIE_COMPANION_NATIVE_WINDOW_PASS_V10_25_55 */";
const preloadMarker = "// ODDENGINE_HOMIE_COMPANION_NATIVE_WINDOW_PASS_V10_25_55";

if (!fs.existsSync(mainPath)) throw new Error(`Missing ${mainPath}`);
if (!fs.existsSync(preloadPath)) throw new Error(`Missing ${preloadPath}`);
if (!fs.existsSync(htmlPath)) throw new Error(`Missing ${htmlPath}`);

let main = fs.readFileSync(mainPath, "utf-8");
let preload = fs.readFileSync(preloadPath, "utf-8");

if (!main.includes(marker)) {
  const mainBlock = `

${marker}
let homieCompanionWindow = null;
let homieCompanionState = {
  windowTitle: "Homie",
  title: "Homie companion",
  body: "Waiting for companion state…",
  footer: "Native second-screen window ready.",
  mode: "idle",
  tone: "muted",
  symbol: "BTCUSDT",
  grade: "A",
  leverageLane: "25X",
  pinTop: true,
  imageSrc: "./homie-memoji.png",
};
function homieCompanionWindowType(){ return "homie-companion-native"; }
function homieCompanionHtmlPath(){ return path.join(__dirname, "homie-companion.html"); }
function buildHomieCompanionBounds(opts){
  const saved = readWindowBounds(homieCompanionWindowType()) || null;
  const primary = screen.getPrimaryDisplay ? screen.getPrimaryDisplay() : null;
  const displays = getDisplayOrder();
  const targetDisplay = (opts && opts.secondMonitor && displays.length > 1)
    ? displays.find((d) => !primary || d.id !== primary.id) || displays[1]
    : primary || displays[0] || null;
  const wa = safeWorkArea(targetDisplay);
  const width = Math.max(300, Number((saved && saved.width) || opts?.width || 360));
  const height = Math.max(360, Number((saved && saved.height) || opts?.height || 520));
  let x = Number.isFinite(Number(opts?.x)) ? Number(opts.x) : (saved && Number.isFinite(Number(saved.x)) ? Number(saved.x) : undefined);
  let y = Number.isFinite(Number(opts?.y)) ? Number(opts.y) : (saved && Number.isFinite(Number(saved.y)) ? Number(saved.y) : undefined);
  if ((x === undefined || y === undefined) && wa) {
    x = Math.round(wa.x + Math.max(24, wa.width - width - 32));
    y = Math.round(wa.y + 32);
  }
  return clampBoundsToDisplays({ x, y, width, height });
}
function sendHomieCompanionState(){
  try{
    if(homieCompanionWindow && !homieCompanionWindow.isDestroyed()){
      homieCompanionWindow.webContents.send("odd:homieCompanionState", homieCompanionState);
    }
  }catch(e){}
}
function openHomieCompanionWindow(opts){
  const o = opts || {};
  const bounds = buildHomieCompanionBounds(o);
  if(homieCompanionWindow && !homieCompanionWindow.isDestroyed()){
    try{
      homieCompanionWindow.setAlwaysOnTop(!!o.alwaysOnTop);
      homieCompanionWindow.setBounds(bounds);
      homieCompanionWindow.show();
      homieCompanionWindow.focus();
      return homieCompanionWindow;
    }catch(e){ try{ homieCompanionWindow.close(); }catch(_e){} homieCompanionWindow = null; }
  }
  const win = new BrowserWindow({
    width: Math.max(300, Number(bounds.width || 360)),
    height: Math.max(360, Number(bounds.height || 520)),
    x: typeof bounds.x === "number" ? bounds.x : undefined,
    y: typeof bounds.y === "number" ? bounds.y : undefined,
    minWidth: 280,
    minHeight: 340,
    backgroundColor: "#0b1120",
    autoHideMenuBar: true,
    frame: false,
    thickFrame: true,
    resizable: true,
    movable: true,
    hasShadow: true,
    alwaysOnTop: !!o.alwaysOnTop,
    title: "Homie Companion",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  homieCompanionWindow = win;
  childWindows.add(win);
  const save = () => saveWindowBounds(homieCompanionWindowType(), win);
  win.on("resize", save);
  win.on("move", save);
  win.on("close", save);
  win.on("closed", () => { try{ save(); }catch(e){} childWindows.delete(win); if(homieCompanionWindow === win) homieCompanionWindow = null; });
  win.webContents.on("did-finish-load", () => sendHomieCompanionState());
  win.loadFile(homieCompanionHtmlPath());
  return win;
}
ipcMain.handle("odd:openHomieCompanion", async (_e, opts) => {
  try{
    const o = opts || {};
    if(o.state && typeof o.state === "object") homieCompanionState = { ...homieCompanionState, ...o.state };
    if(Object.prototype.hasOwnProperty.call(o, "alwaysOnTop")) homieCompanionState.pinTop = !!o.alwaysOnTop;
    const win = openHomieCompanionWindow(o);
    sendHomieCompanionState();
    return { ok:true, bounds: win.getBounds() };
  }catch(err){
    return { ok:false, error: String(err) };
  }
});
ipcMain.handle("odd:updateHomieCompanion", async (_e, state) => {
  try{
    if(state && typeof state === "object") homieCompanionState = { ...homieCompanionState, ...state };
    sendHomieCompanionState();
    return { ok:true };
  }catch(err){ return { ok:false, error: String(err) }; }
});
ipcMain.handle("odd:getHomieCompanionState", async () => homieCompanionState);
ipcMain.handle("odd:setHomieCompanionAlwaysOnTop", async (_e, value) => {
  try{
    homieCompanionState.pinTop = !!value;
    if(homieCompanionWindow && !homieCompanionWindow.isDestroyed()) homieCompanionWindow.setAlwaysOnTop(!!value);
    sendHomieCompanionState();
    return { ok:true };
  }catch(err){ return { ok:false, error: String(err) }; }
});
ipcMain.handle("odd:focusHomieCompanion", async () => {
  try{
    if(homieCompanionWindow && !homieCompanionWindow.isDestroyed()){
      homieCompanionWindow.show();
      homieCompanionWindow.focus();
      return { ok:true, focused:true };
    }
    return { ok:false, focused:false };
  }catch(err){ return { ok:false, error: String(err) }; }
});
ipcMain.handle("odd:closeHomieCompanion", async () => {
  try{
    if(homieCompanionWindow && !homieCompanionWindow.isDestroyed()) homieCompanionWindow.close();
    homieCompanionWindow = null;
    return { ok:true };
  }catch(err){ return { ok:false, error: String(err) }; }
});
`;
  main += mainBlock;
}

if (!preload.includes(preloadMarker)) {
  const insert = `

  ${preloadMarker}
  openHomieCompanion: (opts) => ipcRenderer.invoke("odd:openHomieCompanion", opts || {}),
  updateHomieCompanion: (state) => ipcRenderer.invoke("odd:updateHomieCompanion", state || {}),
  getHomieCompanionState: () => ipcRenderer.invoke("odd:getHomieCompanionState"),
  setHomieCompanionAlwaysOnTop: (value) => ipcRenderer.invoke("odd:setHomieCompanionAlwaysOnTop", !!value),
  focusHomieCompanion: () => ipcRenderer.invoke("odd:focusHomieCompanion"),
  closeHomieCompanion: () => ipcRenderer.invoke("odd:closeHomieCompanion"),
  onHomieCompanionState: (cb) => {
    const handler = (_evt, payload) => cb(payload);
    ipcRenderer.on("odd:homieCompanionState", handler);
    return () => ipcRenderer.removeListener("odd:homieCompanionState", handler);
  },`;
  const anchor = /\n\s*onRunOutput:\s*\(cb\)\s*=>\s*\{/;
  if (!anchor.test(preload)) throw new Error("Could not find onRunOutput in preload.cjs");
  preload = preload.replace(anchor, `${insert}
  onRunOutput: (cb) => {`);
}

fs.writeFileSync(mainPath, main, "utf-8");
fs.writeFileSync(preloadPath, preload, "utf-8");
console.log("Applied v10.25.55 Homie companion native window patch.");
