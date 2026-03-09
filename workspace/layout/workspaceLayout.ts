
export interface PanelLayout {
 id:string
 x:number
 y:number
 w:number
 h:number
}

let layout:PanelLayout[] = []

export function setLayout(l:PanelLayout[]){
 layout = l
 localStorage.setItem("oddengine_layout",JSON.stringify(l))
}

export function getLayout():PanelLayout[]{
 const saved = localStorage.getItem("oddengine_layout")
 if(saved){
  layout = JSON.parse(saved)
 }
 return layout
}
