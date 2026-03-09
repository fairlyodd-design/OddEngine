
let workspaces:any = {}

export function saveWorkspace(name:string,layout:any){
 workspaces[name] = layout
 localStorage.setItem("oe_workspaces",JSON.stringify(workspaces))
}

export function loadWorkspace(name:string){
 const saved = localStorage.getItem("oe_workspaces")
 if(saved){
  workspaces = JSON.parse(saved)
 }
 return workspaces[name] || []
}
