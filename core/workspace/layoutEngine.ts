
type WindowLayout = {
  id: string
  x: number
  y: number
  w: number
  h: number
}

const layout: WindowLayout[] = []

export function registerWindow(win: WindowLayout){
  layout.push(win)
}

export function updateWindow(id:string, data:Partial<WindowLayout>){
  const w = layout.find(l => l.id === id)
  if(!w) return
  Object.assign(w, data)
}

export function getLayout(){
  return layout
}
