
import React from "react"

export default function PluginLoader(){

 const plugins=[
  "Trading Engine",
  "Grow Sensors",
  "Mining Radar",
  "Family Planner",
  "Writer Studio"
 ]

 return(
  <div className="pluginLoader">
   <h3>Installed Plugins</h3>

   {plugins.map(p=>(
    <div key={p} className="pluginItem">
      {p}
      <button>Enable</button>
    </div>
   ))}

  </div>
 )
}
