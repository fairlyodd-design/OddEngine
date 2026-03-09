
type Workspace = {
  id: string
  layout: any
}

const workspaces: Record<string, Workspace> = {}

export function saveWorkspace(id: string, layout: any) {
  workspaces[id] = { id, layout }
  localStorage.setItem("oddengine.workspace."+id, JSON.stringify(layout))
}

export function loadWorkspace(id: string) {
  const stored = localStorage.getItem("oddengine.workspace."+id)
  if (stored) {
    return JSON.parse(stored)
  }
  return workspaces[id]?.layout || null
}

export function listWorkspaces() {
  return Object.keys(workspaces)
}
