import React, { useEffect, useMemo, useState } from "react";
import { loadJSON, saveJSON } from "../lib/storage";
import { pushNotif } from "../lib/notifs";
import { isDesktop, oddApi } from "../lib/odd";

type Game = {
  name: string;
  platform: "ZBD" | "Other";
  url: string;
  notes?: string;
  // Android
  packageId?: string;
  apkPath?: string;
  // iOS (can’t be emulated here; we just deep-link to App Store)
  iosUrl?: string;
};

type EmuDetect = {
  ts: number;
  emulators: { id: string; name: string; exePath?: string }[];
  adbPath?: string;
};

type State = {
  games: Game[];
  preferredEmuId: string;
  lastDetect?: EmuDetect;
};

const KEY = "oddengine:cryptoGames:v2";
const PREFS_KEY = "oddengine:prefs:v1";
const SETTINGS_KEY = "oddengine:cryptoGames:settings:v1";

function playStoreUrl(pkg: string){
  return `https://play.google.com/store/apps/details?id=${encodeURIComponent(pkg)}`;
}


async function fetchTextSmart(url: string){
  if(isDesktop()){
    const r:any = await oddApi().fetchText({ url, timeoutMs: 15000, maxBytes: 2_000_000 });
    if(!r?.ok) throw new Error(r?.error || "fetch failed");
    return String(r.text || "");
  }
  const res = await fetch(url);
  return await res.text();
}

function extractGamesFromPageText(text: string){
  const lines = text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  const joined = lines.join("\n");
  const startKey = "Have fun while earning Bitcoin";
  const endKey = "See all games";
  let slice = joined;
  const sIdx = joined.indexOf(startKey);
  if(sIdx >= 0){
    slice = joined.slice(sIdx + startKey.length);
    const eIdx = slice.indexOf(endKey);
    if(eIdx >= 0) slice = slice.slice(0, eIdx);
  }
  const cand = slice.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  const bad = new Set(["Join the fun & play free games", "Play games & earn Bitcoin on ZBD", "Bitcoin for", "everyone"]);
  return cand
    .filter(n => n.length >= 3 && n.length <= 50)
    .filter(n => !bad.has(n))
    .filter(n => !/^\d+[\,\d]*$/.test(n))
    .filter(n => !/sats/i.test(n))
    .filter(n => !/privacy|terms|discord|download|wallet|extension/i.test(n));
}

function parseZbdGameNames(html: string){
  try{
    const doc = new DOMParser().parseFromString(html, "text/html");
    const text = (doc.body && (doc.body as any).innerText) ? String((doc.body as any).innerText) : html;
    const names = extractGamesFromPageText(text);
    const heads = Array.from(doc.querySelectorAll("h2,h3")).map(el => (el.textContent||"").trim()).filter(Boolean);
    const merged = [...names, ...heads];
    const out:string[] = [];
    const seen = new Set<string>();
    for(const n of merged){
      const clean = n.replace(/\s+/g," ").trim();
      if(clean.length < 3 || clean.length > 60) continue;
      if(/ZBD Web|Welcome|Best earnings|Sign in|Bitcoin for everyone|Come join us|Stay up to date/i.test(clean)) continue;
      if(seen.has(clean.toLowerCase())) continue;
      seen.add(clean.toLowerCase());
      out.push(clean);
    }
    return out;
  }catch(e){
    return [];
  }
}

