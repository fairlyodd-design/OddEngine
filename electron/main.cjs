const { app, BrowserWindow, ipcMain, dialog, shell, session, screen } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const net = require("net");
const { spawn } = require("child_process");

let mainWindow = null;
const childWindows = new Set();
// Routine window tracking (for auto-stack + close)
const routineWindows = new Map();
// routineId -> Set<BrowserWindow>

// Routine tiling styles (remembered per routine id)
let routineTileStyles = new Map(); // rid -> style
function routineStylesPath(){
  return path.join(app.getPath("userData"), "routine_window_styles.json");
}
function loadRoutineStyles(){
  try{
    const p = routineStylesPath();
    if(!fs.existsSync(p)) return;
    const j = JSON.parse(String(fs.readFileSync(p, "utf-8")));
    if(!j || typeof j !== "object") return;
    routineTileStyles = new Map(Object.entries(j).map(([k,v]) => [String(k), String(v)]));
  }catch(e){}
}
function saveRoutineStyles(){
  try{
    const obj = {};
    for(const [k,v] of routineTileStyles.entries()) obj[k] = v;
    writeJsonFile(routineStylesPath(), obj);
  }catch(e){}
}
function normalizeTileStyle(v){
  const s = String(v || "").trim().toLowerCase();
  if(s === "grid") return "grid";
  if(s === "left-main" || s === "leftmain" || s === "left_main" || s === "left-main+stack" || s === "left-main-stack") return "left-main";
  if(s === "hero" || s === "2x2" || s === "2x2-hero" || s === "2x2_hero" || s === "2x2 hero") return "hero";
  return "grid";
}

function routineLayoutsPath(){
  try{
    return path.join(app.getPath("userData"), "routine_window_layouts.json");
  }catch(e){
    return path.join(__dirname, "routine_window_layouts.json");
  }
}
let routineTileConfigs = new Map(); // rid -> { preset, style, assignments }
function loadRoutineLayouts(){
  try{
    const p = routineLayoutsPath();
    if(!fs.existsSync(p)) return;
    const j = JSON.parse(String(fs.readFileSync(p, "utf-8")));
    if(!j || typeof j !== "object") return;
    routineTileConfigs = new Map(Object.entries(j).map(([k,v]) => [String(k), v]));
  }catch(e){}
}
function saveRoutineLayouts(){
  try{
    const obj = {};
    for(const [k,v] of routineTileConfigs.entries()) obj[k] = v;
    writeJsonFile(routineLayoutsPath(), obj);
  }catch(e){}
}
function normalizeTilePreset(v){
  const s = String(v || "").trim().toLowerCase();
  if(!s) return "";
  if(s === "single" || s === "single-monitor" || s === "single_monitor") return "single";
  if(s === "trader-main-3mon" || s === "trader3" || s === "trader-3mon" || s === "trader_main_3mon") return "trader-main-3mon";
  return s;
}
function getDisplayOrder(){
  const ds = (screen.getAllDisplays ? screen.getAllDisplays() : []) || [];
  const primary = (screen.getPrimaryDisplay && screen.getPrimaryDisplay()) ? screen.getPrimaryDisplay() : null;
  ds.sort((a,b)=> (a.bounds.x - b.bounds.x) || (a.bounds.y - b.bounds.y));
  if(primary){
    ds.sort((a,b)=> (a.id === primary.id ? -1 : (b.id === primary.id ? 1 : 0)) || ((a.bounds.x - b.bounds.x) || (a.bounds.y - b.bounds.y)));
  }
  return ds;
}
function safeWorkArea(d){
  return (d && d.workArea) ? d.workArea : { x:0, y:0, width: 1400, height: 900 };
}


let entertainmentWindow = null;
let entertainmentLast = null; // {url,title,serviceId,ts}

try{ app.setAppUserModelId("com.fairlyodd.oddengine"); }catch(e){}

const RUNS = new Map(); // id -> {proc, cwd, cmd, args, startedAt}
let runSeq = 1;

// Dev log buffer (in-memory tail for Homie)
const DEV_LOG = []; // {ts,type,id?,text}
const DEV_LOG_MAX = 4000;
let LAST_EXIT = null; // {id,code,ts}

function pushDevLog(entry){
  try{
    DEV_LOG.push(entry);
    while(DEV_LOG.length > DEV_LOG_MAX) DEV_LOG.shift();
  }catch(e){}
}

// ---------- logging ----------
function ensureDir(p){ try{ fs.mkdirSync(p, { recursive:true }); } catch(e){} }
function copyDir(src, dst){
  ensureDir(dst);
  const entries = fs.readdirSync(src, { withFileTypes:true });
  for(const ent of entries){
    const s = path.join(src, ent.name);
    const d = path.join(dst, ent.name);
    if(ent.isDirectory()){
      copyDir(s, d);
    } else if(ent.isFile()){
      ensureDir(path.dirname(d));
      fs.copyFileSync(s, d);
    }
  }
}

function readTextIfExists(p){
  try{ return fs.existsSync(p) ? String(fs.readFileSync(p, "utf-8")) : null; }catch(e){ return null; }
}

function copyDirSkip(src, dst, skipNames){
  // Shallow skip by basename; used to preserve user data (rooms.json, data folder)
  ensureDir(dst);
  const entries = fs.readdirSync(src, { withFileTypes:true });
  for(const ent of entries){
    if(skipNames && skipNames.has(ent.name)) continue;
    const s = path.join(src, ent.name);
    const d = path.join(dst, ent.name);
    if(ent.isDirectory()){
      copyDirSkip(s, d, skipNames);
    } else if(ent.isFile()){
      ensureDir(path.dirname(d));
      fs.copyFileSync(s, d);
    }
  }
}

function resourcePath(rel){
  // In packaged builds, extraResources live in process.resourcesPath
  if(app.isPackaged) return path.join(process.resourcesPath, rel);
  // In dev, resolve relative to project root
  return path.join(__dirname, "..", rel);
}

// ---------- Entertainment Player (separate window, remembered bounds) ----------
function entertainmentBoundsPath(){
  return path.join(app.getPath("userData"), "entertainment_player_bounds.json");
}
function readEntertainmentBounds(){
  try{
    const p = entertainmentBoundsPath();
    if(!fs.existsSync(p)) return null;
    const j = JSON.parse(String(fs.readFileSync(p, "utf-8")));
    if(!j || typeof j !== "object") return null;
    return {
      x: Number.isFinite(Number(j.x)) ? Number(j.x) : undefined,
      y: Number.isFinite(Number(j.y)) ? Number(j.y) : undefined,
      width: Math.max(560, Number(j.width || 1280)),
      height: Math.max(420, Number(j.height || 820)),
    };
  }catch(e){
    return null;
  }
}
function saveEntertainmentBounds(win){
  try{
    if(!win) return;
    const b = win.getBounds();
    writeJsonFile(entertainmentBoundsPath(), b);
  }catch(e){}
}
// ---------- Generic Window Bounds (per window type) ----------
function sanitizeWindowType(v){
  return String(v || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 80);
}
function windowBoundsDir(){
  return path.join(app.getPath("userData"), "window_bounds");
}
function windowBoundsPath(type){
  const safe = sanitizeWindowType(type);
  if(!safe) return null;
  return path.join(windowBoundsDir(), `${safe}.json`);
}
function readWindowBounds(type){
  try{
    const p = windowBoundsPath(type);
    if(!p) return null;
    if(!fs.existsSync(p)) return null;
    const j = JSON.parse(String(fs.readFileSync(p, "utf-8")));
    if(!j || typeof j !== "object") return null;
    const out = {
      x: Number.isFinite(Number(j.x)) ? Number(j.x) : undefined,
      y: Number.isFinite(Number(j.y)) ? Number(j.y) : undefined,
      width: Number.isFinite(Number(j.width)) ? Math.max(360, Number(j.width)) : undefined,
      height: Number.isFinite(Number(j.height)) ? Math.max(300, Number(j.height)) : undefined,
    };
    return out;
  }catch(e){
    return null;
  }
}
function clampBoundsToDisplays(bounds){
  try{
    if(!bounds) return bounds;
    const b = {
      x: Number.isFinite(Number(bounds.x)) ? Number(bounds.x) : undefined,
      y: Number.isFinite(Number(bounds.y)) ? Number(bounds.y) : undefined,
      width: Math.max(360, Number(bounds.width || 1200)),
      height: Math.max(300, Number(bounds.height || 800)),
    };
    // If no x/y, nothing to clamp.
    if(typeof b.x !== "number" || typeof b.y !== "number") return b;
    const match = screen.getDisplayMatching({ x: b.x, y: b.y, width: b.width, height: b.height }) || screen.getPrimaryDisplay();
    const wa = safeWorkArea(match);
    const minVisible = 120;
    if(b.x < wa.x) b.x = wa.x;
    if(b.y < wa.y) b.y = wa.y;
    if(b.x > wa.x + wa.width - minVisible) b.x = wa.x + wa.width - minVisible;
    if(b.y > wa.y + wa.height - minVisible) b.y = wa.y + wa.height - minVisible;
    if(b.width > wa.width) b.width = wa.width;
    if(b.height > wa.height) b.height = wa.height;
    return b;
  }catch(e){
    return bounds;
  }
}
function saveWindowBounds(type, win){
  try{
    const p = windowBoundsPath(type);
    if(!p || !win) return;
    const b = win.getBounds();
    writeJsonFile(p, b);
  }catch(e){}
}

