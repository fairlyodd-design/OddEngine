import React, { useMemo, useRef } from "react";
import ActionMenu from "./ActionMenu";
import { downloadTextFile } from "../lib/files";
import { exportPrefix, importPrefix, snapshotPrefix, restoreLatestSnapshot } from "../lib/storageEx";
import { getPanelCopilot, runQuickAction } from "../lib/brain";

type Tone = "good" | "warn" | "bad" | "muted";
type Badge = { label: string; tone?: Tone };

export function PanelHeader(props: {
  panelId?: string;
  title: string;
  subtitle?: string;
  storagePrefix?: string;
  storageActionsMode?: "inline" | "menu";
  badges?: Badge[];
  primaryAction?: { label: string; onClick: ()=>void };
  secondaryActions?: { label: string; onClick: ()=>void }[];
  rightSlot?: React.ReactNode;
  showCopilot?: boolean;
}){
  const fileRef = useRef<HTMLInputElement|null>(null);

  const badges = useMemo(()=> props.badges ?? [], [props.badges]);

  const copilot = useMemo(()=>{
    if(!props.panelId) return null;
    if(props.showCopilot === false) return null;
    try { return getPanelCopilot(props.panelId); } catch { return null; }
  }, [props.panelId, props.showCopilot]);

  const runAction = (actionId?: string)=>{
    if(!actionId) return;
    const res = runQuickAction(actionId);
    // If the action triggers any queued work, we leave the panel running; user will see updates as the panel hydrates.
    // Optional lightweight feedback via title attribute.
    if(!res?.ok) alert(res?.message || "Action failed");
  };

  const onExport = ()=>{
    if(!props.storagePrefix) return;
    const dump = exportPrefix(props.storagePrefix);
    const safe = props.title.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
    downloadTextFile(`oddengine_${safe}_export.json`, JSON.stringify(dump, null, 2));
  };

  const onImportPick = ()=>{
    fileRef.current?.click();
  };

  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>)=>{
    const f = e.target.files?.[0];
    e.target.value = "";
    if(!f || !props.storagePrefix) return;
    const txt = await f.text();
    importPrefix(props.storagePrefix, txt);
    // reload to let panels re-hydrate state safely
    window.location.reload();
  };

  const onSnapshot = ()=>{
    if(!props.storagePrefix) return;
    snapshotPrefix(props.storagePrefix, props.title);
  };

  const onRestoreLatest = ()=>{
    if(!props.storagePrefix) return;
    const ok = restoreLatestSnapshot(props.storagePrefix);
    if(ok) window.location.reload();
  };

  return (
    <div style={{display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12, marginBottom:12}}>
      <div style={{minWidth:0, flex: 1}}>
        <div style={{display:"flex", alignItems:"center", gap:10, flexWrap:"wrap"}}>
          <h2 style={{margin:"0 6px 0 0"}}>{props.title}</h2>
          {props.subtitle ? <span className="muted" style={{fontSize:13}}>{props.subtitle}</span> : null}
          <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
            {badges.map((b, i)=>(
              <span key={i} className={`badge ${b.tone ?? "muted"}`}>{b.label}</span>
            ))}
          </div>
        </div>

        {copilot ? (
          <div className="card softCard" style={{marginTop:10, padding:12}}>
            <div className="small shellEyebrow">Mission Control says</div>
            <div style={{fontWeight:900, marginTop:4}}>{copilot.priorityTitle}</div>
            <div className="small" style={{marginTop:6, lineHeight:1.5}}>{copilot.priorityText}</div>
            <div className="row" style={{gap:8, flexWrap:"wrap", marginTop:10, alignItems:"center"}}>
              {copilot.nextActionId ? (
                <button className="tabBtn" onClick={()=>runAction(copilot.nextActionId)}>
                  {copilot.nextActionLabel || "Run next action"}
                </button>
              ) : null}
              {copilot.chips.map((chip)=>(
                <button key={chip.id} className="tabBtn" onClick={()=>runAction(chip.id)}>{chip.label}</button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div style={{display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", justifyContent:"flex-end"}}>
        {props.primaryAction ? (
          <button onClick={props.primaryAction.onClick}>{props.primaryAction.label}</button>
        ) : null}

        {props.secondaryActions?.map((a, i)=>(
          <button key={i} onClick={a.onClick}>{a.label}</button>
        ))}

        {props.storagePrefix ? (
          props.storageActionsMode === "menu" ? (
            <>
              <ActionMenu
                title="Data"
                label="Data ▾"
                items={[
                  { label: "Snapshot", onClick: onSnapshot },
                  { label: "Restore latest", onClick: onRestoreLatest },
                  { label: "Export", onClick: onExport },
                  { label: "Import", onClick: onImportPick },
                ]}
              />
              <input ref={fileRef} type="file" accept="application/json,.json" style={{display:"none"}} onChange={onImportFile} />
            </>
          ) : (
            <>
              <button onClick={onSnapshot}>Snapshot</button>
              <button onClick={onRestoreLatest}>Restore latest</button>
              <button onClick={onExport}>Export</button>
              <button onClick={onImportPick}>Import</button>
              <input ref={fileRef} type="file" accept="application/json,.json" style={{display:"none"}} onChange={onImportFile} />
            </>
          )
        ) : null}

        {props.rightSlot}
      </div>
    </div>
  );
}
