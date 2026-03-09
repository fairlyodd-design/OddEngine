
export type WindowState={
 id:string
 x:number
 y:number
 width:number
 height:number
 z:number
 minimized:boolean
}

const windows:Record<string,WindowState>={}

export function openWindow(id:string){
 if(!windows[id]){
  windows[id]={id,x:240,y:160,width:820,height:540,z:1,minimized:false}
 }
 return windows[id]
}

export function moveWindow(id:string,x:number,y:number){
 if(windows[id]){
  windows[id].x=x
  windows[id].y=y
 }
}

export function resizeWindow(id:string,w:number,h:number){
 if(windows[id]){
  windows[id].width=w
  windows[id].height=h
 }
}

export function getWindows(){
 return Object.values(windows)
}
