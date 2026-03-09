
type MonitorLayout = {
  name:string
  monitors:number
}

const layouts:MonitorLayout[] = [
  { name:"single", monitors:1 },
  { name:"dual", monitors:2 },
  { name:"triple", monitors:3 }
]

export function getMonitorLayouts(){
  return layouts
}
