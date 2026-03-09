import React, { useMemo, useState } from "react";
import { loadJSON, saveJSON } from "../lib/storage";
import { isDesktop, oddApi } from "../lib/odd";
import { pushNotif } from "../lib/notifs";

type Nvr = { id: string; name: string; host: string; user?: string; pass?: string };
type Cam = { id: string; name: string; label: string; url: string; nvrId?: string; kind: "mjpeg"|"snapshot"|"hls"|"rtsp"|"web"; enabled: boolean };

type WallState = { grid: string; page: number; live: boolean };

type State = { nvrs: Nvr[]; cameras: Cam[]; wall: WallState };

const KEY="oddengine:cameras:v1";
const PREFS_KEY="oddengine:prefs:v1";

const GRID_PRESETS = [
  { id:"2x2", cols:2, rows:2 },
  { id:"3x2", cols:3, rows:2 },
  { id:"3x3", cols:3, rows:3 },
  { id:"4x3", cols:4, rows:3 },
  { id:"6x2", cols:6, rows:2 },
];

function defaultState(): State {
  const prefs:any = loadJSON(PREFS_KEY, null as any);
  const grid = String(prefs?.cameras?.grid || "4x3");
  const live = typeof prefs?.cameras?.livePreviews === "boolean" ? prefs.cameras.livePreviews : true;
  return {
    nvrs: [],
    cameras: [],
    wall: { grid, page:0, live }
  };
}

