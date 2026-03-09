export type WindowState = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  z: number;
  minimized: boolean;
  maximized: boolean;
};

const windows: Record<string, WindowState> = {};

export function registerWindow(id: string) {
  if (!windows[id]) {
    windows[id] = { id, x: 100, y: 100, width: 500, height: 400, z: 1, minimized: false, maximized: false };
  }
  return windows[id];
}

export function updateWindow(id: string, partial: Partial<WindowState>) {
  windows[id] = { ...windows[id], ...partial };
  return windows[id];
}

export function getWindows() {
  return windows;
}