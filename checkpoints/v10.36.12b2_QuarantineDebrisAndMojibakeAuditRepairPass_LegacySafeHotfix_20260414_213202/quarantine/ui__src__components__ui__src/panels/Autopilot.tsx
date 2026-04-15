import React, { useState } from "react";
import { isDesktop, oddApi } from "../lib/odd";
import { exportToFolderBrowser, downloadTextFile, downloadZip, GenFile } from "../lib/files";
import { pushNotif } from "../lib/notifs";
import { localGenerate } from "../lib/generators";

type Props = { projectDir: string | null; exportBase: string | null };

type Gen = { id: string; title: string; desc: string; folder: string };

const gens: Gen[] = [
  { id:"fairlyodd_dashboard", title:"👁️‍🗨️ Generate FairlyOdd Trader Dashboard", desc:"React dashboard template with widgets.", folder:"fairlyodd-dashboard" },
  { id:"crypto_dashboard", title:"🪙 Generate Crypto/Mining Dashboard", desc:"React scaffold for mining + wallet dashboards.", folder:"crypto-dashboard" },
  { id:"affiliate_site", title:"🌐 Generate Affiliate Microsite", desc:"SEO microsite scaffold with keyword pages.", folder:"affiliate-site" },
  { id:"product_page", title:"💎 Generate Product Page", desc:"Static product page template.", folder:"product-page" },
  { id:"marketplace_scaffold", title:"🛒 Generate Marketplace Scaffold", desc:"Starter files for a template marketplace.", folder:"template-marketplace" },
];


export default function Autopilot({ projectDir, exportBase }: Props){
  const desktop = isDesktop();
  const [lastOut, setLastOut] = useState<string | null>(null);

  async function generateDesktop(type: string){
    const odd = oddApi();
    const res = await odd.generate({ type, exportBase, projectDir, opts: { brand:"FairlyOdd" } });
    if(res?.ok){
      setLastOut(res.outDir);
      pushNotif({ title:"Autopilot", body:`Generated ${type} → ${res.outDir}`, tags:["Autopilot"], level:"success" });
    } else {
      alert(res?.error || "Generate failed");
    }
  }

  async function generateWeb(type: string, folder: string){
    // browser export to folder (File System Access API)
    const files = localGenerate(type);
    try{
      await exportToFolderBrowser(folder, files);
      pushNotif({ title:"Autopilot", body:`Exported ${type} to selected folder`, tags:["Autopilot"], level:"success" });
    }catch(err:any){
      alert("Browser export failed. Use Chrome/Edge on localhost. Error: " + String(err));
    }
  }

  function exportAsBundle(type: string){
    // Simple fallback: download a single text bundle
    const files = localGenerate(type);
    const bundle = files.map(f => `--- ${f.path} ---\n${f.content}\n`).join("\n");
    downloadTextFile(`${type}.bundle.txt`, bundle);
  }

  return (
    <div className="card">
      <div className="row" style={{justifyContent:"space-between"}}>
        <div>
          <div style={{fontSize:22,fontWeight:800}}>Autopilot</div>
          <div className="small">Generators → real files (Desktop writes directly; Web can export to a folder)</div>
        </div>
        <span className={"badge "+(desktop?"good":"warn")}>{desktop?"Desktop":"Web"}</span>
      </div>

      <div style={{marginTop:12, display:"grid", gap:10}}>
        {gens.map(g => (
          <div key={g.id} className="card" style={{background:"rgba(8,12,18,0.35)"}}>
            <div style={{fontWeight:900}}>{g.title}</div>
            <div className="small">{g.desc}</div>

            <div className="row" style={{marginTop:10, flexWrap:"wrap"}}>
              <button onClick={()=> desktop ? generateDesktop(g.id) : generateWeb(g.id, g.folder)}>
                {desktop ? "Generate (Desktop)" : "Export to Folder (Browser)"}
              </button>
              {!desktop && (
                <>
                  <button onClick={()=>downloadZip(`${g.id}.zip`, localGenerate(g.id), g.folder)}>Download ZIP</button>
                  <button onClick={()=>exportAsBundle(g.id)}>Download bundle (fallback)</button>
                </>
              )}
            </div>
            <div className="small" style={{marginTop:8}}>Output folder: <code>{g.folder}</code></div>
          </div>
        ))}
      </div>

      {lastOut && desktop && (
        <div className="card" style={{marginTop:12}}>
          <div className="row" style={{justifyContent:"space-between", flexWrap:"wrap"}}>
            <div><b>Last output:</b> <code>{lastOut}</code></div>
            <button onClick={()=>oddApi().openPath(lastOut)}>Open Folder</button>
          </div>
          <div className="small">Tip: In Desktop mode, you can open the folder from Dev Engine logs or your file explorer.</div>
        </div>
      )}
    </div>
  );
}
