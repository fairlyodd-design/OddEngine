
export type ElectronDisplay = {
  id: number | string;
  bounds: { x: number; y: number; width: number; height: number };
  workArea?: { x: number; y: number; width: number; height: number };
  scaleFactor?: number;
  rotation?: number;
  internal?: boolean;
};

declare global {
  interface Window {
    oddMonitorBridge?: {
      getDisplays?: () => Promise<ElectronDisplay[]>;
    };
  }
}

export async function getElectronDisplays(): Promise<ElectronDisplay[]> {
  try {
    const displays = await window.oddMonitorBridge?.getDisplays?.();
    if (Array.isArray(displays) && displays.length) return displays;
  } catch {}
  return [{
    id: "renderer-fallback",
    bounds: { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight },
    workArea: { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight },
    scaleFactor: window.devicePixelRatio || 1,
  }];
}
