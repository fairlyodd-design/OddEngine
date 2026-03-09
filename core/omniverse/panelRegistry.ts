
type Panel = {
 id:string
 component:any
}

const panels:Panel[]=[]

export function registerPanel(panel:Panel){
 panels.push(panel)
}

export function getPanels(){
 return panels
}
