import React, { useMemo, useState } from "react";
import { downloadTextFile } from "../lib/files";

type Node = { id: string; name: string; x: number; y: number; w: number; h: number; css: Record<string,string> };

export default function Builder(){
  const [nodes, setNodes] = useState<Node[]>([
    { id:"root", name:"Root", x:0,y:0,w:800,h:500, css:{ padding:"16px" } },
    { id:"panel1", name:"Panel", x:0,y:0,w:380,h:200, css:{ border:"1px solid #223", borderRadius:"16px", padding:"12px" } },
  ]);
  const [sel, setSel] = useState<string>("panel1");

  const current = useMemo(()=>nodes.find(n=>n.id===sel) || nodes[0], [nodes, sel]);
  const selectedIndex = Math.max(0, nodes.findIndex(n => n.id === sel));
  const sceneSize = `${nodes[0]?.w ?? 0} × ${nodes[0]?.h ?? 0}`;
  const exportMode = "React + JSON";
  const nextMove = current?.id === "root" ? "Shape the full shell" : `Tune ${current?.name || 'panel'} styles`;

  function update(k: keyof Node, v: any){
    setNodes(prev => prev.map(n => n.id===sel ? ({...n, [k]: v}) : n));
  }
  function updateCss(key: string, value: string){
    setNodes(prev => prev.map(n => n.id===sel ? ({...n, css:{...n.css, [key]: value}}) : n));
  }

  function exportJSON(){
    downloadTextFile("scene.json", JSON.stringify(nodes, null, 2));
  }
  function exportReact(){
    const code = `export default function Scene(){
  return (
    <div style={${JSON.stringify(nodes[0].css)}}>
      <div style={${JSON.stringify(nodes[1].css)}}>${nodes[1].name}</div>
    </div>
  );
}`;
    downloadTextFile("Scene.tsx", code);
  }

  return (
    <div className="card builderPanelRoot">
      <div className="builderHeroBar">
        <div>
          <div className="small shellEyebrow">MAKER STUDIO</div>
          <div className="builderHeroTitle">Builder</div>
          <div className="small builderHeroSub">Canvas + inspector for shaping reusable OddEngine scenes. Stable preview now, with room to grow into drag, docking, and export workflows next.</div>
        </div>
        <div className="row wrap builderHeroBadges" style={{justifyContent:"flex-end"}}>
          <span className="badge">Scene {sceneSize}</span>
          <span className="badge">Nodes {nodes.length}</span>
          <span className="badge">Selected {selectedIndex + 1}/{nodes.length}</span>
          <span className="badge">Export {exportMode}</span>
        </div>
      </div>

      <div className="quickActionGrid builderMetricGrid" style={{ marginTop: 14 }}>
        <div className="card quickActionCard builderMiniCard">
          <div className="small shellEyebrow">ACTIVE NODE</div>
          <div className="panelStat">{current.name}</div>
          <div className="small">Focused for inspector edits.</div>
        </div>
        <div className="card quickActionCard builderMiniCard">
          <div className="small shellEyebrow">NEXT MOVE</div>
          <div className="panelStat">{nextMove}</div>
          <div className="small">Keep structure simple before layering motion.</div>
        </div>
        <div className="card quickActionCard builderMiniCard">
          <div className="small shellEyebrow">EXPORT PATH</div>
          <div className="panelStat">Scene.tsx</div>
          <div className="small">JSON + React output ready from the top bar.</div>
        </div>
        <div className="card quickActionCard builderMiniCard">
          <div className="small shellEyebrow">STABILITY</div>
          <div className="panelStat">Preview Safe</div>
          <div className="small">No risky drag/dock logic added in this pass.</div>
        </div>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"240px 1fr 300px", gap:12, marginTop:14}}>
        <div className="card builderSectionCard">
          <div className="builderSectionHeader">
            <div>
              <div className="small shellEyebrow">SCENE GRAPH</div>
              <div className="builderSectionTitle">Nodes</div>
            </div>
            <span className="badge">{nodes.length}</span>
          </div>
          <div style={{display:"grid", gap:8, marginTop:10}}>
            {nodes.map((n, index) => (
              <button key={n.id} className={`builderNodeItem ${n.id===sel?"active":""}`} onClick={()=>setSel(n.id)}>
                <div>
                  <div className="navTitle">{n.name}</div>
                  <div className="small builderNodeMeta">{n.w}×{n.h} • layer {index + 1}</div>
                </div>
                <span className="badge">{n.id}</span>
              </button>
            ))}
          </div>
          <div className="card builderMiniCard" style={{marginTop:12}}>
            <div className="small shellEyebrow">BUILD NOTE</div>
            <div className="small">Use the scene graph to choose the surface, then refine spacing in the inspector before exporting.</div>
          </div>
        </div>

        <div className="card builderSectionCard">
          <div className="builderSectionHeader">
            <div>
              <div className="small shellEyebrow">CANVAS PREVIEW</div>
              <div className="builderSectionTitle">Stable viewport</div>
            </div>
            <div className="row" style={{gap:8}}>
              <button onClick={exportReact}>Export React</button>
              <button onClick={exportJSON}>Export Scene JSON</button>
            </div>
          </div>
          <div className="builderPreviewFrame">
            <div className="builderPreviewStage" style={{...(nodes[0].css as any)}}>
              <div className="builderPreviewNode" style={{...(nodes[1].css as any)}}>{nodes[1].name}</div>
            </div>
          </div>
          <div className="small builderHelperNote">Stable preview now. Drag / move / docking can layer on later without changing today’s export path.</div>
        </div>

        <div className="card builderSectionCard">
          <div className="builderSectionHeader">
            <div>
              <div className="small shellEyebrow">INSPECTOR</div>
              <div className="builderSectionTitle">Selected: {current.name}</div>
            </div>
            <span className="badge">{current.id}</span>
          </div>
          <div className="builderFormGrid">
            <label className="small">Name</label>
            <input value={current.name} onChange={e=>update("name", e.target.value)} />
            <label className="small">Padding</label>
            <input value={current.css.padding || ""} onChange={e=>updateCss("padding", e.target.value)} />
            <label className="small">Border radius</label>
            <input value={current.css.borderRadius || ""} onChange={e=>updateCss("borderRadius", e.target.value)} />
            <label className="small">Width</label>
            <input value={String(current.w)} onChange={e=>update("w", Number(e.target.value) || 0)} />
            <label className="small">Height</label>
            <input value={String(current.h)} onChange={e=>update("h", Number(e.target.value) || 0)} />
          </div>
          <div className="card builderMiniCard" style={{marginTop:12}}>
            <div className="small shellEyebrow">INSPECTOR TIP</div>
            <div className="small">Tighten spacing and radius first. Visual consistency lands faster than adding more layers.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
