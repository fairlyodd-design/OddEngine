
import React from "react"
import { getMonitorLayouts } from "../../core/workspace/monitorManager"

export default function MultiMonitorControl(){

 const layouts = getMonitorLayouts()

 return (

  <div className="monitorControl">

   <div className="h">Monitor Layout</div>

   {layouts.map(l => (
     <button key={l.name}>
       {l.name} ({l.monitors})
     </button>
   ))}

  </div>

 )
}
