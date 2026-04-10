type ExportDump = {
  kind: "oddengine_export";
  exportedAt: number;
  prefix: string;
  items: Record<string, string>;
};

function keysForPrefix(prefix: string){
  const keys: string[] = [];
  try{
    for(let i=0;i<localStorage.length;i++){
      const k = localStorage.key(i);
      if(k && k.startsWith(prefix)) keys.push(k);
    }
  }catch{}
  keys.sort();
  return keys;
}

export function exportPrefix(prefix: string): ExportDump{
  const items: Record<string,string> = {};
  for(const k of keysForPrefix(prefix)){
    const raw = localStorage.getItem(k);
    if(raw != null) items[k] = raw;
  }
  return { kind:"oddengine_export", exportedAt: Date.now(), prefix, items };
}

export function importPrefix(prefix: string, rawJson: string){
  let parsed: any = null;
  try{ parsed = JSON.parse(rawJson); }catch{ return false; }

  const items: Record<string,string> = parsed?.items ?? {};
  // If this looks like an export dump, accept it. Otherwise ignore.
  if(parsed?.kind !== "oddengine_export" || typeof items !== "object") return false;

  // Clear old keys for that prefix first (clean restore)
  try{
    for(const k of keysForPrefix(prefix)){
      localStorage.removeItem(k);
    }
  }catch{}

  try{
    for(const [k,v] of Object.entries(items)){
      if(typeof k === "string" && k.startsWith(prefix) && typeof v === "string"){
        localStorage.setItem(k, v);
      }
    }
    return true;
  }catch{
    return false;
  }
}

type Snapshot = { ts: number; title: string; prefix: string; items: Record<string,string> };
const SNAP_KEY = "oddengine:snapshots:v1";

function loadSnapshots(): Snapshot[]{
  try{
    const raw = localStorage.getItem(SNAP_KEY);
    if(!raw) return [];
    const arr = JSON.parse(raw);
    if(!Array.isArray(arr)) return [];
    return arr.filter(Boolean) as Snapshot[];
  }catch{
    return [];
  }
}
function saveSnapshots(arr: Snapshot[]){
  try{ localStorage.setItem(SNAP_KEY, JSON.stringify(arr.slice(0, 60))); }catch{}
}

export function snapshotPrefix(prefix: string, title: string){
  const dump = exportPrefix(prefix);
  const snap: Snapshot = { ts: Date.now(), title, prefix, items: dump.items };
  const all = loadSnapshots();
  all.unshift(snap);
  saveSnapshots(all);
  return true;
}

export function restoreLatestSnapshot(prefix: string){
  const all = loadSnapshots();
  const snap = all.find(s=>s?.prefix === prefix);
  if(!snap) return false;

  // clear then restore
  try{
    for(const k of keysForPrefix(prefix)) localStorage.removeItem(k);
    for(const [k,v] of Object.entries(snap.items)){
      if(typeof k === "string" && k.startsWith(prefix) && typeof v === "string") localStorage.setItem(k, v);
    }
    return true;
  }catch{
    return false;
  }
}
