
export function saveLayout(layout:any){
 localStorage.setItem("oe_layout",JSON.stringify(layout))
}

export function loadLayout(){
 const l = localStorage.getItem("oe_layout")
 if(!l) return []
 return JSON.parse(l)
}
