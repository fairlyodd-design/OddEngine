type Layout = Record<string, any>;

export function saveWorkspace(name: string, layout: Layout) {
  localStorage.setItem("workspace_" + name, JSON.stringify(layout));
}

export function loadWorkspace(name: string): Layout | null {
  const raw = localStorage.getItem("workspace_" + name);
  return raw ? JSON.parse(raw) : null;
}