function seedGrowOsBundle(){
  try{
    const bundlesDir = path.join(app.getPath("userData"), "bundles");
    ensureDir(bundlesDir);
    const dest = path.join(bundlesDir, "grow_os");
    const src = resourcePath("grow_os");
    if(!fs.existsSync(src)){
      log(`seed:grow_os missing src ${src}`);
      return dest;
    }

    // If missing, do a full seed.
    if(!fs.existsSync(dest)){
      copyDir(src, dest);
      log(`seed:grow_os -> ${dest}`);
      return dest;
    }

    // Sync code updates WITHOUT wiping user data (rooms.json, data folder).
    const srcVer = (readTextIfExists(path.join(src, "VERSION.txt")) || "").trim();
    const dstVer = (readTextIfExists(path.join(dest, "VERSION.txt")) || "").trim();
    if(srcVer && srcVer !== dstVer){
      const skip = new Set(["rooms.json", "data"]);
      copyDirSkip(src, dest, skip);
      log(`seed:grow_os sync ${dstVer || "(none)"} -> ${srcVer}`);
    }
    return dest;
  }catch(e){
    crash("seedGrowOsBundle: " + String(e));
    return null;
  }
}
function nowIso(){ return new Date().toISOString(); }


function parseJsonFileOr(p, fallback){
  try{
    if(!fs.existsSync(p)) return fallback;
    return JSON.parse(String(fs.readFileSync(p, "utf-8")));
  }catch(e){
    return fallback;
  }
}
function writeJsonFile(p, value){
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, JSON.stringify(value, null, 2), "utf-8");
}
function sanitizeRoomBaseName(v){
  return String(v || "").trim() || "OddEngine Planned Run";
}
function toStreamlitStage(stage){
  const s = String(stage || "").trim().toLowerCase();
  if(s === "seedling") return "SEEDLING";
  if(s === "flower" || s === "bloom") return "BLOOM";
  if(s === "dry" || s === "flush") return "FLUSH";
  return "VEG";
}
function toIsoDateFromInput(v){
  const s = String(v || "").trim();
  if(/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s || Date.now());
  if(Number.isNaN(d.getTime())) return new Date().toISOString().slice(0,10);
  return d.toISOString().slice(0,10);
}
function diffDays(a, b){
  try{
    const aa = new Date(`${a}T12:00:00`);
    const bb = new Date(`${b}T12:00:00`);
    return Math.round((aa.getTime() - bb.getTime()) / 86400000);
  }catch(e){
    return 0;
  }
}
function defaultPumpMap(){
  const names = ["Grow","Base","Bloom","CalMag","Shock&Awe","Bottle 6","Bottle 7","Bottle 8","Sticky Icky","Foliar Science","Bio Minerals"];
  const out = {};
  for(const name of names){
    out[name] = { bottle: name, channel: null, stock_concentration_g_per_ml: null };
  }
  return out;
}
function computeWeekIndexForStage(stage, startDate, vegWeeks, flipDate){
  const today = new Date().toISOString().slice(0,10);
  const vegDays = Math.max(0, Math.round(Number(vegWeeks || 0) * 7));
  if(stage === "SEEDLING") return 1;
  if(stage === "VEG") return Math.max(1, Math.floor(diffDays(today, startDate) / 7) + 1);
  if(stage === "BLOOM"){
    const base = flipDate || toIsoDateFromInput(new Date(Date.parse(`${startDate}T12:00:00`) + vegDays * 86400000));
    return Math.max(1, Math.floor(diffDays(today, base) / 7) + 1);
  }
  return 1;
}
function buildGrowRoomsFromPlanner(payload, existingRooms){
  const profile = payload && payload.profile ? payload.profile : {};
  const planner = payload && payload.planner ? payload.planner : {};
  const derived = payload && payload.derived ? payload.derived : {};
  const handoffIdPrefix = "oddengine-handoff";
  const baseName = sanitizeRoomBaseName(planner.runName || profile.name || "OddEngine Planned Run");
  const roomCount = Math.max(1, Number(planner.roomCount || 1));
  const startDate = toIsoDateFromInput(planner.startDate || new Date().toISOString().slice(0,10));
  const vegWeeks = Math.max(0, Number(planner.vegWeeks || 0));
  const stage = toStreamlitStage((derived && derived.stage) || profile.stage || "veg");
  const flipDate = stage === "BLOOM" || stage === "FLUSH" ? toIsoDateFromInput((derived && derived.flipDate) || startDate) : null;
  const medium = String(planner.medium || "coco").trim().toLowerCase() || "coco";
  const preserved = new Map();
  for(const room of existingRooms || []){
    if(String(room.room_id || "").startsWith(handoffIdPrefix)) preserved.set(String(room.room_id), room);
  }
  const out = [];
  for(let i=0; i<roomCount; i++){
    const suffix = roomCount > 1 ? `-${i+1}` : "";
    const roomId = `${handoffIdPrefix}${suffix}`;
    const prev = preserved.get(roomId) || {};
    const stageForRoom = stage;
    const next = {
      room_id: roomId,
      name: roomCount > 1 ? `${baseName} ${i+1}` : baseName,
      dev_id: prev.dev_id || null,
      medium,
      reservoir_gal: Number(prev.reservoir_gal || 1.0),
      start_date: startDate,
      veg_weeks_plan: vegWeeks || 4,
      stage: stageForRoom,
      week_index: computeWeekIndexForStage(stageForRoom, startDate, vegWeeks || 4, flipDate),
      flip_date: flipDate,
      pending_trade: prev.pending_trade || null,
      pump_map: prev.pump_map || defaultPumpMap(),
    };
    out.push(next);
  }
  return out;
}
function applyGrowPlannerHandoff(payload){
  const growDir = seedGrowOsBundle() || path.join(app.getPath("userData"), "bundles", "grow_os");
  ensureDir(growDir);
  const handoffPath = path.join(growDir, "oddengine_planner_handoff.json");
  const roomsPath = path.join(growDir, "rooms.json");
  const current = parseJsonFileOr(roomsPath, { rooms: [] });
  const existingRooms = Array.isArray(current && current.rooms) ? current.rooms : [];
  const retainedRooms = existingRooms.filter((room) => !String((room && room.room_id) || "").startsWith("oddengine-handoff"));
  const newRooms = buildGrowRoomsFromPlanner(payload || {}, existingRooms);
  const handoff = {
    exportedAt: new Date().toISOString(),
    source: "OddEngine Grow planner",
    appVersion: app.getVersion(),
    planner: payload && payload.planner ? payload.planner : {},
    profile: payload && payload.profile ? payload.profile : {},
    derived: payload && payload.derived ? payload.derived : {},
    environment: payload && payload.environment ? payload.environment : {},
    live: payload && payload.live ? payload.live : {},
    rooms: newRooms.map((r) => ({ room_id: r.room_id, name: r.name, medium: r.medium, stage: r.stage, start_date: r.start_date, veg_weeks_plan: r.veg_weeks_plan, flip_date: r.flip_date })),
  };
  writeJsonFile(handoffPath, handoff);
  writeJsonFile(roomsPath, { rooms: [...retainedRooms, ...newRooms] });
  log(`growPlannerHandoff -> ${handoffPath} (${newRooms.length} room${newRooms.length===1?"":"s"})`);
  return { ok:true, path: growDir, handoffPath, roomsUpdated: newRooms.length };
}


const logDir = path.join(app.getPath("userData"), "logs");
ensureDir(logDir);
const logPath = path.join(logDir, "oddengine.log");
const crashPath = path.join(logDir, "crash.log");

function appendFile(fp, line){
  try{ fs.appendFileSync(fp, `[${nowIso()}] ${line}${os.EOL}`); } catch(e){}
}
function log(line){
  pushDevLog({ ts: Date.now(), type: "log", text: String(line) });
  appendFile(logPath, line);
  if(mainWindow && mainWindow.webContents){
    mainWindow.webContents.send("odd:runOutput", { type:"log", line });
  }
}
function crash(line){ appendFile(crashPath, line); }

process.on("uncaughtException", (err) => crash("uncaughtException: " + (err && err.stack ? err.stack : String(err))));
process.on("unhandledRejection", (reason) => crash("unhandledRejection: " + String(reason)));

// ---------- generators ----------
function writeFiles(baseDir, files){
  for(const f of files){
    const outPath = path.join(baseDir, f.path);
    ensureDir(path.dirname(outPath));
    fs.writeFileSync(outPath, f.content, "utf-8");
  }
}

function genAffiliateSite(brand="FairlyOdd"){
  return [
    { path:"index.html", content:`<!doctype html><html><head><meta charset="utf-8"><title>${brand} Affiliate Site</title></head><body><h1>${brand} Affiliate Microsite</h1><p>Generated locally by OddEngine.</p></body></html>`},
    { path:"keywords/bitcoin-mining.html", content:`<h1>bitcoin-mining</h1><p>placeholder</p>`},
    { path:"keywords/best-trading-apps.html", content:`<h1>best-trading-apps</h1><p>placeholder</p>`},
    { path:"keywords/crypto-wallets.html", content:`<h1>crypto-wallets</h1><p>placeholder</p>`},
    { path:"assets/README.txt", content:"Put images/css here."},
    { path:"sitemap.xml", content:`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>/</loc></url></urlset>`},
  ];
}

function genFairlyOddDashboard(){
  return [
    { path:"README.md", content:"# FairlyOdd Trader Dashboard\nGenerated by OddEngine.\n"},
    { path:"src/App.tsx", content:`import React from "react";\n\nexport default function App(){\n  return (\n    <div style={{padding:16,fontFamily:"system-ui"}}>\n      <h1>FairlyOdd Trader Dashboard</h1>\n      <p>Add your widgets in src/widgets.</p>\n    </div>\n  );\n}\n`},
    { path:"src/widgets/Watchlist.tsx", content:`import React from "react";\nexport default function Watchlist(){\n  return <div>Watchlist</div>;\n}\n`},
    { path:"src/widgets/Signals.tsx", content:`import React from "react";\nexport default function Signals(){\n  return <div>Signals</div>;\n}\n`},
  ];
}

