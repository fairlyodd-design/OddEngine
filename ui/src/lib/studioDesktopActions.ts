import { oddApi, isDesktop } from "./odd";

export type DesktopOutputLike = {
  output?: {
    localPath?: string | null;
    previewUrl?: string | null;
  } | null;
  payload?: unknown;
};

export type DesktopActionResult = {
  ok: boolean;
  message: string;
  path?: string | null;
};

function normalizePath(input?: string | null): string | null {
  const value = String(input || "").trim();
  if (!value) return null;

  if (value.startsWith("file://")) {
    try {
      const url = new URL(value);
      let path = decodeURIComponent(url.pathname || "");
      if (/^\/[A-Za-z]:/.test(path)) path = path.slice(1);
      return path.replace(/\//g, "\\");
    } catch {
      return value.replace(/^file:\/\//, "");
    }
  }

  return value;
}

export function getLocalOutputPath(job?: DesktopOutputLike | null): string | null {
  return (
    normalizePath(job?.output?.localPath) ||
    normalizePath(job?.output?.previewUrl) ||
    null
  );
}

export function getFolderFromPath(path?: string | null): string | null {
  const value = normalizePath(path);
  if (!value) return null;
  const idx = Math.max(value.lastIndexOf("\\"), value.lastIndexOf("/"));
  if (idx <= 0) return null;
  return value.slice(0, idx);
}

async function copyText(text: string): Promise<DesktopActionResult> {
  const value = String(text || "").trim();
  if (!value) return { ok: false, message: "Nothing to copy.", path: null };

  try {
    if (oddApi && typeof (oddApi as any).copyText === "function") {
      await (oddApi as any).copyText(value);
      return { ok: true, message: "Copied to clipboard.", path: value };
    }
    await navigator.clipboard.writeText(value);
    return { ok: true, message: "Copied to clipboard.", path: value };
  } catch (error: any) {
    return { ok: false, message: error?.message || "Copy failed.", path: value };
  }
}

async function openPath(path?: string | null): Promise<DesktopActionResult> {
  const value = normalizePath(path);
  if (!value) return { ok: false, message: "No path available.", path: null };

  try {
    if (oddApi && typeof (oddApi as any).openPath === "function") {
      await (oddApi as any).openPath(value);
      return { ok: true, message: "Opened path.", path: value };
    }
    if (isDesktop && oddApi && typeof (oddApi as any).shellOpenPath === "function") {
      await (oddApi as any).shellOpenPath(value);
      return { ok: true, message: "Opened path.", path: value };
    }
    window.open(`file:///${value.replace(/\\/g, "/")}`, "_blank", "noopener,noreferrer");
    return { ok: true, message: "Opened file URL.", path: value };
  } catch (error: any) {
    return { ok: false, message: error?.message || "Open path failed.", path: value };
  }
}

async function revealPath(path?: string | null): Promise<DesktopActionResult> {
  const value = normalizePath(path);
  if (!value) return { ok: false, message: "No file path available.", path: null };

  try {
    if (oddApi && typeof (oddApi as any).revealPath === "function") {
      await (oddApi as any).revealPath(value);
      return { ok: true, message: "Revealed file.", path: value };
    }
    if (oddApi && typeof (oddApi as any).showItemInFolder === "function") {
      await (oddApi as any).showItemInFolder(value);
      return { ok: true, message: "Revealed file.", path: value };
    }
    const folder = getFolderFromPath(value);
    if (folder) return openPath(folder);
    return { ok: false, message: "No folder found for file.", path: value };
  } catch (error: any) {
    return { ok: false, message: error?.message || "Reveal file failed.", path: value };
  }
}

export async function openOutputFolder(job?: DesktopOutputLike | null): Promise<DesktopActionResult> {
  const path = getLocalOutputPath(job);
  const folder = getFolderFromPath(path);
  return openPath(folder);
}

export async function revealOutputFile(job?: DesktopOutputLike | null): Promise<DesktopActionResult> {
  const path = getLocalOutputPath(job);
  return revealPath(path);
}

export async function copyLocalFilePath(job?: DesktopOutputLike | null): Promise<DesktopActionResult> {
  const path = getLocalOutputPath(job);
  if (!path) return { ok: false, message: "No local file path available.", path: null };
  return copyText(path);
}

export async function copyRenderPayload(job?: DesktopOutputLike | null): Promise<DesktopActionResult> {
  const payload = job?.payload;
  if (payload == null) return { ok: false, message: "No render payload available.", path: null };
  return copyText(JSON.stringify(payload, null, 2));
}

export async function openPacketExportFolder(projectTitle?: string): Promise<DesktopActionResult> {
  const safe = String(projectTitle || "studio-project").trim().replace(/[^\w.-]+/g, "_");
  const hinted = `C:\\OddEngine\\exports\\studio\\${safe}`;
  return openPath(hinted);
}
