import React, { useEffect, useMemo, useState } from "react";
import { isDesktop, oddApi } from "../lib/odd";
import { PanelHeader } from "../components/PanelHeader";
import ActionMenu from "../components/ActionMenu";
import { PanelScheduleCard } from "../components/PanelScheduleCard";
import { addQuickEvent, fmtDate } from "../lib/calendarStore";
import { pushNotif } from "../lib/notifs";

type LogLine = { ts: number; type: string; text: string };

const LS_PROJECT = "oddengine:dev:projectDir";

export default function DevEngine({ onOpenHowTo, onNavigate }: { onOpenHowTo?: () => void; onNavigate?: (id: string) => void } = {}){
  const nav = onNavigate || (() => {});
  const desktop = isDesktop();
  const [projectDir, setProjectDir] = useState<string | null>(() => {
    try{ return localStorage.getItem(LS_PROJECT) || null; }catch(e){ return null; }
  });
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [running, setRunning] = useState<number>(0);

  // Persist project selection
  useEffect(() => {
    try{
      if(projectDir) localStorage.setItem(LS_PROJECT, projectDir);
      else localStorage.removeItem(LS_PROJECT);
    }catch(e){}
  }, [projectDir]);

  // Default target project = OddEngine repo folder (dev mode)
  useEffect(() => {
    if(!desktop) return;
    if(projectDir) return;
    (async () => {
      try{
        const info = await oddApi().getSystemInfo();
        if(info && info.ok && !info.packaged && info.cwd){
          setProjectDir(info.cwd);
        }
      }catch(e){}
    })();
  }, [desktop, projectDir]);

  useEffect(() => {
    if(!desktop) return;
    const odd = oddApi();
    const off = odd.onRunOutput((msg:any) => {
      if(!msg) return;
      if(msg.type === "exit") setRunning(r => Math.max(0, r-1));
      if(msg.type === "stdout" || msg.type === "stderr" || msg.type === "log" || msg.type === "playbook"){
        setLogs(prev => ([{ ts: Date.now(), type: msg.type, text: (msg.line || "") } , ...prev]).slice(0, 800));
      }
    });
    return () => { try{ off && off(); }catch(e){} };
  }, [desktop]);

  const status = useMemo(() => running > 0 ? "Running" : "Idle", [running]);

  async function pick(){
    if(!desktop){ alert("Desktop mode required for project picker."); return; }
    const odd = oddApi();
    const res = await odd.pickDirectory();
    if(res.ok && res.path) setProjectDir(res.path);
  }

  async function runNpm(script: string){
    if(!desktop){ alert("Desktop mode required to run commands."); return; }
    if(!projectDir){ alert("Pick a project folder first."); return; }
    const odd = oddApi();
    setRunning(r => r+1);
    await odd.run({ cmd: "npm", args:["run", script], cwd: projectDir });
  }

  async function openDist(){
    if(!desktop){ alert("Desktop mode required."); return; }
    if(!projectDir){ alert("Pick a project folder first."); return; }
    const odd = oddApi();
    const p = projectDir.replace(/[\\\/]+$/, "") + "\\dist";
    await odd.openPath(p);
  }

  const badges = [
    { label: status + (running>0?` (${running})`:""), tone: status==="Idle" ? "good" : "warn" as any },
    { label: desktop ? "Desktop" : "Web", tone: desktop ? "good" : "warn" as any },
    { label: projectDir ? "Project selected" : "No project", tone: projectDir ? "good" : "warn" as any },
  ];

  const devMetrics = [
    { label: "Status", value: status, note: running > 0 ? `${running} active process${running > 1 ? "es" : ""}` : "no active runs" },
    { label: "Project", value: projectDir ? "Ready" : "Unset", note: projectDir || "pick a repo folder" },
    { label: "Log lines", value: String(logs.length), note: logs.length ? "stream buffer loaded" : "waiting for stdout" },
    { label: "Mode", value: desktop ? "Desktop" : "Web", note: desktop ? "commands enabled" : "viewer only" },
  ];

  return (
    <div className="page">
      <PanelHeader
        title="🧰 DevEngine"
        subtitle="Projects + builds + logs (Desktop mode enables real stdout streaming)."
        panelId="DevEngine"
        storagePrefix="oddengine:dev"
        storageActionsMode="menu"
        badges={badges as any}
        rightSlot={
          <ActionMenu
            title="Dev tools"
            items={[
              { label: "Open Calendar", onClick: () => nav("Calendar") },
              { label: "Add build reminder (today)", onClick: () => { addQuickEvent({ title: "Dev: build + smoke test", panelId: "DevEngine", date: fmtDate(new Date()), notes: "Build, run, validate panels, ship zip." }); pushNotif({ title: "DevEngine", body: "Added reminder to Calendar.", tags: ["DevEngine"], level: "good" as any }); } },
              { label: "How to Use", onClick: () => onOpenHowTo?.() },
              { label: "Open dist folder", onClick: () => { openDist(); }, disabled: !desktop || !projectDir },
            ]}
          />
        }
      />

      <div className="card opsHeroCard">
        <div className="opsHeroBar">
          <div>
            <div className="small shellEyebrow">OPS / BUILD BAY</div>
            <div className="opsHeroTitle">DevEngine</div>
            <div className="opsHeroSub">Project selection, build runs, and live logs framed like a proper local ship station instead of a plain utility panel.</div>
          </div>
          <div className="row wrap opsHeroBadges" style={{ justifyContent: "flex-end" }}>
            <span className={`badge ${status === "Idle" ? "good" : "warn"}`}>{status}{running > 0 ? ` (${running})` : ""}</span>
            <span className={`badge ${desktop ? "good" : "warn"}`}>{desktop ? "Desktop" : "Web"}</span>
            <span className={`badge ${projectDir ? "good" : "warn"}`}>{projectDir ? "Project ready" : "No project"}</span>
          </div>
        </div>
        <div className="opsMetricStrip">
          {devMetrics.map((item) => (
            <div key={item.label} className="opsMetricCard">
              <div className="small shellEyebrow">{item.label}</div>
              <div className="opsMetricValue">{item.value}</div>
              <div className="small">{item.note}</div>
            </div>
          ))}
        </div>
      </div>

      <PanelScheduleCard
        panelId="DevEngine"
        title="Dev schedule"
        subtitle="Quick-add ship reminders + upcoming items."
        presets={[
          { label: "+ Build", title: "Dev: build", notes: "npm run build" },
          { label: "+ Test", title: "Dev: test", notes: "npm run test" },
          { label: "+ Ship zip", title: "Dev: ship zip", offsetDays: 1, notes: "Update version notes + zip build." },
          { label: "+ Release notes", title: "Dev: release notes", offsetDays: 1, notes: "Summarize changes and next tasks." },
        ]}
        onNavigate={nav}
      />

      {!desktop && (
        <div className="bannerLan">
          <b>Web mode:</b> command execution + disk logs require Desktop mode.
        </div>
      )}

      <div className="card softCard">
        <div className="row" style={{justifyContent:"space-between", alignItems:"center", gap:10, flexWrap:"wrap"}}>
          <div>
            <div className="h">Project</div>
            <div className="sub">{projectDir || "No project selected"}</div>
          </div>
          <div className="row" style={{gap:10, flexWrap:"wrap"}}>
            <button onClick={pick} disabled={!desktop}>Pick Project Folder</button>
            <button className="tabBtn" onClick={() => onOpenHowTo?.()} title="How to Use (F1)">ℹ How to Use</button>
          </div>
        </div>

        <div className="row" style={{marginTop:12, flexWrap:"wrap", gap:10}}>
          <button onClick={()=>runNpm("build")} disabled={!desktop || !projectDir}>npm run build</button>
          <button onClick={()=>runNpm("test")} disabled={!desktop || !projectDir}>npm run test</button>
          <button onClick={()=>runNpm("lint")} disabled={!desktop || !projectDir}>npm run lint</button>
        </div>

        <div className="row" style={{marginTop:10, flexWrap:"wrap", gap:10}}>
          <button onClick={()=>runNpm("dist:portable")} disabled={!desktop || !projectDir}>Build EXE (portable)</button>
          <button onClick={()=>runNpm("dist:win")} disabled={!desktop || !projectDir}>Build EXE (installer)</button>
          <button onClick={()=>runNpm("dist:all")} disabled={!desktop || !projectDir}>Build EXE (both)</button>
          <button onClick={openDist} disabled={!desktop || !projectDir}>Open dist folder</button>
        </div>
      </div>

      <div className="card softCard">
        <div className="h">Unreal-style console</div>
        <div className="sub">Live stdout/stderr from Desktop runs. (Newest on top.)</div>
        <div style={{marginTop:10, border:"1px solid var(--line)", borderRadius:14, padding:10, background:"rgba(0,0,0,0.25)", height:320, overflow:"auto"}}>
          {logs.length===0 && <div className="small">No logs yet.</div>}
          {logs.map((l, i) => (
            <div key={i} style={{fontFamily:"ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace", fontSize:12, whiteSpace:"pre-wrap", color: l.type==="stderr" ? "var(--bad)" : "var(--fg)"}}>
              {new Date(l.ts).toLocaleTimeString()} [{l.type}] {l.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