export default function Cameras(){
  const desktop = isDesktop();
  const [state, setState] = useState<State>(() => loadJSON(KEY, defaultState()));
  const [newNvr, setNewNvr] = useState<Nvr>({ id:"", name:"", host:"" });

  function save(next: State){
    setState(next);
    saveJSON(KEY, next);
  }

  const grid = useMemo(() => GRID_PRESETS.find(g=>g.id===state.wall.grid) || GRID_PRESETS[3], [state.wall.grid]);
  const perPage = grid.cols * grid.rows;

  const pages = useMemo(() => {
    const total = state.cameras.length;
    return Math.max(1, Math.ceil(total / perPage));
  }, [state.cameras.length, perPage]);

  const page = Math.min(state.wall.page, pages-1);
  const start = page * perPage;
  const slice = state.cameras.slice(start, start + perPage);

  function setGrid(id: string){
    save({ ...state, wall:{ ...state.wall, grid:id, page:0 }});
  }

  function prev(){
    save({ ...state, wall:{ ...state.wall, page: Math.max(0, page-1) }});
  }
  function next(){
    save({ ...state, wall:{ ...state.wall, page: Math.min(pages-1, page+1) }});
  }

  function addNvr(){
    if(!newNvr.host.trim()) return;
    const n: Nvr = { ...newNvr, id: crypto.randomUUID(), name: newNvr.name.trim() || newNvr.host.trim() };
    save({ ...state, nvrs:[n, ...state.nvrs] });
    setNewNvr({ id:"", name:"", host:"" });
    pushNotif({ title:"Cameras", body:`Added NVR: ${n.name}`, tags:["Cameras"], level:"success" });
  }

  function autoCreate12(){
    const labels = ["Grow Room 🌱","Garage 🚗","Door 🚪","Yard 🌙","Living","Office","Hall","Back","Front","Side","Driveway","Spare"];
    const cams: Cam[] = Array.from({length:12}).map((_,i)=>({
      id: crypto.randomUUID(),
      name: `Cam ${i+1}`,
      label: labels[i] || `Cam ${i+1}`,
      url: "",
      kind: "web",
      enabled: true
    }));
    save({ ...state, cameras: cams, wall:{ ...state.wall, page:0, live:true }});
    pushNotif({ title:"Cameras", body:"Created 12 camera slots.", tags:["Cameras"], level:"success" });
  }

  function updateCam(id: string, patch: Partial<Cam>){
    save({ ...state, cameras: state.cameras.map(c=>c.id===id?{...c,...patch}:c) });
  }

  const activeCams = state.cameras.filter(c => c.enabled).length;
  const camMetrics = [
    { label: "Wall grid", value: state.wall.grid, note: `${grid.cols}x${grid.rows} layout` },
    { label: "Active cams", value: String(activeCams), note: `${state.cameras.length} total slots` },
    { label: "Pages", value: String(pages), note: `page ${page + 1} of ${pages}` },
    { label: "Preview mode", value: state.wall.live ? "Live" : "Still", note: desktop ? "desktop tools ready" : "web-safe mode" },
  ];

  async function testHost(host: string){
    if(!desktop){
      pushNotif({ title:"Cameras", body:"Web mode can’t TCP ping. Use Desktop mode or open the URL in a new tab.", tags:["Cameras"], level:"warn" });
      return;
    }
    const odd = oddApi();
    const res = await odd.tcpPing({ host, port: 80, timeoutMs: 1200 });
    if(res.ok) pushNotif({ title:"Cameras", body:`Host reachable: ${host}:80`, tags:["Cameras"], level:"success" });
    else pushNotif({ title:"Cameras", body:`Ping failed: ${host} (${res.error})`, tags:["Cameras","Error"], level:"error" });
  }

  return (
    <div className="card opsPanelRoot">
      <div className="opsHeroCard">
        <div className="opsHeroBar">
          <div>
            <div className="small shellEyebrow">OPS / CAMERA WALL</div>
            <div className="opsHeroTitle">Cameras</div>
            <div className="opsHeroSub">NVR endpoints, preview posture, and wall paging tuned into one cleaner monitoring surface.</div>
          </div>
          <div className="row wrap opsHeroBadges" style={{justifyContent:"flex-end"}}>
            <span className={"badge "+((state.cameras.length>0)?"good":"warn")}>{state.cameras.length} cams</span>
            <span className={"badge "+(state.wall.live?"good":"warn")}>{state.wall.live ? "Live previews" : "Still mode"}</span>
            <span className={"badge "+(desktop?"good":"warn")}>{desktop ? "Desktop" : "Web"}</span>
          </div>
        </div>
        <div className="opsMetricStrip">
          {camMetrics.map((item) => (
            <div key={item.label} className="opsMetricCard">
              <div className="small shellEyebrow">{item.label}</div>
              <div className="opsMetricValue">{item.value}</div>
              <div className="small">{item.note}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{marginTop:12, display:"grid", gridTemplateColumns:"1fr 1fr", gap:10}}>
        <div className="card opsSectionCard">
          <div style={{fontWeight:900}}>NVRs</div>
          <div className="small">Add your NVR IPs/hosts. (You can keep creds blank.)</div>
          <div className="row" style={{marginTop:8}}>
            <input placeholder="Name" value={newNvr.name} onChange={e=>setNewNvr({...newNvr, name:e.target.value})} />
            <input placeholder="Host (e.g. 192.168.0.26)" value={newNvr.host} onChange={e=>setNewNvr({...newNvr, host:e.target.value})} />
          </div>
          <div className="row" style={{marginTop:8}}>
            <input placeholder="User (optional)" value={newNvr.user||""} onChange={e=>setNewNvr({...newNvr, user:e.target.value})} />
            <input placeholder="Pass (optional)" value={newNvr.pass||""} onChange={e=>setNewNvr({...newNvr, pass:e.target.value})} />
          </div>
          <div className="row" style={{marginTop:10, justifyContent:"space-between"}}>
            <button onClick={addNvr}>Add NVR</button>
            <button onClick={autoCreate12}>Auto-create 12 slots</button>
          </div>

          <div style={{marginTop:10}}>
            {state.nvrs.length===0 && <div className="small">No NVRs added yet.</div>}
            {state.nvrs.map(n => (
              <div key={n.id} className="row" style={{justifyContent:"space-between", border:"1px solid var(--line)", borderRadius:12, padding:"8px 10px", marginTop:6}}>
                <div>
                  <div style={{fontWeight:800}}>{n.name}</div>
                  <div className="small">{n.host}</div>
                </div>
                <div className="row">
                  <button onClick={()=>testHost(n.host)}>Test</button>
                  <button onClick={()=>window.open("http://"+n.host, "_blank")}>Open</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card opsSectionCard">
          <div style={{fontWeight:900}}>Wall</div>
          <div className="row" style={{marginTop:8, flexWrap:"wrap"}}>
            <span className="small">Grid</span>
            <select value={state.wall.grid} onChange={e=>setGrid(e.target.value)} style={{width:140}}>
              {GRID_PRESETS.map(g=> <option key={g.id} value={g.id}>{g.id}</option>)}
            </select>
            <span className="small">Live</span>
            <select value={state.wall.live ? "on" : "off"} onChange={e=>save({ ...state, wall:{...state.wall, live: e.target.value==="on"} })} style={{width:120}}>
              <option value="on">ON</option>
              <option value="off">OFF</option>
            </select>
            <span className="badge">Page {page+1}/{pages}</span>
            <button onClick={prev} disabled={page===0}>Prev</button>
            <button onClick={next} disabled={page>=pages-1}>Next</button>
          </div>

          <div style={{marginTop:10, display:"grid", gap:10, gridTemplateColumns:`repeat(${grid.cols}, 1fr)`}}>
            {slice.map((c) => (
              <div key={c.id} className="card" style={{padding:10, background:"rgba(0,0,0,0.2)"}}>
                <div className="row" style={{justifyContent:"space-between"}}>
                  <div style={{fontWeight:900, fontSize:12}}>{c.label}</div>
                  <label className="small">
                    <input type="checkbox" checked={c.enabled} onChange={e=>updateCam(c.id, { enabled: e.target.checked })} />
                    <span style={{marginLeft:6}}>On</span>
                  </label>
                </div>

                <div className="small" style={{marginTop:6}}>URL</div>
                <input value={c.url} onChange={e=>updateCam(c.id, { url: e.target.value })} placeholder="http://... or MJPEG/snapshot/HLS URL" />

                <div className="row" style={{marginTop:8}}>
                  <select value={c.kind} onChange={e=>updateCam(c.id, { kind: e.target.value as any })} style={{width:140}}>
                    <option value="web">Web</option>
                    <option value="mjpeg">MJPEG</option>
                    <option value="snapshot">Snapshot</option>
                    <option value="hls">HLS</option>
                    <option value="rtsp">RTSP (store only)</option>
                  </select>
                  <button onClick={()=> c.url ? window.open(c.url,"_blank") : null} disabled={!c.url}>Open</button>
                </div>

                <div style={{marginTop:8}}>
                  {!state.wall.live || !c.enabled ? (
                    <div className="small">Preview off.</div>
                  ) : c.kind === "rtsp" ? (
                    <div className="small">RTSP can’t play in browser directly. Use a relay (Frigate/Shinobi) or open NVR web UI.</div>
                  ) : !c.url ? (
                    <div className="small">Paste a URL to preview.</div>
                  ) : c.kind === "snapshot" ? (
                    <img src={c.url} style={{width:"100%", borderRadius:12, border:"1px solid var(--line)"}} />
                  ) : c.kind === "mjpeg" ? (
                    <img src={c.url} style={{width:"100%", borderRadius:12, border:"1px solid var(--line)"}} />
                  ) : c.kind === "hls" ? (
                    <video src={c.url} controls muted autoPlay playsInline style={{width:"100%", borderRadius:12, border:"1px solid var(--line)"}} />
                  ) : (
                    <div className="small">Use Web kind to store a dashboard URL.</div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div style={{marginTop:10}} className="small">
            For AI detection + recording + timeline: run a local backend like <b>Frigate</b> (Docker) and point your cameras there.
          </div>
        </div>
      </div>
    </div>
  );
}
