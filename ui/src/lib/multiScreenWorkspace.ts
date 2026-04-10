import { getElectronDisplays } from "./electronMonitorBridge";

export type ScreenSignature = {
  width: number;
  height: number;
  ratio: string;
  countHint: number;
};

export function getScreenSignature(): ScreenSignature {
  const width = window.innerWidth || 0;
  const height = window.innerHeight || 0;
  const ratio = `${width}x${height}`;
  // browser/electron renderer cannot fully enumerate screens without bridge,
  // so this is a safe renderer-side signature starter.
  const countHint = 1;
  return { width, height, ratio, countHint };
}

export function screenMemoryKey(base: string) {
  const sig = getScreenSignature();
  return `${base}:${sig.ratio}:screens-${sig.countHint}`;
}

export function clampToViewport(x: number, y: number, width: number, height: number) {
  const maxX = Math.max(0, window.innerWidth - width);
  const maxY = Math.max(0, window.innerHeight - height);
  return {
    x: Math.min(Math.max(0, x), maxX),
    y: Math.min(Math.max(0, y), maxY),
  };
}

export function snapToScreenEdge(x: number, y: number, width: number, height: number) {
  const pad = 18;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let nx = x;
  let ny = y;
  if (Math.abs(x - pad) < 24) nx = pad;
  if (Math.abs(y - pad) < 24) ny = pad;
  if (Math.abs((x + width) - (vw - pad)) < 24) nx = vw - width - pad;
  if (Math.abs((y + height) - (vh - pad)) < 24) ny = vh - height - pad;
  return { x: nx, y: ny };
}


export async function getNativeScreenSignature() {
  const displays = await getElectronDisplays();
  return {
    count: displays.length,
    ids: displays.map((d) => String(d.id)).join(","),
    bounds: displays.map((d) => `${d.bounds.width}x${d.bounds.height}`).join("|"),
  };
}