export default function CryptoGames(){
  const [state, setState] = useState<State>(() => {
  const base:any = loadJSON(KEY, { games: [], preferredEmuId: "auto" } as any);
  const prefs:any = loadJSON(PREFS_KEY, null as any);
  const pref = prefs?.zbd?.preferredEmulator;
  if(pref && (base.preferredEmuId === "auto" || base.preferredEmuId === "bluestacks")){
    const map:any = { auto:"auto", bluestacks:"bluestacks", ldplayer:"ldplayer", nox:"nox", memu:"memu", androidstudio:"androidstudio" };
    base.preferredEmuId = map[pref] || base.preferredEmuId;
  }
  return base;
});
  const [paste, setPaste] = useState("");
  const [settings, setSettings] = useState<{ walletAddress: string }>(() => {
    const base:any = loadJSON(SETTINGS_KEY, { walletAddress: "" } as any);
    const prefs:any = loadJSON(PREFS_KEY, null as any);
    if((!base.walletAddress || base.walletAddress==="") && prefs?.zbd?.walletAddress){
      base.walletAddress = String(prefs.zbd.walletAddress || "");
    }
    return base;
  });
  function saveSettings(next: { walletAddress: string }){
    setSettings(next);
    saveJSON(SETTINGS_KEY, next);
  }
  const desktop = isDesktop();

  const count = state.games.length;
  const emulators = state.lastDetect?.emulators || [];
  const preferred = useMemo(()=>emulators.find(e=>e.id===state.preferredEmuId), [emulators, state.preferredEmuId]);

  function save(next: State){
    setState(next);
    saveJSON(KEY, next);
  }

  function seed(){
    if(state.games.length>0){
      pushNotif({ title:"Crypto Games", body:"You already have items. (Seed only runs when empty.)", tags:["Crypto Games"], level:"warn" });
      return;
    }
    const defaults: Game[] = [
      {
        name:"Bitcoin Miner: Idle Tycoon",
        platform:"ZBD",
        packageId:"com.fumbgames.bitcoinminor",
        url:"https://zbd.gg/z/earn?gameName=Bitcoin%20Miner",
        iosUrl:"https://apps.apple.com/us/app/bitcoin-miner-idle-tycoon/id1413770650",
        notes:"Seeded example: ZBD earn page + Android packageId (Play Store) + iOS deep link.",
      },
      { name:"ZBD", platform:"ZBD", url:"https://zbd.gg/z/earn", notes:"Earn page / games hub" },
    ];
    save({ ...state, games: defaults });
    pushNotif({ title:"Crypto Games", body:"Seeded 1 example game + ZBD hub.", tags:["Crypto Games"], level:"good" });
  }

  function parsePaste(){
    const lines = paste.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
    if(lines.length===0) return;
    const added: Game[] = [];
    for(const line of lines){
      const parts = line.split("|").map(s=>s.trim()).filter(Boolean);
      if(parts.length>=2){
        added.push({ name: parts[0], url: parts.slice(1).join(" | "), platform:"Other" });
      }else{
        // URL only → name fallback
        added.push({ name: line.replace(/^https?:\/\//,"").slice(0,40), url: line, platform:"Other" });
      }
    }
    save({ ...state, games: [...added, ...state.games] });
    setPaste("");
    pushNotif({ title:"Crypto Games", body:`Added ${added.length} item(s).`, tags:["Crypto Games"], level:"good" });
  }

  function removeIdx(i:number){
    const next = state.games.slice();
    next.splice(i,1);
    save({ ...state, games: next });
  }

  async function detect(){
    if(!desktop){
      pushNotif({ title:"Emulator", body:"Desktop mode required to detect emulators.", tags:["Emulator"], level:"warn" });
      return;
    }
    try{
      const r = await oddApi().detectEmulators();
      if(r.ok){
        save({ ...state, lastDetect: { ts: Date.now(), emulators: r.emulators || [], adbPath: r.adbPath } });
        pushNotif({ title:"Emulator", body:`Detected ${r.emulators?.length || 0} emulators.`, tags:["Emulator"], level:"good" });
      }else{
        pushNotif({ title:"Emulator", body:r.error || "Detect failed.", tags:["Emulator"], level:"warn" });
      }
    }catch(e:any){
      pushNotif({ title:"Emulator", body:String(e?.message || e), tags:["Emulator"], level:"warn" });
    }
  }

  async function launchEmu(){
    if(!desktop){
      pushNotif({ title:"Emulator", body:"Desktop mode required to launch.", tags:["Emulator"], level:"warn" });
      return;
    }
    if(!preferred || !preferred.exePath){
      pushNotif({ title:"Emulator", body:"Preferred emulator not detected. Run Detect first.", tags:["Emulator"], level:"warn" });
      return;
    }
    try{
      const r = await oddApi().emuAction({ action:"launch_emulator", exePath: preferred.exePath, args: [] });
      if(r.ok) pushNotif({ title:"Emulator", body:`Launching: ${preferred.name}`, tags:["Emulator"], level:"good" });
      else pushNotif({ title:"Emulator", body:r.error || "Launch failed.", tags:["Emulator"], level:"warn" });
    }catch(e:any){
      pushNotif({ title:"Emulator", body:String(e?.message || e), tags:["Emulator"], level:"warn" });
    }
  }

  async function openStoreInDevice(pkg: string){
    if(!desktop){
      window.open(playStoreUrl(pkg), "_blank");
      return;
    }
    try{
      const r = await oddApi().emuAction({ action:"open_play_store", packageId: pkg });
      if(r.ok){
        pushNotif({ title:"Play Store", body:`Opened on device: ${r.device}`, tags:["Emulator"], level:"good" });
      }else{
        window.open(playStoreUrl(pkg), "_blank");
        pushNotif({ title:"Play Store", body:r.error || "Opened web Play Store (device not ready).", tags:["Emulator"], level:"warn" });
      }
    }catch(e:any){
      window.open(playStoreUrl(pkg), "_blank");
    }
  }

  async function launchInEmulator(pkg: string){
    if(!desktop){
      pushNotif({ title:"Launch", body:"Desktop mode required to launch apps.", tags:["Emulator"], level:"warn" });
      return;
    }
    try{
      const r = await oddApi().emuAction({ action:"launch_app", packageId: pkg });
      if(r.ok) pushNotif({ title:"Launch", body:`Launch sent to emulator (${r.device || "device"})`, tags:["Emulator"], level:"good" });
      else pushNotif({ title:"Launch", body:r.error || r.stderr || "Launch failed.", tags:["Emulator"], level:"warn" });
    }catch(e:any){
      pushNotif({ title:"Launch", body:String(e?.message || e), tags:["Emulator"], level:"warn" });
    }
  }

  async function pickApk(i:number){
    if(!desktop){
      pushNotif({ title:"APK", body:"Desktop mode required to pick an APK.", tags:["Emulator"], level:"warn" });
      return;
    }
    try{
      const r = await oddApi().pickFile({ filters: [{ name:"APK", extensions:["apk"] }, { name:"All Files", extensions:["*"] }] });
      if(r.ok && r.path){
        const next = state.games.slice();
        next[i] = { ...next[i], apkPath: r.path };
        save({ ...state, games: next });
        pushNotif({ title:"APK", body:"Saved APK path for this game.", tags:["Emulator"], level:"good" });
      }
    }catch(e:any){
      pushNotif({ title:"APK", body:String(e?.message || e), tags:["Emulator"], level:"warn" });
    }
  }

  async function installApk(i:number){
    const g = state.games[i];
    if(!g.apkPath){
      pushNotif({ title:"APK", body:"Pick an APK first.", tags:["Emulator"], level:"warn" });
      return;
    }
    if(!desktop){
      pushNotif({ title:"APK", body:"Desktop mode required to install APK.", tags:["Emulator"], level:"warn" });
      return;
    }
    try{
      const r = await oddApi().emuAction({ action:"install_apk", apkPath: g.apkPath });
      if(r.ok) pushNotif({ title:"APK", body:"Installed to device/emulator.", tags:["Emulator"], level:"good" });
      else pushNotif({ title:"APK", body:r.error || r.stderr || "Install failed.", tags:["Emulator"], level:"warn" });
    }catch(e:any){
      pushNotif({ title:"APK", body:String(e?.message || e), tags:["Emulator"], level:"warn" });
    }
  }

  useEffect(()=>{
    if(desktop && !state.lastDetect){
      detect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="card">
      <div className="row" style={{justifyContent:"space-between"}}>
        <div>
          <div style={{fontSize:22,fontWeight:800}}>Crypto Games</div>
          <div className="small">Tracker (local) + optional Android emulator launcher (Desktop).</div>
        </div>
        <span className={"badge "+(count>0?"good":"warn")}>{count} items</span>
      </div>

      <div className="card" style={{marginTop:12}}>
        <div style={{fontWeight:900}}>ZBD Settings</div>
        <div className="small">Optional wallet address (for your notes/tracking). Saved locally.</div>
        <div className="row" style={{marginTop:8}}>
          <input value={settings.walletAddress} onChange={e=>saveSettings({ walletAddress: e.target.value })} placeholder="(optional) wallet address" />
          <button onClick={()=>pushNotif({ title:"Crypto Games", body:"Saved ZBD settings.", tags:["Crypto Games"], level:"good" })}>Save</button>
        </div>
      </div>


      <div className="row" style={{marginTop:12, flexWrap:"wrap"}}>
        <button onClick={()=>window.open("https://zbd.gg/z/earn","_blank")}>Open ZBD Earn</button>
        <button onClick={seed}>Seed 1 example</button>
        <button onClick={scanOfficialZbd} title="Pull official game names from ZBD web lists (Desktop recommended)">Scan official ZBD</button>
      </div>

      <div className="card" style={{marginTop:12}}>
        <div className="row" style={{justifyContent:"space-between", alignItems:"center"}}>
          <div>
            <div style={{fontWeight:900}}>Emulator tools</div>
            <div className="small">Auto-detect + launch + Play Store deep link (Desktop only).</div>
          </div>
          <span className={"badge "+(desktop?"good":"warn")}>{desktop?"Desktop":"Web"}</span>
        </div>

        <div className="row" style={{marginTop:10, flexWrap:"wrap"}}>
          <button onClick={detect}>Detect emulators</button>
          <button onClick={launchEmu} disabled={!desktop || !preferred}>Launch preferred</button>
          <select value={state.preferredEmuId} onChange={e=>save({ ...state, preferredEmuId: e.target.value })}>
            <option value="bluestacks">Preferred: BlueStacks</option>
            <option value="ldplayer">Preferred: LDPlayer</option>
            <option value="nox">Preferred: Nox</option>
            <option value="memu">Preferred: MEmu</option>
            <option value="android_studio">Preferred: Android Studio</option>
          </select>
        </div>

        <div className="small" style={{marginTop:8}}>
          Detected: <b>{emulators.length}</b>
          {state.lastDetect?.adbPath ? <> · adb: <code>{state.lastDetect.adbPath}</code></> : <> · adb: <span className="badge warn">not found</span></>}
        </div>
      </div>

      <div style={{marginTop:12}} className="card">
        <div style={{fontWeight:900}}>Quick add (paste)</div>
        <div className="small">Paste URLs (one per line), or <code>Name | url</code>.</div>
        <textarea value={paste} onChange={e=>setPaste(e.target.value)} rows={5} placeholder={`Example:
Bitcoin Miner | https://zbd.gg/z/earn?gameName=Bitcoin%20Miner
https://zbd.gg/z/earn`} />
        <div className="row" style={{marginTop:10}}>
          <button onClick={parsePaste} disabled={!paste.trim()}>Add</button>
          <button onClick={()=>setPaste("")} disabled={!paste.trim()}>Clear</button>
        </div>
      </div>

      <div className="card" style={{marginTop:12}}>
        <div style={{fontWeight:900}}>Your list</div>
        <div className="small">Edit a game to add <code>packageId</code> (Android) or an iOS App Store URL.</div>

        <div style={{marginTop:10, display:"grid", gap:8}}>
          {state.games.length===0 && <div className="small">No games yet.</div>}
          {state.games.map((g,i)=>(
            <div key={i} className="card" style={{background:"rgba(8,12,18,0.35)"}}>
              <div className="row" style={{justifyContent:"space-between", alignItems:"center"}}>
                <div>
                  <div style={{fontWeight:900}}>{g.name} <span className="badge">{g.platform}</span></div>
                  <div className="small" style={{marginTop:4}}>{g.notes || g.url}</div>
                  {g.packageId && <div className="small" style={{marginTop:4}}>Android packageId: <code>{g.packageId}</code></div>}
                  {g.iosUrl && <div className="small" style={{marginTop:4}}>iOS: <code>{g.iosUrl}</code></div>}
                  {g.apkPath && <div className="small" style={{marginTop:4}}>apk: <code>{g.apkPath}</code></div>}
                </div>
                <div className="row" style={{flexWrap:"wrap", justifyContent:"flex-end"}}>
                  <button onClick={()=>window.open(g.url,"_blank")}>Open</button>
                  {g.iosUrl && <button onClick={()=>window.open(g.iosUrl,"_blank")}>App Store</button>}
                  {g.packageId && <button onClick={()=>openStoreInDevice(g.packageId!)}>Play Store</button>}
                  {g.packageId && <button onClick={()=>launchInEmulator(g.packageId!)} disabled={!desktop}>Launch</button>}
                  <button onClick={()=>pickApk(i)} disabled={!desktop}>Pick APK</button>
                  <button onClick={()=>installApk(i)} disabled={!desktop || !g.apkPath}>Install APK</button>
                  <button onClick={()=>{
                    const name = prompt("Name", g.name) || g.name;
                    const url = prompt("URL", g.url) || g.url;
                    const platform = (prompt("Platform (ZBD/Other)", g.platform) || g.platform) as any;
                    const iosUrl = prompt("iOS App Store URL (optional)", g.iosUrl || "") || "";
                    const packageId = prompt("Android packageId (optional)", g.packageId || "") || "";
                    const notes = prompt("Notes (optional)", g.notes || "") || "";
                    const next = state.games.slice();
                    next[i] = {
                      ...g,
                      name,
                      url,
                      platform,
                      iosUrl: iosUrl || undefined,
                      packageId: packageId || undefined,
                      notes: notes || undefined
                    };
                    save({ ...state, games: next });
                  }}>Edit</button>
                  <button onClick={()=>removeIdx(i)}>Remove</button>
                </div>
              </div>

              <div className="small" style={{marginTop:10, opacity:0.85}}>
                Android flow: (1) Launch preferred emulator → (2) Play Store (device) or web → (3) Launch (adb) → (4) Install APK (optional).
                iOS: we only deep-link to App Store (no iOS emulation here).
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="small" style={{marginTop:12, opacity:0.85}}>
        Note: In Web mode, emulator buttons are disabled (no access to your desktop). Use the Desktop EXE build for one-click emulator + adb workflows.
      </div>
    </div>
  );
}


async function scanOfficialZbd(){
  try{
    pushNotif({ title:"Crypto Games", body:"Scanning official ZBD lists…", tags:["Crypto Games"], level:"info" });
    const urls = ["https://zbd.gg/", "https://app.zbd.gg/arcade"];
    let names:string[] = [];
    for(const u of urls){
      const html = await fetchTextSmart(u);
      names = names.concat(parseZbdGameNames(html));
    }
    names = names.filter(n => !/\b(ZBD|Discord|Wallet|Earn now|Privacy|Terms|Download|Extension)\b/i.test(n));
    const seen = new Set<string>();
    const uniq = names.filter(n => {
      const k = n.toLowerCase();
      if(seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    const existing = new Set((state.games||[]).map(g => (g.name||"").toLowerCase()));
    const toAdd: Game[] = [];
    for(const n of uniq){
      if(existing.has(n.toLowerCase())) continue;
      toAdd.push({ name: n, platform:"ZBD", url:"https://app.zbd.gg/arcade", notes:"Auto-added from official ZBD web lists." });
    }
    if(toAdd.length === 0){
      pushNotif({ title:"Crypto Games", body:"No new games found (or all already added).", tags:["Crypto Games"], level:"warn" });
      return;
    }
    save({ ...state, games: [...toAdd, ...(state.games||[])] });
    pushNotif({ title:"Crypto Games", body:`Added ${toAdd.length} official ZBD game(s).`, tags:["Crypto Games"], level:"good" });
  }catch(e:any){
    pushNotif({ title:"Crypto Games", body:`Scan failed: ${e?.message || String(e)}`, tags:["Crypto Games"], level:"error" });
  }
}
