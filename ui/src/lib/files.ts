export type GenFile = { path: string; content: string };

export async function exportToFolderBrowser(folderName: string, files: GenFile[]){
  // Uses File System Access API (Chrome/Edge) - works on localhost
  // @ts-ignore
  const dirHandle = await window.showDirectoryPicker();
  // create subfolder
  let target = dirHandle;
  if(folderName){
    // @ts-ignore
    target = await dirHandle.getDirectoryHandle(folderName, { create:true });
  }

  for(const f of files){
    const parts = f.path.split("/").filter(Boolean);
    let cur = target;
    for(let i=0;i<parts.length;i++){
      const part = parts[i];
      const isFile = i === parts.length-1;
      if(isFile){
        // @ts-ignore
        const fileHandle = await cur.getFileHandle(part, { create:true });
        // @ts-ignore
        const w = await fileHandle.createWritable();
        await w.write(f.content);
        await w.close();
      } else {
        // @ts-ignore
        cur = await cur.getDirectoryHandle(part, { create:true });
      }
    }
  }
  return true;
}

export function downloadTextFile(filename: string, content: string){
  const blob = new Blob([content], { type:"text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 1500);
}

export async function downloadZip(filename: string, files: GenFile[], rootFolder?: string){
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const base = rootFolder ? zip.folder(rootFolder) : zip;
  for(const f of files){
    base.file(f.path, f.content);
  }
  const blob = await zip.generateAsync({ type:"blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".zip") ? filename : `${filename}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 1500);
  return true;
}
