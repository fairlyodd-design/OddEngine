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
    const code = `export default function Scene(){\n  return (\n    <div style={${JSON.stringify(nodes[0].css)}}>\n      <div style={${JSON.stringify(nodes[1].css)}}>${nodes[1].name}</div>\n    </div>\n  );\n}`;
    downloadTextFile("Scene.tsx", code);
  }

  return (
    <div className="card">
      <div className="row" style={{justifyContent:"space-between"}}>
        <div>
          <div style={{fontSize:22,fontWeight:800}}>Builder</div>
          <div className="small">Canvas + inspector (v3 plumbing). v4 can add true drag/move + docking.</div>
        </div>
        <div className="row" style={{gap:8}}>
          <button onClick={exportReact}>Export React</button>
          <button onClick={exportJSON}>Export Scene JSON</button>
        </div>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"240px 1fr 280px", gap:10, marginTop:12}}>
        <div className="card" style={{background:"rgba(8,12,18,0.35)"}}>
          <div style={{fontWeight:900, marginBottom:8}}>Scene Graph</div>
          {nodes.map(n => (
            <div key={n.id} className={"navItem "+(n.id===sel?"active":"")} onClick={()=>setSel(n.id)}>
              <div className="navTitle">{n.name}</div>
            </div>
          ))}
        </div>

        <div className="card" style={{background:"rgba(8,12,18,0.35)"}}>
          <div style={{fontWeight:900, marginBottom:8}}>Canvas Preview</div>
          <div style={{height:420, border:"1px dashed var(--line)", borderRadius:14, position:"relative", overflow:"hidden"}}>
            <div style={{position:"absolute", inset:0, ...(nodes[0].css as any)}}>
              <div style={{...(nodes[1].css as any)}}>{nodes[1].name}</div>
            </div>
          </div>
          <div className="small" style={{marginTop:8}}>This is a stable preview. Drag/move comes in v4.</div>
        </div>

        <div className="card" style={{background:"rgba(8,12,18,0.35)"}}>
          <div style={{fontWeight:900, marginBottom:8}}>Inspector</div>
          <div className="small">Selected: <b>{current.name}</b></div>
          <label className="small">Name</label>
          <input value={current.name} onChange={e=>update("name", e.target.value)} />
          <div style={{marginTop:10}}>
            <label className="small">CSS (padding)</label>
            <input value={current.css.padding || ""} onChange={e=>updateCss("padding", e.target.value)} />
          </div>
          <div style={{marginTop:10}}>
            <label className="small">CSS (borderRadius)</label>
            <input value={current.css.borderRadius || ""} onChange={e=>updateCss("borderRadius", e.target.value)} />
          </div>
        </div>
      </div>
    </div>
  );
}
