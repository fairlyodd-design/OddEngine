
export type WindowState = {
  id: string
  x: number
  y: number
  width: number
  height: number
  z: number
}

const windows: Record<string, WindowState> = {}

export function createWindow(id:string){
  if(!windows[id]){
    windows[id] = {id, x:200, y:160, width:720, height:480, z:1}
  }
  return windows[id]
}

export function moveWindow(id:string,x:number,y:number){
  if(windows[id]){
    windows[id].x = x
    windows[id].y = y
  }
}

export function getWindows(){
  return Object.values(windows)
}
