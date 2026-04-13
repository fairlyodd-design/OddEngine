export type GenFile = { path: string; content: string };

export async function exportToFolderBrowser(folderName: string, files: GenFile[]) {
  // @ts-ignore
  const dirHandle = await window.showDirectoryPicker();
  let target = dirHandle;
  if (folderName) {
    // @ts-ignore
    target = await dirHandle.getDirectoryHandle(folderName, { create: true });
  }

  for (const f of files) {
    const parts = f.path.split("/").filter(Boolean);
    let cur = target;
    for (let i = 0; i < parts.length; i += 1) {
      const part = parts[i];
      const isFile = i === parts.length - 1;
      if (isFile) {
        // @ts-ignore
        const fileHandle = await cur.getFileHandle(part, { create: true });
        // @ts-ignore
        const writer = await fileHandle.createWritable();
        await writer.write(f.content);
        await writer.close();
      } else {
        // @ts-ignore
        cur = await cur.getDirectoryHandle(part, { create: true });
      }
    }
  }
  return true;
}

export function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export async function downloadZip(filename: string, files: GenFile[], rootFolder?: string) {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const base = rootFolder ? zip.folder(rootFolder) : zip;
  if (!base) throw new Error("Could not create zip root folder.");
  for (const f of files) {
    base.file(f.path, f.content);
  }
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".zip") ? filename : `${filename}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  return true;
}