function genCryptoDashboard(){
  return [
    { path:"README.md", content:"# Crypto / Mining Dashboard\nGenerated by OddEngine.\n"},
    { path:"src/App.tsx", content:`import React from "react";\nexport default function App(){\n  return <div style={{padding:16}}>Crypto / Mining Dashboard</div>;\n}\n`},
  ];
}

function genProductPage(brand="FairlyOdd"){
  return [{ path:"index.html", content:`<!doctype html><html><head><meta charset="utf-8"><title>${brand} Product</title></head><body><h1>${brand} Product Page</h1><p>Generated locally.</p></body></html>`}];
}

function genMarketplaceScaffold(){
  return [
    { path:"README.md", content:"# Template Marketplace Scaffold\nGenerated by OddEngine.\n" },
    { path:"catalog.json", content: JSON.stringify({ templates: [] }, null, 2) }
  ];
}

function generateFiles(type, brand){
  switch(type){
    case "affiliate_site": return genAffiliateSite(brand);
    case "fairlyodd_dashboard": return genFairlyOddDashboard();
    case "crypto_dashboard": return genCryptoDashboard();
    case "product_page": return genProductPage(brand);
    case "marketplace_scaffold": return genMarketplaceScaffold();
    default: return [];
  }
}

// ---------- app window ----------
function createWindow(){
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 620,
    backgroundColor: "#0b0f14",
    resizable: true,
    maximizable: true,
    minimizable: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  const startUrl = process.env.ELECTRON_START_URL;
  if(startUrl){
    mainWindow.loadURL(startUrl);
    if(process.env.ODD_DEBUG==="1") mainWindow.webContents.openDevTools({ mode:"detach" });
  } else {
    const indexPath = path.join(__dirname, "..", "ui", "dist", "index.html");
    mainWindow.loadFile(indexPath);
  }
}

app.whenReady().then(async () => {
  seedGrowOsBundle();
  loadRoutineStyles();
  loadRoutineLayouts();
  try{
    const ses = session.defaultSession;
    if(ses && ses.setPermissionRequestHandler){
      ses.setPermissionRequestHandler((_wc, permission, callback) => {
        if(permission === "media") return callback(true);
        return callback(false);
      });
    }
    if(ses && ses.setPermissionCheckHandler){
      ses.setPermissionCheckHandler((_wc, permission) => {
        if(permission === "media") return true;
        return false;
      });
    }
  }catch(e){
    crash("session permissions: " + String(e));
  }
  createWindow();
});

app.on("window-all-closed", () => {
  if(process.platform !== "darwin") app.quit();
});

// ---------- IPC ----------
ipcMain.handle("odd:pickDirectory", async () => {
  const res = await dialog.showOpenDialog({ properties:["openDirectory","createDirectory"] });
  if(res.canceled) return { ok:false };
  return { ok:true, path: res.filePaths[0] };
});

ipcMain.handle("odd:openPath", async (_e, p) => {
  try{
    await shell.openPath(p);
    return { ok:true };
  }catch(err){
    return { ok:false, error: String(err) };
  }
});


ipcMain.handle("odd:openExternal", async (_e, url) => {
  try{
    await shell.openExternal(String(url || ""));
    return { ok:true };
  }catch(err){
    return { ok:false, error: String(err) };
  }
});

// Reset persisted desktop window bounds (popouts)
ipcMain.handle("odd:resetWindowBounds", async () => {
  try{
    let cleared = 0;
    const dir = windowBoundsDir();
    if(fs.existsSync(dir)){
      try{
        const files = fs.readdirSync(dir);
        cleared += Array.isArray(files) ? files.length : 0;
      }catch(e){}
      try{
        fs.rmSync(dir, { recursive: true, force: true });
      }catch(e){
        // Fallback for older Node versions
        try{ fs.rmdirSync(dir, { recursive: true }); }catch(_e){}
      }
    }
    const ent = entertainmentBoundsPath();
    if(fs.existsSync(ent)){
      try{ fs.unlinkSync(ent); cleared += 1; }catch(e){}
    }
    return { ok:true, cleared };
  }catch(err){
    return { ok:false, error: String(err) };
  }
});

// Open a new OddEngine window (used for "undock" panels)

ipcMain.handle("odd:getDisplays", async () => {
  try{
    const ds = getDisplayOrder();
    const primary = (screen.getPrimaryDisplay && screen.getPrimaryDisplay()) ? screen.getPrimaryDisplay() : null;
    return { ok:true, displays: ds.map(d => ({
      id: String(d.id),
      bounds: d.bounds,
      workArea: d.workArea,
      scaleFactor: d.scaleFactor,
      isPrimary: primary ? (d.id === primary.id) : false,
      label: (primary && d.id === primary.id) ? "Primary" : "Display"
    })) };
  }catch(err){
    return { ok:false, error: String(err) };
  }
});

