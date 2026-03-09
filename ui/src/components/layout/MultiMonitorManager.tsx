
import React from "react"

export default function MultiMonitorManager(){

 const layouts=[
  "Single Monitor",
  "Dual Monitor Trading",
  "Triple Monitor Command Center"
 ]

 return(
  <div className="multiMonitor">

   <h3>Monitor Layout</h3>

   {layouts.map(l=>(
    <button key={l}>{l}</button>
   ))}

  </div>
 )
}
