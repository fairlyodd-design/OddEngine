
export interface DockPanel {
 id:string
 x:number
 y:number
 w:number
 h:number
}

let panels:DockPanel[] = []

export function movePanel(id:string,x:number,y:number){
 const p = panels.find(p=>p.id===id)
 if(!p) return
 p.x = x
 p.y = y
}

export function resizePanel(id:string,w:number,h:number){
 const p = panels.find(p=>p.id===id)
 if(!p) return
 p.w = w
 p.h = h
}

export function registerPanel(panel:DockPanel){
 panels.push(panel)
}

export function getPanels(){
 return panels
}