ipcMain.handle("odd:openWindow", async (_e, opts) => {
  try{
    const o = opts || {};
    const width = Number(o.width || 1200);
    const height = Number(o.height || 800);
    const title = String(o.title || "OddEngine");

    const wantsFrame = o.frame !== false;
    const wantsResizable = o.resizable !== false;

    // Persisted bounds per window type (panel pop-outs, Homie companion, ticket windows, etc.)
    const panelHint = o.panel ? String(o.panel) : "";
    const q = (o.query && typeof o.query === "object") ? o.query : {};
    const typeRaw = o.windowType || o.persistKey || (panelHint ? `panel-${panelHint}` : (q && q.buddy ? "homie-buddy" : `title-${title}`));
    const windowType = sanitizeWindowType(typeRaw);
    const savedBounds = windowType ? readWindowBounds(windowType) : null;
    const initialBounds = clampBoundsToDisplays({
      x: Number.isFinite(Number(o.x)) ? Number(o.x) : (savedBounds ? savedBounds.x : undefined),
      y: Number.isFinite(Number(o.y)) ? Number(o.y) : (savedBounds ? savedBounds.y : undefined),
      width: (savedBounds && savedBounds.width) ? savedBounds.width : Math.max(360, width),
      height: (savedBounds && savedBounds.height) ? savedBounds.height : Math.max(360, height),
    });

    const winOpts = {
      width: Math.max(360, initialBounds.width || width),
      height: Math.max(360, initialBounds.height || height),
    };
    if (typeof initialBounds.x === "number") winOpts.x = initialBounds.x;
    if (typeof initialBounds.y === "number") winOpts.y = initialBounds.y;

    const win = new BrowserWindow({
      ...winOpts,
      minWidth: 320,
      minHeight: 240,
      backgroundColor: String(o.transparent ? "#00000000" : "#0b0f14"),
      title,
      resizable: wantsResizable,
      movable: true,
      autoHideMenuBar: true,
      alwaysOnTop: !!o.alwaysOnTop,
      frame: wantsFrame,
      // On Windows, frameless windows can become hard to resize (no visible border).
      // thickFrame keeps the slick frameless look while restoring resize handles.
      thickFrame: !wantsFrame && wantsResizable,
      transparent: !!o.transparent,
      skipTaskbar: !!o.skipTaskbar,
      hasShadow: true,
      webPreferences: {
        preload: path.join(__dirname, "preload.cjs"),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    // Remember size/position per window type (like the entertainment player)
    if(windowType){
      try{ win.__oddWindowType = windowType; }catch(e){}
      let saveT = null;
      const scheduleSave = () => {
        try{ if(saveT) clearTimeout(saveT); }catch(e){}
        saveT = setTimeout(() => saveWindowBounds(windowType, win), 220);
      };
      win.on("resize", scheduleSave);
      win.on("move", scheduleSave);
      win.on("close", () => saveWindowBounds(windowType, win));
    }


    const startUrl = process.env.ELECTRON_START_URL;
    const indexPath = path.join(__dirname, "..", "ui", "dist", "index.html");

    if(o.url){
      const raw = String(o.url);
      if(startUrl && raw.startsWith("?")){
        const u = startUrl.includes("?") ? `${startUrl}&${raw.slice(1)}` : `${startUrl}${raw}`;
        win.loadURL(u);
      } else {
        win.loadURL(raw);
      }
    } else {
      const params = new URLSearchParams();
      if(o.panel) params.set("panel", String(o.panel));
      params.set("undock", "1");
      if(o.query && typeof o.query === "object"){
        for(const [k,v] of Object.entries(o.query)){
          if(v === undefined || v === null) continue;
          params.set(String(k), String(v));
        }
      }

      if(startUrl){
        const u = startUrl.includes("?") ? `${startUrl}&${params.toString()}` : `${startUrl}?${params.toString()}`;
        win.loadURL(u);
      } else {
        const q = {};
        for(const [k,v] of params.entries()) q[k] = v;
        win.loadFile(indexPath, { query: q });
      }
    }


// Attach panel id metadata if present (helps multi-monitor tiling + routines)
try{
  const pid = (o.panel) ? String(o.panel) : (o.query && o.query.panel ? String(o.query.panel) : "");
  if(pid) win.__oddPanelId = pid;
  else if(o.url){
    const rawu = String(o.url);
    const m = rawu.match(/[?&]panel=([^&]+)/i);
    if(m && m[1]) win.__oddPanelId = decodeURIComponent(m[1]);
  }
}catch(e){}

    childWindows.add(win);
    // Track routine windows for auto-stack/close
    if(o.routineId){
      const rid = String(o.routineId);
      let set = routineWindows.get(rid);
      if(!set){ set = new Set(); routineWindows.set(rid, set); }
      set.add(win);
      win.__oddRoutineId = rid;
      win.on("closed", () => {
        try{
          const s = routineWindows.get(rid);
          if(s){ s.delete(win); if(s.size === 0) routineWindows.delete(rid); }
        }catch(e){}
      });
    }

    win.on("closed", () => childWindows.delete(win));
    if(process.env.ODD_DEBUG === "1") win.webContents.openDevTools({ mode: "detach" });
    return { ok:true };
  }catch(err){
    return { ok:false, error: String(err) };
  }
});

// Routine window management (auto-stack + close)
ipcMain.handle("odd:tileRoutineWindows", async (_e, payload) => {
  try{
    const rid = String(payload && payload.routineId ? payload.routineId : "").trim();
    if(!rid) return { ok:false, error:"Missing routineId" };
    const set = routineWindows.get(rid);
    const winsAll = set ? Array.from(set).filter(w => w && !w.isDestroyed()) : [];
    if(!winsAll.length) return { ok:false, error:"No routine windows to tile" };

    const margin = 10;

    // Merge incoming config with persisted config
    const incomingStyle = payload && payload.style ? normalizeTileStyle(payload.style) : "";
    const incomingPreset = payload && payload.preset ? normalizeTilePreset(payload.preset) : "";
    const incomingAssignments = (payload && payload.assignments && typeof payload.assignments === "object") ? payload.assignments : null;

    const prev = routineTileConfigs.get(rid) || {};
    const style = incomingStyle || prev.style || routineTileStyles.get(rid) || "grid";
    const preset = incomingPreset || prev.preset || "single";
    const assignments = incomingAssignments || prev.assignments || {};

    // Persist
    if(incomingStyle){
      routineTileStyles.set(rid, incomingStyle);
      saveRoutineStyles();
    }
    if(incomingStyle || incomingPreset || incomingAssignments){
      routineTileConfigs.set(rid, { preset, style, assignments });
      saveRoutineLayouts();
    }else if(!prev || typeof prev !== "object"){
      routineTileConfigs.set(rid, { preset, style, assignments });
      saveRoutineLayouts();
    }

    function applyBounds(w, b){
      try{ w.setBounds(b, false); w.show(); w.focus(); }catch(e){}
    }

    function tileWithinArea(wins, area, style){
      const n = wins.length;
      if(!n) return { count: 0 };
      // Single window: fullscreen (minus margin)
      if(n === 1){
        const w = wins[0];
        applyBounds(w, { x: area.x + margin, y: area.y + margin, width: Math.max(360, area.width - margin*2), height: Math.max(360, area.height - margin*2) });
        return { count: 1, style };
      }

      if(style === "left-main"){
        const main = wins[0];
        const side = wins.slice(1);
        const mainW = Math.max(560, Math.floor(area.width * 0.64));
        const sideW = Math.max(420, area.width - mainW - margin * 3);
        const x0 = area.x + margin;
        const y0 = area.y + margin;
        const h0 = area.height - margin * 2;
        applyBounds(main, { x: x0, y: y0, width: mainW, height: h0 });
        const sx = x0 + mainW + margin;
        const eachH = Math.max(260, Math.floor((h0 - margin * (side.length + 1)) / Math.max(1, side.length)));
        side.forEach((w,i)=>{
          const y = y0 + margin + i * (eachH + margin);
          applyBounds(w, { x: sx, y, width: sideW, height: eachH });
        });
        return { count: n, style };
      }

      if(style === "hero"){
        const x0 = area.x + margin;
        const y0 = area.y + margin;
        const W = area.width - margin * 2;
        const H = area.height - margin * 2;
        const heroW = Math.max(700, Math.floor(W * 0.66));
        const heroH = Math.max(520, Math.floor(H * 0.66));
        const hero = wins[0];
        applyBounds(hero, { x: x0, y: y0, width: heroW, height: heroH });

        const rest = wins.slice(1);
        const rightX = x0 + heroW + margin;
        const rightW = Math.max(420, W - heroW - margin);
        const rightH = heroH;
        const bottomY = y0 + heroH + margin;
        const bottomH = Math.max(260, H - heroH - margin);

        const rightCount = Math.min(2, rest.length);
        const eachRH = Math.max(260, Math.floor((rightH - margin * (rightCount + 1)) / Math.max(1, rightCount)));
        for(let i=0; i<rightCount; i++){
          const w = rest[i];
          const y = y0 + margin + i * (eachRH + margin);
          applyBounds(w, { x: rightX, y, width: rightW, height: eachRH });
        }

        const remaining = rest.slice(rightCount);
        if(remaining.length){
          const cols = Math.max(1, Math.min(4, remaining.length));
          const cellW = Math.max(420, Math.floor((W - margin * (cols + 1)) / cols));
          const cellH = Math.max(260, bottomH);
          remaining.forEach((w, i)=>{
            const c = i % cols;
            const x = x0 + margin + c * (cellW + margin);
            applyBounds(w, { x, y: bottomY, width: cellW, height: cellH });
          });
        }
        return { count: n, style };
      }

      // Default grid
      const cols = Math.max(1, Math.ceil(Math.sqrt(n)));
      const rows = Math.max(1, Math.ceil(n / cols));
      const cellW = Math.max(420, Math.floor((area.width - margin * (cols + 1)) / cols));
      const cellH = Math.max(260, Math.floor((area.height - margin * (rows + 1)) / rows));
      wins.forEach((w, i)=>{
        const c = i % cols;
        const r = Math.floor(i / cols);
        const x = area.x + margin + c * (cellW + margin);
        const y = area.y + margin + r * (cellH + margin);
        applyBounds(w, { x, y, width: cellW, height: cellH });
      });
      return { count: n, cols, rows, style: "grid" };
    }

    // Multi-monitor presets
    const displays = getDisplayOrder();
    const primary = displays[0] || null;

    // Build groups: displayId -> wins
    const byDisplay = new Map();
    // If we have explicit assignments (panelId -> displayId), use them
    function assignWindow(w, fallbackDisplay){
      const pid = w.__oddPanelId ? String(w.__oddPanelId) : "";
      let did = "";
      if(pid && assignments && assignments[pid]) did = String(assignments[pid]);
      if(!did && fallbackDisplay) did = String(fallbackDisplay.id);
      if(!did && primary) did = String(primary.id);
      let arr = byDisplay.get(did);
      if(!arr){ arr = []; byDisplay.set(did, arr); }
      arr.push(w);
    }

    if(preset === "trader-main-3mon" && displays.length >= 2){
      // Heuristic: first window is main (Trading), next windows go to next displays fullscreen; remaining stay on primary tiled.
      const mainWin = winsAll[0];
      const others = winsAll.slice(1);
      const dPrimary = displays[0];
      const dOthers = displays.slice(1);

      // Explicit mapping wins if provided; otherwise use heuristic distribution
      if(assignments && Object.keys(assignments).length){
        winsAll.forEach(w => assignWindow(w, dPrimary));
      } else {
        // main on primary
        assignWindow(mainWin, dPrimary);
        // next up to displays-1 get fullscreen on their displays
        let k = 0;
        for(; k < others.length && k < dOthers.length; k++){
          assignWindow(others[k], dOthers[k]);
        }
        // remaining to primary
        for(; k < others.length; k++){
          assignWindow(others[k], dPrimary);
        }
      }

      // Apply: any display with 1 window -> fullscreen, otherwise style tile.
      let total = 0;
      for(const d of displays){
        const did = String(d.id);
        const wins = byDisplay.get(did) || [];
        if(!wins.length) continue;
        const area = safeWorkArea(d);
        if(wins.length === 1){
          tileWithinArea(wins, area, "grid");
          total += 1;
        } else {
          const res = tileWithinArea(wins, area, style);
          total += res.count || 0;
        }
      }
      return { ok:true, routineId: rid, count: total, style, preset };
    }

    // Default: single-monitor or explicit assignments
    if(assignments && Object.keys(assignments).length && displays.length){
      winsAll.forEach(w => assignWindow(w, primary || displays[0]));
      let total = 0;
      for(const d of displays){
        const did = String(d.id);
        const wins = byDisplay.get(did) || [];
        if(!wins.length) continue;
        const res = tileWithinArea(wins, safeWorkArea(d), style);
        total += res.count || 0;
      }
      return { ok:true, routineId: rid, count: total, style, preset: preset || "assigned" };
    }

    // Single display tiling (primary work area)
    const area = primary ? safeWorkArea(primary) : { x:0, y:0, width: 1400, height: 900 };
    const out = tileWithinArea(winsAll, area, style);
    return { ok:true, routineId: rid, count: out.count || winsAll.length, cols: out.cols, rows: out.rows, style, preset: preset || "single" };
  }catch(err){
    return { ok:false, error: String(err) };
  }
});

ipcMain.handle("odd:closeRoutineWindows", async (_e, payload) => {
  try{
    const rid = String(payload && payload.routineId ? payload.routineId : "").trim();
    if(!rid) return { ok:false, error:"Missing routineId" };
    const set = routineWindows.get(rid);
    const wins = set ? Array.from(set).filter(w => w && !w.isDestroyed()) : [];
    wins.forEach((w) => {
      try{ w.close(); }catch(e){}
    });
    routineWindows.delete(rid);
    return { ok:true, routineId: rid, closed: wins.length };
  }catch(err){
    return { ok:false, error: String(err) };
  }
});


// Dedicated Entertainment Player window (remembered size/position; reuses one window)
ipcMain.handle("odd:openEntertainmentPlayer", async (_e, opts) => {
  try{
    const o = opts || {};
    const url = String(o.url || "");
    if(!url) return { ok:false, error:"Missing url" };
    const title = String(o.title || "Entertainment Player");
    const bounds = readEntertainmentBounds();

    entertainmentLast = { url, title, serviceId: o.serviceId ? String(o.serviceId) : null, ts: Date.now() };

    if(entertainmentWindow && !entertainmentWindow.isDestroyed()){
      try{
        entertainmentWindow.setTitle(title);
        entertainmentWindow.loadURL(url);
        entertainmentWindow.show();
        entertainmentWindow.focus();
        return { ok:true, reused:true };
      }catch(e){
        // fallthrough to recreate
        try{ entertainmentWindow.close(); }catch(_e){}
        entertainmentWindow = null;
      }
    }

    const win = new BrowserWindow({
      width: Math.max(560, Number(bounds?.width || o.width || 1280)),
      height: Math.max(420, Number(bounds?.height || o.height || 820)),
      x: Number.isFinite(Number(bounds?.x)) ? Number(bounds?.x) : undefined,
      y: Number.isFinite(Number(bounds?.y)) ? Number(bounds?.y) : undefined,
      backgroundColor: "#0b0f14",
      title,
      resizable: true,
      movable: true,
      autoHideMenuBar: true,
      webPreferences: {
        preload: path.join(__dirname, "preload.cjs"),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    entertainmentWindow = win;

// Attach panel id metadata if present (helps multi-monitor tiling + routines)
try{
  const pid = (o.panel) ? String(o.panel) : (o.query && o.query.panel ? String(o.query.panel) : "");
  if(pid) win.__oddPanelId = pid;
  else if(o.url){
    const rawu = String(o.url);
    const m = rawu.match(/[?&]panel=([^&]+)/i);
    if(m && m[1]) win.__oddPanelId = decodeURIComponent(m[1]);
  }
}catch(e){}

    childWindows.add(win);
    const persistBounds = () => saveEntertainmentBounds(win);
    win.on("resize", persistBounds);
    win.on("move", persistBounds);
    win.on("close", persistBounds);
    win.on("closed", () => {
      try{ persistBounds(); }catch(e){}
      childWindows.delete(win);
      if(entertainmentWindow === win) entertainmentWindow = null;
    });

    // Some self-hosted players are on http://localhost or LAN IPs.
    // Ensure the window actually shows even if load is slow.
    try{ win.show(); }catch(e){}
    win.loadURL(url);
    win.once("ready-to-show", () => {
      try{ win.show(); win.focus(); }catch(e){}
    });
    if(process.env.ODD_DEBUG === "1") win.webContents.openDevTools({ mode: "detach" });
    return { ok:true };
  }catch(err){
    return { ok:false, error: String(err) };
  }
});

ipcMain.handle("odd:focusEntertainmentPlayer", async () => {
  try{
    if(entertainmentWindow && !entertainmentWindow.isDestroyed()){
      entertainmentWindow.show();
      entertainmentWindow.focus();
      return { ok:true, shown:true, hasLast: !!entertainmentLast, last: entertainmentLast };
    }
    return { ok:true, shown:false, hasLast: !!entertainmentLast, last: entertainmentLast };
  }catch(err){
    return { ok:false, error:String(err) };
  }
});

ipcMain.handle("odd:getEntertainmentLast", async () => {
  try{
    return { ok:true, last: entertainmentLast };
  }catch(err){
    return { ok:false, error:String(err) };
  }
});

ipcMain.handle("odd:getSystemInfo", async () => {
  const bundlesDir = path.join(app.getPath("userData"), "bundles");
  ensureDir(bundlesDir);
  const growOsDir = seedGrowOsBundle();
  return { ok:true, userData: app.getPath("userData"), bundlesDir, growOsDir, appVersion: app.getVersion(), packaged: app.isPackaged, cwd: process.cwd(), appPath: app.getAppPath() };
});

ipcMain.handle("odd:growPlannerHandoff", async (_e, payload) => {
  try{
    return applyGrowPlannerHandoff(payload || {});
  }catch(e){
    return { ok:false, error:String(e) };
  }
});

ipcMain.handle("odd:updateGrowBundle", async () => {
  try{
    const dest = path.join(app.getPath("userData"), "bundles", "grow_os");
    const src = resourcePath("grow_os");
    if(!fs.existsSync(src)) return { ok:false, error: "Missing bundled grow_os source" };
    ensureDir(path.dirname(dest));
    if(!fs.existsSync(dest)){
      copyDir(src, dest);
      log(`update:grow_os -> ${dest}`);
      return { ok:true, path: dest, updated: true };
    }
    const skip = new Set(["rooms.json", "data"]);
    copyDirSkip(src, dest, skip);
    const srcVer = (readTextIfExists(path.join(src, "VERSION.txt")) || "").trim();
    log(`update:grow_os sync -> ${srcVer || "(no version)"}`);
    return { ok:true, path: dest, updated: true, version: srcVer || null };
  }catch(e){
    return { ok:false, error: String(e) };
  }
});


// ---------- network helpers (Desktop only) ----------
function isSafeHttpUrl(u){
  try{
    const url = new URL(u);
    return (url.protocol === "http:" || url.protocol === "https:");
  }catch(e){ return false; }
}

function normalizeVoiceBridgeBaseUrl(v){
  const raw = String(v || '').trim();
  if(!raw) return 'http://127.0.0.1:8765';
  return raw.replace(/\/+$/, '');
}

async function safeVoiceBridgeProbe(payload){
  const baseUrl = normalizeVoiceBridgeBaseUrl(payload && payload.baseUrl);
  const timeoutMs = Number(payload && payload.timeoutMs ? payload.timeoutMs : 4000);
  const ctrl = new AbortController();
  const t = setTimeout(()=>{ try{ ctrl.abort(); }catch(e){} }, Math.max(1500, Math.min(timeoutMs, 30000)));
  const candidates = [`${baseUrl}/health`, baseUrl];
  let lastError = 'Voice bridge not reachable';
  try{
    for(const url of candidates){
      try{
        const res = await fetch(url, { method:'GET', signal: ctrl.signal, headers:{ 'accept':'application/json,text/plain;q=0.9,*/*;q=0.8' } });
        const text = await res.text();
        if(!res.ok){ lastError = `HTTP ${res.status}`; continue; }
        let data = null;
        try{ data = text ? JSON.parse(text) : null; }catch(e){}
        return {
          ok:true,
          status: String((data && (data.status || data.state)) || 'ready'),
          model: data && (data.model || data.engine || data.name) ? String(data.model || data.engine || data.name) : '',
          version: data && data.version ? String(data.version) : '',
          detail: data && data.detail ? String(data.detail) : (text || 'Voice bridge ready'),
        };
      }catch(e){
        lastError = String(e);
      }
    }
    return { ok:false, error:lastError };
  } finally { clearTimeout(t); }
}

async function safeVoiceBridgeTranscribe(payload){
  const baseUrl = normalizeVoiceBridgeBaseUrl(payload && payload.baseUrl);
  const timeoutMs = Number(payload && payload.timeoutMs ? payload.timeoutMs : 25000);
  const mimeType = String(payload && payload.mimeType ? payload.mimeType : 'audio/webm');
  const audioBase64 = String(payload && payload.audioBase64 ? payload.audioBase64 : '');
  if(!audioBase64) return { ok:false, error:'Missing audio payload' };
  const ctrl = new AbortController();
  const t = setTimeout(()=>{ try{ ctrl.abort(); }catch(e){} }, Math.max(4000, Math.min(timeoutMs, 120000)));
  try{
    const res = await fetch(`${baseUrl}/transcribe`, {
      method:'POST',
      signal: ctrl.signal,
      headers:{ 'content-type':'application/json', 'accept':'application/json,text/plain;q=0.9,*/*;q=0.8' },
      body: JSON.stringify({ audioBase64, mimeType, language:'en', source:'OddEngine Homie' }),
    });
    const text = await res.text();
    if(!res.ok) return { ok:false, error:`HTTP ${res.status}: ${text.slice(0, 400)}` };
    let data = null;
    try{ data = text ? JSON.parse(text) : null; }catch(e){}
    const transcript = String((data && (data.text || data.transcript || data.result)) || '').trim();
    if(!transcript) return { ok:false, error:'No transcript returned from external voice bridge' };
    return {
      ok:true,
      text: transcript,
      model: data && (data.model || data.engine || data.name) ? String(data.model || data.engine || data.name) : '',
      detail: data && data.detail ? String(data.detail) : '',
    };
  } finally { clearTimeout(t); }
}

async function safeFetchText(payload){
  const url = payload && payload.url ? String(payload.url) : "";
  if(!url || !isSafeHttpUrl(url)) throw new Error("Invalid URL");
  const method = String(payload && payload.method ? payload.method : "GET").toUpperCase();
  const headersIn = (payload && payload.headers) ? payload.headers : {};
  const headers = {};
  const body = typeof (payload && payload.body) === "string" ? String(payload.body) : undefined;
  // allow only string headers
  for(const k of Object.keys(headersIn||{})){
    const v = headersIn[k];
    if(typeof v === "string") headers[k] = v;
  }
  const timeoutMs = Number(payload && payload.timeoutMs ? payload.timeoutMs : 12000);
  const maxBytes = Number(payload && payload.maxBytes ? payload.maxBytes : 2_000_000);
  const ctrl = new AbortController();
  const t = setTimeout(()=>{ try{ ctrl.abort(); }catch(e){} }, Math.max(2000, Math.min(timeoutMs, 60000)));
  try{
    const res = await fetch(url, { method, headers, body, signal: ctrl.signal });
    const ab = await res.arrayBuffer();
    if(ab.byteLength > maxBytes) throw new Error("Response too large");
    const text = Buffer.from(ab).toString("utf8");
    return { ok: true, status: res.status, text };
  } finally {
    clearTimeout(t);
  }
}

ipcMain.handle("odd:fetchText", async (_e, payload) => {
  try{
    const r = await safeFetchText(payload || {});
    return r;
  }catch(e){
    return { ok:false, error:String(e) };
  }
});

ipcMain.handle("odd:voiceBridgeProbe", async (_e, payload) => {
  try{
    return await safeVoiceBridgeProbe(payload || {});
  }catch(e){
    return { ok:false, error:String(e) };
  }
});

ipcMain.handle("odd:voiceBridgeTranscribe", async (_e, payload) => {
  try{
    return await safeVoiceBridgeTranscribe(payload || {});
  }catch(e){
    return { ok:false, error:String(e) };
  }
});

ipcMain.handle("odd:generate", async (_e, payload) => {
  const { type, exportBase, projectDir, opts } = payload || {};
  const brand = (opts && opts.brand) ? String(opts.brand) : "FairlyOdd";
  const files = generateFiles(type, brand);
  const base = exportBase && String(exportBase).trim().length ? String(exportBase) : path.join(app.getPath("userData"), "exports");
  const outDir = projectDir ? path.join(base, path.basename(projectDir), type) : path.join(base, type);
  ensureDir(outDir);
  writeFiles(outDir, files);
  log(`generate:${type} -> ${outDir}`);
  return { ok:true, outDir, count: files.length };
});

ipcMain.handle("odd:run", async (_e, payload) => {
  const { cmd, args, cwd } = payload || {};
  if(!cmd) return { ok:false, error:"Missing cmd" };
  const id = String(runSeq++);
  const proc = spawn(cmd, args || [], { cwd: cwd || process.cwd(), shell: true });
  RUNS.set(id, { proc, cwd, cmd, args, startedAt: Date.now() });
  log(`run:${id} ${cmd} ${(args||[]).join(" ")} in ${cwd||process.cwd()}`);

  proc.stdout.on("data", (d) => {
    const line = d.toString();
    pushDevLog({ ts: Date.now(), type: "stdout", id, text: line });
    if(mainWindow && mainWindow.webContents) mainWindow.webContents.send("odd:runOutput", { type:"stdout", id, line });
  });
  proc.stderr.on("data", (d) => {
    const line = d.toString();
    pushDevLog({ ts: Date.now(), type: "stderr", id, text: line });
    if(mainWindow && mainWindow.webContents) mainWindow.webContents.send("odd:runOutput", { type:"stderr", id, line });
  });
  proc.on("exit", (code) => {
    LAST_EXIT = { id, code, ts: Date.now() };
    pushDevLog({ ts: Date.now(), type: "exit", id, text: String(code) });
    if(mainWindow && mainWindow.webContents) mainWindow.webContents.send("odd:runOutput", { type:"exit", id, code });
    RUNS.delete(id);
  });
  return { ok:true, id };
});

ipcMain.handle("odd:stopRun", async (_e, id) => {
  const r = RUNS.get(String(id));
  if(!r) return { ok:false, error:"Not running" };
  try{ r.proc.kill(); }catch(e){}
  RUNS.delete(String(id));
  return { ok:true };
});

ipcMain.handle("odd:tcpPing", async (_e, payload) => {
  const host = payload && payload.host ? String(payload.host) : "";
  const port = payload && payload.port ? Number(payload.port) : 80;
  const timeoutMs = payload && payload.timeoutMs ? Number(payload.timeoutMs) : 1200;
  return await new Promise((resolve) => {
    const socket = new net.Socket();
    let done = false;
    function finish(ok, error){
      if(done) return;
      done = true;
      try{ socket.destroy(); }catch(e){}
      resolve({ ok, host, port, error });
    }
    socket.setTimeout(timeoutMs);
    socket.once("error", (err) => finish(false, String(err)));
    socket.once("timeout", () => finish(false, "timeout"));
    socket.connect(port, host, () => finish(true, null));
  });
});

// ---------- plugins ----------
function getPluginDir(){
  const dir = path.join(app.getPath("userData"), "plugins");
  ensureDir(dir);
  return dir;
}
function safeReadJson(p){
  try{
    const raw = fs.readFileSync(p, "utf-8");
    return JSON.parse(raw);
  }catch(e){ return null; }
}
function listPluginManifests(){
  const dir = getPluginDir();
  const out = [];
  try{
    const entries = fs.readdirSync(dir, { withFileTypes:true });
    for(const ent of entries){
      if(ent.isDirectory()){
        const folder = path.join(dir, ent.name);
        // allow either <id>.plugin.json or plugin.json
        const candidates = [
          path.join(folder, `${ent.name}.plugin.json`),
          path.join(folder, "plugin.json")
        ];
        for(const c of candidates){
          if(fs.existsSync(c)){
            const j = safeReadJson(c);
            if(j && j.id){
              if(!j.version) j.version = "0.0.0";
              out.push({
                id: String(j.id),
                name: String(j.name || j.id),
                version: String(j.version || "0.0.0"),
                description: j.description ? String(j.description) : "",
                ui: j.ui ? String(j.ui) : "",
                actions: Array.isArray(j.actions) ? j.actions : [],
                _path: c,
                _dir: folder
              });
            }
            break;
          }
        }
      }else if(ent.isFile() && ent.name.endsWith(".plugin.json")){
        const p = path.join(dir, ent.name);
        const j = safeReadJson(p);
        if(j && j.id){
          if(!j.version) j.version = "0.0.0";
          out.push({
            id: String(j.id),
            name: String(j.name || j.id),
            version: String(j.version || "0.0.0"),
            description: j.description ? String(j.description) : "",
            ui: j.ui ? String(j.ui) : "",
            actions: Array.isArray(j.actions) ? j.actions : [],
            _path: p,
            _dir: dir
          });
        }
      }
    }
  }catch(e){}
  return { dir, plugins: out };
}


// ---------- Dev snapshot + issue detection (Homie) ----------
const PLAYBOOKS = {
  clean_reinstall: {
    id: "clean_reinstall",
    name: "Clean reinstall",
    safe: true,
    description: "Deletes node_modules + lockfiles, cleans npm cache, reinstalls deps.",
    steps: [
      { kind: "rm", path: "node_modules" },
      { kind: "rm", path: "ui/node_modules" },
      { kind: "del", path: "package-lock.json" },
      { kind: "del", path: "ui/package-lock.json" },
      { kind: "cmd", cmd: "npm", args: ["cache", "clean", "--force"] },
      { kind: "cmd", cmd: "npm", args: ["install", "--no-audit", "--no-fund"] },
    ]
  },
  fix_vite_base: {
    id: "fix_vite_base",
    name: "Fix Vite base path",
    safe: true,
    description: "Ensures ui/vite.config.ts uses base:'./' then rebuilds the UI.",
    steps: [
      { kind: "patch_vite_base" },
      { kind: "cmd", cmd: "npm", args: ["run", "build:ui"] },
    ]
  },
  verify_scripts: {
    id: "verify_scripts",
    name: "Verify scripts",
    safe: true,
    description: "Runs basic verification commands (build UI + list dist files).",
    steps: [
      { kind: "cmd", cmd: "npm", args: ["run", "build:ui"] },
      { kind: "cmd", cmd: "node", args: ["-e", "console.log('ui/dist exists:', require('fs').existsSync('ui/dist'))"] },
    ]
  }
};

function safeRm(p){
  try{
    if(fs.existsSync(p)){
      fs.rmSync(p, { recursive:true, force:true });
    }
    return true;
  }catch(e){ return false; }
}
function safeDel(p){
  try{
    if(fs.existsSync(p)) fs.rmSync(p, { force:true });
    return true;
  }catch(e){ return false; }
}
function patchViteBase(projectCwd){
  const p = path.join(projectCwd, "ui", "vite.config.ts");
  try{
    if(!fs.existsSync(p)) return { ok:false, error:"ui/vite.config.ts not found" };
    let src = fs.readFileSync(p, "utf-8");
    // If a base is already set, normalize it to "./"
    if(/base\s*:\s*['"]/.test(src)){
      src = src.replace(/base\s*:\s*['"][^'"]+['"]\s*,?/g, "base: \"./\",");
    } else {
      // Insert base into defineConfig object
      src = src.replace(/defineConfig\(\s*\{\s*/m, (m)=> m + "\n  base: \"./\",\n");
    }
    fs.writeFileSync(p, src, "utf-8");
    return { ok:true };
  }catch(e){
    return { ok:false, error:String(e && e.message ? e.message : e) };
  }
}

function detectIssuesFromTail(tailText){
  const t = String(tailText || "");
  const issues = [];

  function add(id, title, severity, explanation, recommendedPlaybooks, evidence){
    issues.push({ id, title, severity, explanation, recommendedPlaybooks, evidence });
  }

  if(/ENOTFOUND/i.test(t) && /registry|npm/i.test(t)){
    add(
      "npm_enotfound",
      "npm registry / DNS failure (ENOTFOUND)",
      "error",
      "npm cannot reach the registry. This is usually DNS, proxy, or a lockfile pointing to an internal registry. Try a clean reinstall and confirm your registry is https://registry.npmjs.org/.",
      ["clean_reinstall"],
      "Found ENOTFOUND in npm output."
    );
  }

  if(/'vite'\s+is\s+not\s+recognized/i.test(t) || /vite:\s*not found/i.test(t)){
    add(
      "vite_missing",
      "Vite missing in UI deps",
      "error",
      "The UI dev server can't start because Vite isn't installed (or ui/node_modules is missing). Run a clean reinstall (it also reinstalls the ui workspace).",
      ["clean_reinstall"],
      "Found \"vite is not recognized\"."
    );
  }

  if(/ERR_FILE_NOT_FOUND/i.test(t) && /index-.*\.(js|css)/i.test(t)){
    add(
      "electron_asset_path",
      "Electron can't find built UI assets",
      "error",
      "The packaged app is loading UI via file:// and Vite built assets with an absolute /assets path. Ensure Vite base is set to './' and rebuild UI.",
      ["fix_vite_base"],
      "Found ERR_FILE_NOT_FOUND for index-*.js/css."
    );
  }

  if(/Cannot find module/i.test(t)){
    add(
      "node_module_missing",
      "Missing Node module",
      "warn",
      "A dependency is missing or node_modules is corrupted. A clean reinstall usually fixes it.",
      ["clean_reinstall"],
      "Found \"Cannot find module\"."
    );
  }

  // Keep list short and high-signal
  return issues.slice(0, 6);
}

function getDevSnapshot(limit){
  const lim = Math.max(50, Math.min(2000, Number(limit || 200)));
  const tail = DEV_LOG.slice(-lim);
  const runs = Array.from(RUNS.entries()).map(([id, r]) => ({ id, cmd: r.cmd, args: r.args || [], cwd: r.cwd, startedAt: r.startedAt }));
  const tailText = tail.map(x => `[${new Date(x.ts).toISOString()}] ${x.type}${x.id?`(${x.id})`:``}: ${x.text}`).join("\n");
  const issues = detectIssuesFromTail(tailText);
  return {
    ok: true,
    runningCount: RUNS.size,
    runs,
    lastExit: LAST_EXIT,
    tail,
    issues,
    playbooks: Object.values(PLAYBOOKS).map(p => ({ id: p.id, name: p.name, safe: !!p.safe, description: p.description }))
  };
}

async function runCmdStreaming(cmd, args, cwd, pbId, label){
  return await new Promise((resolve) => {
    const proc = spawn(cmd, args || [], { cwd, shell: true });
    const prefix = label ? `${label}: ` : "";
    proc.stdout.on("data", (d) => {
      const line = d.toString();
      pushDevLog({ ts: Date.now(), type: "playbook", id: pbId, text: line });
      if(mainWindow && mainWindow.webContents) mainWindow.webContents.send("odd:runOutput", { type:"playbook", pbId, line: prefix + line });
    });
    proc.stderr.on("data", (d) => {
      const line = d.toString();
      pushDevLog({ ts: Date.now(), type: "playbook", id: pbId, text: line });
      if(mainWindow && mainWindow.webContents) mainWindow.webContents.send("odd:runOutput", { type:"playbook", pbId, line: prefix + line });
    });
    proc.on("exit", (code) => resolve({ ok: code === 0, code }));
  });
}

async function runPlaybookAsync(playbookId, projectCwd, pbId){
  const pb = PLAYBOOKS[playbookId];
  const cwd = projectCwd || process.cwd();
  const _pbId = pbId || `pb-${Date.now()}-${Math.floor(Math.random()*9999)}`;
  pushDevLog({ ts: Date.now(), type: "playbook", id: _pbId, text: `START ${pb.name} @ ${cwd}` });
  if(mainWindow && mainWindow.webContents) mainWindow.webContents.send("odd:runOutput", { type:"playbookStart", pbId: _pbId, playbookId, name: pb.name });

  for(const step of pb.steps){
    if(step.kind === "rm"){
      const p = path.join(cwd, step.path);
      const ok = safeRm(p);
      const msg = ok ? `Removed ${step.path}` : `Failed to remove ${step.path}`;
      pushDevLog({ ts: Date.now(), type: "playbook", id: _pbId, text: msg });
      if(mainWindow && mainWindow.webContents) mainWindow.webContents.send("odd:runOutput", { type:"playbook", pbId: _pbId, line: msg });
      continue;
    }
    if(step.kind === "del"){
      const p = path.join(cwd, step.path);
      const ok = safeDel(p);
      const msg = ok ? `Deleted ${step.path}` : `Failed to delete ${step.path}`;
      pushDevLog({ ts: Date.now(), type: "playbook", id: _pbId, text: msg });
      if(mainWindow && mainWindow.webContents) mainWindow.webContents.send("odd:runOutput", { type:"playbook", pbId: _pbId, line: msg });
      continue;
    }
    if(step.kind === "patch_vite_base"){
      const res = patchViteBase(cwd);
      const msg = res.ok ? `Patched ui/vite.config.ts base to './'` : `Failed to patch vite base: ${res.error||""}`;
      pushDevLog({ ts: Date.now(), type: "playbook", id: _pbId, text: msg });
      if(mainWindow && mainWindow.webContents) mainWindow.webContents.send("odd:runOutput", { type:"playbook", pbId: _pbId, line: msg });
      if(!res.ok){
        if(mainWindow && mainWindow.webContents) mainWindow.webContents.send("odd:runOutput", { type:"playbookEnd", pbId: _pbId, ok:false });
        return { ok:false, pbId: _pbId, error: res.error || "patch failed" };
      }
      continue;
    }
    if(step.kind === "cmd"){
      const label = `${step.cmd} ${(step.args||[]).join(" ")}`;
      if(mainWindow && mainWindow.webContents) mainWindow.webContents.send("odd:runOutput", { type:"playbook", pbId: _pbId, line: `RUN ${label}` });
      const res = await runCmdStreaming(step.cmd, step.args || [], cwd, _pbId, "");
      if(!res.ok){
        if(mainWindow && mainWindow.webContents) mainWindow.webContents.send("odd:runOutput", { type:"playbookEnd", pbId: _pbId, ok:false, code: res.code });
        return { ok:false, pbId: _pbId, code: res.code };
      }
      continue;
    }
  }
  if(mainWindow && mainWindow.webContents) mainWindow.webContents.send("odd:runOutput", { type:"playbookEnd", pbId: _pbId, ok:true });
  return { ok:true, pbId: _pbId };
}


ipcMain.handle("odd:getDevSnapshot", async (_e, opts) => {
  const limit = opts && opts.limit ? Number(opts.limit) : 220;
  return getDevSnapshot(limit);
});

ipcMain.handle("odd:runPlaybook", async (_e, payload) => {
  const playbookId = payload && payload.playbookId ? String(payload.playbookId) : "";
  const cwd = payload && payload.cwd ? String(payload.cwd) : process.cwd();
  const pb = PLAYBOOKS[playbookId];
  if(!pb) return { ok:false, error:"Unknown playbook", playbookId };
  const pbId = `pb-${Date.now()}-${Math.floor(Math.random()*9999)}`;
  // fire and forget, stream output into the UI
  runPlaybookAsync(playbookId, cwd, pbId);
  return { ok:true, pbId, playbookId, name: pb.name };
});

ipcMain.handle("odd:listPlugins", async () => {
  const r = listPluginManifests();
  return { ok:true, plugins: r.plugins, pluginDir: r.dir };
});

ipcMain.handle("odd:openPluginsFolder", async () => {
  const dir = getPluginDir();
  try{ await shell.openPath(dir); }catch(e){}
  return { ok:true, path: dir };
});

// ---------- pick file ----------
ipcMain.handle("odd:pickFile", async (_e, opts) => {
  const filters = (opts && opts.filters) ? opts.filters : [{ name:"All Files", extensions:["*"] }];
  const res = await dialog.showOpenDialog({ properties:["openFile"], filters });
  if(res.canceled || !res.filePaths || !res.filePaths[0]) return { ok:false };
  return { ok:true, path: res.filePaths[0] };
});

// ---------- emulator detection ----------
function firstExisting(candidates){
  for(const p of candidates){
    try{ if(p && fs.existsSync(p)) return p; }catch(e){}
  }
  return null;
}

function tryWhere(cmd){
  return new Promise((resolve) => {
    const p = spawn("where", [cmd], { windowsHide:true });
    let out = "";
    p.stdout.on("data", d => out += d.toString());
    p.on("close", () => {
      const line = out.split(/\r?\n/).map(s=>s.trim()).filter(Boolean)[0];
      resolve(line || null);
    });
    p.on("error", () => resolve(null));
  });
}

async function detectEmulators(){
  const emulators = [];

  // BlueStacks
  const bs = firstExisting([
    path.join(process.env.ProgramFiles || "C:\\Program Files", "BlueStacks_nxt", "HD-Player.exe"),
    path.join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "BlueStacks_nxt", "HD-Player.exe"),
    path.join(process.env.ProgramFiles || "C:\\Program Files", "BlueStacks", "HD-Player.exe"),
    path.join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "BlueStacks", "HD-Player.exe"),
  ]);
  if(bs) emulators.push({ id:"bluestacks", name:"BlueStacks", kind:"bluestacks", exePath: bs, notes:"High compatibility" });

  // LDPlayer
  const ld = firstExisting([
    "C:\\LDPlayer\\LDPlayer9\\dnplayer.exe",
    "C:\\LDPlayer\\LDPlayer4\\dnplayer.exe",
    path.join(process.env.ProgramFiles || "C:\\Program Files", "LDPlayer", "LDPlayer9", "dnplayer.exe"),
    path.join(process.env.ProgramFiles || "C:\\Program Files", "LDPlayer", "LDPlayer4", "dnplayer.exe"),
  ]);
  if(ld) emulators.push({ id:"ldplayer", name:"LDPlayer", kind:"ldplayer", exePath: ld, notes:"Fast + lightweight" });

  // Nox
  const nox = firstExisting([
    path.join(process.env.ProgramFiles || "C:\\Program Files", "Nox", "bin", "Nox.exe"),
    path.join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "Nox", "bin", "Nox.exe"),
  ]);
  if(nox) emulators.push({ id:"nox", name:"Nox", kind:"nox", exePath: nox });

  // MEmu
  const memu = firstExisting([
    path.join(process.env.ProgramFiles || "C:\\Program Files", "Microvirt", "MEmu", "MEmu.exe"),
    path.join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "Microvirt", "MEmu", "MEmu.exe"),
  ]);
  if(memu) emulators.push({ id:"memu", name:"MEmu", kind:"memu", exePath: memu });

  // Android Studio emulator
  const sdkRoot = process.env.ANDROID_SDK_ROOT || process.env.ANDROID_HOME || path.join(process.env.LOCALAPPDATA || "", "Android", "Sdk");
  const studioEmu = firstExisting([
    path.join(sdkRoot || "", "emulator", "emulator.exe")
  ]);
  if(studioEmu) emulators.push({ id:"android_studio", name:"Android Studio Emulator", kind:"android_studio", exePath: studioEmu, notes:"Best for dev; needs SDK" });

  // adb
  let adbPath = await tryWhere("adb");
  if(!adbPath){
    adbPath = firstExisting([
      path.join(sdkRoot || "", "platform-tools", "adb.exe"),
      path.join(process.env.LOCALAPPDATA || "", "Android", "Sdk", "platform-tools", "adb.exe"),

      // emulator-bundled adb (common)
      path.join(process.env.ProgramFiles || "C:\Program Files", "BlueStacks_nxt", "HD-Adb.exe"),
      path.join(process.env["ProgramFiles(x86)"] || "C:\Program Files (x86)", "BlueStacks_nxt", "HD-Adb.exe"),
      path.join(process.env.ProgramFiles || "C:\Program Files", "BlueStacks", "HD-Adb.exe"),
      path.join(process.env["ProgramFiles(x86)"] || "C:\Program Files (x86)", "BlueStacks", "HD-Adb.exe"),

      "C:\LDPlayer\LDPlayer9\adb.exe",
      "C:\LDPlayer\LDPlayer4\adb.exe",
      path.join(process.env.ProgramFiles || "C:\Program Files", "LDPlayer", "LDPlayer9", "adb.exe"),
      path.join(process.env.ProgramFiles || "C:\Program Files", "LDPlayer", "LDPlayer4", "adb.exe"),

      path.join(process.env.ProgramFiles || "C:\Program Files", "Nox", "bin", "nox_adb.exe"),
      path.join(process.env["ProgramFiles(x86)"] || "C:\Program Files (x86)", "Nox", "bin", "nox_adb.exe"),

      path.join(process.env.ProgramFiles || "C:\Program Files", "Microvirt", "MEmu", "adb.exe"),
      path.join(process.env["ProgramFiles(x86)"] || "C:\Program Files (x86)", "Microvirt", "MEmu", "adb.exe"),
    ]);
  }

  return { emulators, adbPath: adbPath || null, sdkRoot: sdkRoot || null };
}

ipcMain.handle("odd:detectEmulators", async () => {
  const r = await detectEmulators();
  return { ok:true, emulators: r.emulators, adbPath: r.adbPath, sdkRoot: r.sdkRoot };
});

function execCapture(cmd, args, opts){
  return new Promise((resolve) => {
    const p = spawn(cmd, args || [], { windowsHide:true, ...opts });
    let out = "";
    let err = "";
    p.stdout.on("data", d => out += d.toString());
    p.stderr.on("data", d => err += d.toString());
    p.on("close", (code) => resolve({ ok: code === 0, code, stdout: out.trim(), stderr: err.trim() }));
    p.on("error", (e) => resolve({ ok:false, code: -1, stdout:"", stderr:String(e) }));
  });
}

async function adbFirstDevice(adbPath){
  const r = await execCapture(adbPath, ["devices"]);
  if(!r.ok) return null;
  const lines = r.stdout.split(/\r?\n/).slice(1).map(l=>l.trim()).filter(Boolean);
  const dev = lines.map(l=>l.split(/\s+/)[0]).filter(Boolean)[0];
  return dev || null;
}

ipcMain.handle("odd:emuAction", async (_e, payload) => {
  const action = payload && payload.action ? String(payload.action) : "";
  if(action === "launch_emulator"){
    const exePath = payload.exePath ? String(payload.exePath) : "";
    const args = Array.isArray(payload.args) ? payload.args.map(String) : [];
    if(!exePath || !fs.existsSync(exePath)) return { ok:false, error:"Emulator EXE not found" };
    try{
      spawn(exePath, args, { detached:true, stdio:"ignore" }).unref();
      return { ok:true };
    }catch(e){
      return { ok:false, error:String(e) };
    }
  }

  // adb-required actions
  const det = await detectEmulators();
  const adbPath = payload.adbPath ? String(payload.adbPath) : det.adbPath;
  if(!adbPath) return { ok:false, error:"adb not found (install Android platform-tools or an emulator that bundles adb)" };

  const device = await adbFirstDevice(adbPath);
  if(!device) return { ok:false, error:"No device/emulator detected. Start your emulator (or plug phone) then try again." };

  if(action === "open_play_store"){
    const packageId = payload.packageId ? String(payload.packageId) : "";
    if(!packageId) return { ok:false, error:"Missing packageId" };
    const uri = `market://details?id=${packageId}`;
    const r = await execCapture(adbPath, ["-s", device, "shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", uri]);
    return { ok:r.ok, device, ...r };
  }

  if(action === "launch_app"){
    const packageId = payload.packageId ? String(payload.packageId) : "";
    if(!packageId) return { ok:false, error:"Missing packageId" };
    const r = await execCapture(adbPath, ["-s", device, "shell", "monkey", "-p", packageId, "-c", "android.intent.category.LAUNCHER", "1"]);
    return { ok:r.ok, device, ...r };
  }

  if(action === "install_apk"){
    const apkPath = payload.apkPath ? String(payload.apkPath) : "";
    if(!apkPath || !fs.existsSync(apkPath)) return { ok:false, error:"APK file not found" };
    const r = await execCapture(adbPath, ["-s", device, "install", "-r", apkPath]);
    return { ok:r.ok, device, ...r };
  }

  return { ok:false, error:"Unknown action" };
});

// ----------------- Homie AI (local Ollama, Desktop-only) -----------------
const http = require("http");

function httpJson({ method, host, port, path }, body, timeoutMs = 15000) {
  return new Promise((resolve) => {
    const data = body ? Buffer.from(JSON.stringify(body), "utf8") : null;
    const req = http.request(
      {
        method,
        host,
        port,
        path,
        headers: {
          "Content-Type": "application/json",
          ...(data ? { "Content-Length": data.length } : {})
        }
      },
      (res) => {
        let raw = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (raw += chunk));
        res.on("end", () => {
          try {
            const json = raw ? JSON.parse(raw) : {};
            resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, json, raw });
          } catch (e) {
            resolve({ ok: false, status: res.statusCode || 0, json: null, raw });
          }
        });
      }
    );

    req.on("error", (err) => resolve({ ok: false, status: 0, json: null, raw: String(err) }));
    req.setTimeout(timeoutMs, () => {
      try { req.destroy(new Error("timeout")); } catch (_) {}
    });
    if (data) req.write(data);
    req.end();
  });
}

async function ollamaTags() {
  const r = await httpJson({ method: "GET", host: "127.0.0.1", port: 11434, path: "/api/tags" }, null, 6000);
  if (!r.ok) return { ok: false, error: r.raw || "Ollama not reachable" };
  const models = Array.isArray(r.json && r.json.models) ? r.json.models : [];
  const names = models.map((m) => m && m.name).filter(Boolean);
  return { ok: true, models: names };
}

async function ollamaChat({ messages, model, system, temperature }) {
  const mm = String(model || "").trim() || "llama3.1:8b";
  const msgs = Array.isArray(messages) ? messages : [];
  const out = [];
  if (system && String(system).trim()) out.push({ role: "system", content: String(system) });
  for (const m of msgs) {
    if (!m || !m.role || !m.content) continue;
    const role = String(m.role);
    if (role !== "user" && role !== "assistant" && role !== "system") continue;
    out.push({ role, content: String(m.content) });
  }
  if (out.length === 0) return { ok: false, error: "No messages" };

  const payload = {
    model: mm,
    messages: out,
    stream: false,
    options: {
      temperature: typeof temperature === "number" ? temperature : 0.2
    }
  };

  const r = await httpJson({ method: "POST", host: "127.0.0.1", port: 11434, path: "/api/chat" }, payload, 30000);
  if (!r.ok) {
    const msg = (r.json && (r.json.error || r.json.message)) ? String(r.json.error || r.json.message) : (r.raw || "Ollama request failed");
    return { ok: false, error: msg, model: mm };
  }

  const reply = r.json && r.json.message && r.json.message.content ? String(r.json.message.content) : "";
  return { ok: true, reply, model: mm };
}

ipcMain.handle("odd:homieCheck", async () => {
  const r = await ollamaTags();
  if (!r.ok) return { ok: false, running: false, error: r.error || "Ollama not reachable" };
  return { ok: true, running: true, models: r.models || [] };
});

ipcMain.handle("odd:homieChat", async (_e, payload) => {
  try {
    const r = await ollamaChat(payload || {});
    return r;
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});